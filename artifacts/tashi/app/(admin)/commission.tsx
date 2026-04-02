import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { BackButton } from "@/components/BackButton";
import { Colors } from "@/constants/colors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

async function getToken() { return (await AsyncStorage.getItem("tashi_token")) || ""; }

interface CommissionEntry {
  salesmanId: number;
  name: string | null;
  phone: string;
  totalOrders: number;
  confirmedOrders: number;
  totalSalesValue: number;
  confirmedSalesValue: number;
  totalBonus: number;
  confirmedBonus: number;
}

interface SalesData {
  salesmanId: number;
  salesmanName: string | null;
  salesmanPhone: string;
  periodFrom: string;
  periodTo: string;
  salesAmount: number;
  orderCount: number;
  orders: Array<{
    id: number;
    createdAt: string;
    retailerName: string | null;
    retailerPhone: string | null;
    totalValue: number;
  }>;
  alreadyApproved: boolean;
  approvedAt?: string;
}

function fmt(n: number) { return n.toLocaleString(); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Commission Modal ─────────────────────────────────────────────────────────
function CommissionModal({
  visible,
  salesman,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  salesman: CommissionEntry | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [percentage, setPercentage] = useState("");
  const queryClient = useQueryClient();

  const { data: salesData, isLoading: salesLoading } = useQuery<SalesData>({
    queryKey: ["salesman-sales", salesman?.salesmanId],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${BASE}/commission/salesman-sales/${salesman!.salesmanId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
    enabled: visible && !!salesman,
  });

  const { mutate: approveCommission, isPending } = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const res = await fetch(`${BASE}/commission`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          salesmanId: salesman!.salesmanId,
          percentage: Number(percentage),
          salesAmount: salesData!.salesAmount,
          periodFrom: salesData!.periodFrom,
          periodTo: salesData!.periodTo,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Failed to save commission");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salesman-commissions"] });
      queryClient.invalidateQueries({ queryKey: ["salesman-sales", salesman?.salesmanId] });
      setPercentage("");
      onSuccess();
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message);
    },
  });

  const pct = parseFloat(percentage);
  const salesAmt = salesData?.salesAmount ?? 0;
  const commission = !isNaN(pct) && pct > 0 ? Math.round((salesAmt * pct) / 100) : null;

  const monthLabel = salesData?.periodFrom
    ? new Date(salesData.periodFrom).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  function handleApprove() {
    if (salesData?.alreadyApproved) {
      Alert.alert("Already Done", `Commission for ${monthLabel} has already been approved.`);
      return;
    }
    if (!salesData || salesAmt === 0) {
      Alert.alert("No Sales", `No active sales found for ${monthLabel}.`);
      return;
    }
    if (!pct || isNaN(pct) || pct <= 0 || pct > 100) {
      Alert.alert("Invalid Percentage", "Please enter a percentage between 1 and 100.");
      return;
    }
    Alert.alert(
      "Approve Commission",
      `Approve Rs. ${fmt(commission!)} commission (${pct}% of Rs. ${fmt(salesAmt)}) for ${salesman?.name || salesman?.phone} — ${monthLabel}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Approve", onPress: () => approveCommission() },
      ]
    );
  }

  function handleClose() {
    setPercentage("");
    onClose();
  }

  const displayName = salesman ? (salesman.name || salesman.phone) : "";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={modal.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <View style={modal.sheet}>
            {/* Header */}
            <View style={modal.sheetHeader}>
              <View style={modal.sheetAvatar}>
                <Text style={modal.sheetAvatarText}>{displayName.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={modal.sheetName}>{displayName}</Text>
                <Text style={modal.sheetSub}>Commission Calculation</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={modal.closeBtn}>
                <Feather name="x" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {salesLoading ? (
                <View style={modal.loading}>
                  <ActivityIndicator size="large" color={Colors.adminAccent} />
                  <Text style={modal.loadingText}>Loading sales data…</Text>
                </View>
              ) : (
                <>
                  {/* Month label */}
                  <View style={modal.monthRow}>
                    <Feather name="calendar" size={14} color={Colors.adminAccent} />
                    <Text style={modal.monthLabel}>Month: <Text style={modal.monthValue}>{monthLabel}</Text></Text>
                  </View>

                  {/* Already approved banner */}
                  {salesData?.alreadyApproved && (
                    <View style={modal.approvedBanner}>
                      <Feather name="check-circle" size={16} color="#065F46" />
                      <Text style={modal.approvedBannerText}>
                        Commission already approved for {monthLabel}
                        {salesData.approvedAt ? ` on ${fmtDate(salesData.approvedAt)}` : ""}
                      </Text>
                    </View>
                  )}

                  {/* Sales summary */}
                  {!salesData?.alreadyApproved && (
                    <View style={modal.salesBox}>
                      <View style={modal.salesRow}>
                        <View style={modal.salesItem}>
                          <Text style={modal.salesLabel}>Active Orders</Text>
                          <Text style={[modal.salesValue, { color: "#1D4ED8" }]}>{salesData?.orderCount ?? 0}</Text>
                        </View>
                        <View style={[modal.salesItem, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
                          <Text style={modal.salesLabel}>Total Sales Value</Text>
                          <Text style={[modal.salesValue, { color: "#059669" }]}>Rs. {fmt(salesData?.salesAmount ?? 0)}</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Order list */}
                  {!salesData?.alreadyApproved && salesData && salesData.orders.length > 0 && (
                    <View style={modal.orderList}>
                      <Text style={modal.sectionLabel}>Order Breakdown</Text>
                      {salesData.orders.map((o) => (
                        <View key={o.id} style={modal.orderRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={modal.orderRetailer} numberOfLines={1}>
                              {o.retailerName || o.retailerPhone || "Unknown"}
                            </Text>
                            <Text style={modal.orderDate}>{fmtDate(o.createdAt)}</Text>
                          </View>
                          <Text style={modal.orderValue}>Rs. {fmt(o.totalValue)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {!salesData?.alreadyApproved && salesData?.salesAmount === 0 && (
                    <View style={modal.noSales}>
                      <Feather name="info" size={20} color={Colors.textLight} />
                      <Text style={modal.noSalesText}>No active sales for {monthLabel}</Text>
                    </View>
                  )}

                  {/* Percentage input — only when not already approved */}
                  {!salesData?.alreadyApproved && salesAmt > 0 && (
                    <>
                      <View style={modal.inputSection}>
                        <Text style={modal.inputLabel}>Commission Percentage</Text>
                        <View style={modal.inputRow}>
                          <TextInput
                            style={modal.percentInput}
                            placeholder="e.g. 5"
                            placeholderTextColor={Colors.textLight}
                            value={percentage}
                            onChangeText={setPercentage}
                            keyboardType="decimal-pad"
                            maxLength={5}
                          />
                          <View style={modal.percentSymbol}>
                            <Text style={modal.percentText}>%</Text>
                          </View>
                        </View>
                      </View>

                      {/* Commission preview */}
                      {commission !== null && (
                        <View style={modal.preview}>
                          <Text style={modal.previewLabel}>Total Commission</Text>
                          <Text style={modal.previewValue}>Rs. {fmt(commission)}</Text>
                          <Text style={modal.previewSub}>{pct}% of Rs. {fmt(salesAmt)}</Text>
                        </View>
                      )}
                    </>
                  )}
                </>
              )}
            </ScrollView>

            {/* Approve button — hide if already approved or no sales */}
            {!salesData?.alreadyApproved && salesAmt > 0 && (
              <TouchableOpacity
                style={[modal.approveBtn, (isPending || salesLoading) && { opacity: 0.6 }]}
                onPress={handleApprove}
                activeOpacity={0.8}
                disabled={isPending || salesLoading}
              >
                {isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="check-circle" size={18} color="#fff" />
                    <Text style={modal.approveBtnText}>Approve Commission</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Salesman Card ─────────────────────────────────────────────────────────────
function SalesmanCard({ item, onPress }: { item: CommissionEntry; onPress: () => void }) {
  const displayName = item.name || item.phone;
  const initials = displayName.slice(0, 2).toUpperCase();
  const conversionRate = item.totalOrders > 0
    ? Math.round((item.confirmedOrders / item.totalOrders) * 100)
    : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.cardPhone}>{item.phone}</Text>
        </View>
        <View style={styles.calcBadge}>
          <Feather name="percent" size={12} color={Colors.adminAccent} />
          <Text style={styles.calcText}>Calculate</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Orders</Text>
          <Text style={styles.statValue}>{item.totalOrders}</Text>
          <Text style={styles.statSub}>{item.confirmedOrders} confirmed</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxMid]}>
          <Text style={styles.statLabel}>Sales Value</Text>
          <Text style={[styles.statValue, { color: "#1D4ED8" }]}>Rs. {fmt(item.confirmedSalesValue)}</Text>
          <Text style={styles.statSub}>of Rs. {fmt(item.totalSalesValue)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Conv. Rate</Text>
          <Text style={[styles.statValue, { color: conversionRate >= 60 ? "#059669" : conversionRate >= 30 ? "#D97706" : "#DC2626" }]}>
            {conversionRate}%
          </Text>
          <Text style={styles.statSub}>of orders</Text>
        </View>
      </View>

      {item.totalOrders > 0 && (
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${conversionRate}%` as any, backgroundColor: conversionRate >= 60 ? "#059669" : conversionRate >= 30 ? "#D97706" : "#DC2626" }]} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function CommissionScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CommissionEntry | null>(null);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const { data, isLoading, refetch, isFetching } = useQuery<CommissionEntry[]>({
    queryKey: ["salesman-commissions"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${BASE}/orders/salesman-commissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch commissions");
      return res.json();
    },
  });

  const entries = (data ?? []).filter((e) => {
    const q = search.toLowerCase();
    return !q || (e.name?.toLowerCase().includes(q)) || e.phone.includes(q);
  });

  const totalConfirmedSales = (data ?? []).reduce((s, e) => s + e.confirmedSalesValue, 0);
  const totalSalesmen = (data ?? []).length;

  const renderHeader = useCallback(() => (
    <>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: "#EFF6FF" }]}>
          <Feather name="users" size={16} color="#1D4ED8" />
          <Text style={[styles.summaryVal, { color: "#1D4ED8" }]}>{totalSalesmen}</Text>
          <Text style={styles.summarySub}>Salesmen</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#DCFCE7" }]}>
          <Feather name="trending-up" size={16} color="#059669" />
          <Text style={[styles.summaryVal, { color: "#059669" }]}>Rs. {fmt(totalConfirmedSales)}</Text>
          <Text style={styles.summarySub}>Confirmed Sales</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#FEF3C7" }]}>
          <Feather name="percent" size={16} color="#D97706" />
          <Text style={[styles.summaryVal, { color: "#D97706" }]}>Tap to</Text>
          <Text style={styles.summarySub}>Calculate</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Feather name="search" size={15} color={Colors.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search salesman..."
          placeholderTextColor={Colors.textLight}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Feather name="x" size={15} color={Colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {entries.length === 0 && !isLoading && (
        <View style={styles.empty}>
          <Feather name="percent" size={44} color={Colors.textLight} />
          <Text style={styles.emptyTitle}>{search ? "No results" : "No salesmen yet"}</Text>
          <Text style={styles.emptySub}>{search ? "Try a different name or phone" : "Commission data will appear once orders are placed"}</Text>
        </View>
      )}
    </>
  ), [totalSalesmen, totalConfirmedSales, search, entries.length, isLoading]);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <BackButton color={Colors.adminAccent} fallback="/(admin)" />
        <Text style={styles.headerTitle}>Commission</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.adminAccent} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.salesmanId)}
          renderItem={({ item }) => (
            <SalesmanCard item={item} onPress={() => setSelected(item)} />
          )}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Colors.adminAccent} />}
        />
      )}

      <CommissionModal
        visible={!!selected}
        salesman={selected}
        onClose={() => setSelected(null)}
        onSuccess={() => {
          setSelected(null);
          Alert.alert("Success", "Commission approved and saved to salesman's account.");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FA" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${Colors.adminAccent}18`, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.adminText },
  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 12 },

  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  summaryCard: {
    flex: 1, borderRadius: 14, padding: 12,
    alignItems: "center", gap: 4,
  },
  summaryVal: { fontSize: 13, fontFamily: "Inter_700Bold" },
  summarySub: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.adminText },

  card: {
    backgroundColor: "#fff", borderRadius: 18, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    gap: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#E87722", justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  cardName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  cardPhone: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  calcBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: "#FEF3C7",
  },
  calcText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.adminAccent },

  statsGrid: { flexDirection: "row" },
  statBox: { flex: 1, alignItems: "center", gap: 2 },
  statBoxMid: {
    borderLeftWidth: 1, borderRightWidth: 1,
    borderLeftColor: Colors.border, borderRightColor: Colors.border,
  },
  statLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  statValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.adminText },
  statSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textLight },

  progressBarBg: { height: 5, borderRadius: 3, backgroundColor: "#F1F5F9", overflow: "hidden" },
  progressBarFill: { height: 5, borderRadius: 3 },

  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 24 },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end", alignItems: "center",
  },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 32, width: "100%", gap: 16,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "#E87722", justifyContent: "center", alignItems: "center",
  },
  sheetAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  sheetName: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.adminText },
  sheetSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.border, justifyContent: "center", alignItems: "center",
  },

  loading: { alignItems: "center", paddingVertical: 32, gap: 10 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },

  periodRow: {
    flexDirection: "row", backgroundColor: "#F7F8FA",
    borderRadius: 14, padding: 14, gap: 0,
  },
  periodItem: { flex: 1, alignItems: "center", gap: 4 },
  periodLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  periodValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.adminText, textAlign: "center" },
  divider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  salesBox: {
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, overflow: "hidden",
  },
  salesRow: { flexDirection: "row" },
  salesItem: { flex: 1, alignItems: "center", padding: 14, gap: 4 },
  salesLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  salesValue: { fontSize: 18, fontFamily: "Inter_700Bold" },

  sectionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginBottom: 6 },
  orderList: { gap: 8 },
  orderRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F7F8FA", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  orderRetailer: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.adminText },
  orderDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  orderValue: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#059669" },

  monthRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  monthLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  monthValue: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.adminText },
  approvedBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#D1FAE5", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#6EE7B7",
  },
  approvedBannerText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#065F46", flex: 1 },
  noSales: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: "#FEF9C3", borderRadius: 10 },
  noSalesText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#92400E", flex: 1 },

  inputSection: { gap: 8 },
  inputLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  inputRow: {
    flexDirection: "row", borderWidth: 1.5, borderColor: Colors.adminAccent,
    borderRadius: 14, overflow: "hidden",
  },
  percentInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminText,
  },
  percentSymbol: {
    paddingHorizontal: 16, justifyContent: "center", alignItems: "center",
    backgroundColor: "#FEF3C7",
  },
  percentText: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminAccent },

  preview: {
    backgroundColor: "#DCFCE7", borderRadius: 14, padding: 16,
    alignItems: "center", gap: 4,
  },
  previewLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#059669" },
  previewValue: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#065F46" },
  previewSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#059669" },

  approveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#059669", borderRadius: 16, paddingVertical: 16,
  },
  approveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});
