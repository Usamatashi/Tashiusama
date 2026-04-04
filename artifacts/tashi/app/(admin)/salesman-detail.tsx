import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { useLocalSearchParams, router } from "expo-router";
import { Colors } from "@/constants/colors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
async function getToken() { return (await AsyncStorage.getItem("tashi_token")) || ""; }

function fmt(n: number) { return n.toLocaleString(); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface MonthEntry {
  year: number;
  month: number;
  orderCount: number;
  salesAmount: number;
  alreadyApproved: boolean;
  canApprove: boolean;
  approvedAt?: string;
  commissionAmount?: number;
}

interface SalesmanMonths {
  salesmanId: number;
  salesmanName: string | null;
  salesmanPhone: string;
  months: MonthEntry[];
}

interface SalesData {
  salesmanId: number;
  periodFrom: string;
  periodTo: string;
  salesAmount: number;
  orderCount: number;
  orders: Array<{ id: number; createdAt: string; retailerName: string | null; retailerPhone: string | null; totalValue: number }>;
  alreadyApproved: boolean;
  approvedAt?: string;
  commissionAmount?: number;
  commissionPercentage?: number;
}

// ─── Commission Modal ─────────────────────────────────────────────────────────
function CommissionModal({
  visible,
  salesmanId,
  salesmanName,
  month,
  year,
  canApprove,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  salesmanId: number;
  salesmanName: string;
  month: number | null;
  year: number | null;
  canApprove: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [percentage, setPercentage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const queryClient = useQueryClient();

  const { data: salesData, isLoading: salesLoading } = useQuery<SalesData>({
    queryKey: ["salesman-sales", salesmanId, month, year],
    queryFn: async () => {
      const token = await getToken();
      const url = `${BASE}/commission/salesman-sales/${salesmanId}?month=${month}&year=${year}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
    enabled: visible && !!salesmanId && month !== null && year !== null,
  });

  const { mutate: approveCommission, isPending } = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const res = await fetch(`${BASE}/commission`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          salesmanId,
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
      queryClient.invalidateQueries({ queryKey: ["salesman-months", salesmanId] });
      queryClient.invalidateQueries({ queryKey: ["salesman-sales", salesmanId, month, year] });
      setPercentage(""); setConfirming(false); setErrorMsg("");
      onSuccess();
    },
    onError: (err: Error) => { setConfirming(false); setErrorMsg(err.message); },
  });

  const pct = parseFloat(percentage);
  const salesAmt = salesData?.salesAmount ?? 0;
  const commission = !isNaN(pct) && pct > 0 ? Math.round((salesAmt * pct) / 100) : null;

  const monthLabel = month && year
    ? new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : "";

  function handleApprove() {
    setErrorMsg("");
    if (!pct || isNaN(pct) || pct <= 0 || pct > 100) {
      setErrorMsg("Please enter a valid percentage between 1 and 100.");
      return;
    }
    setConfirming(true);
  }

  function handleClose() {
    setPercentage(""); setConfirming(false); setErrorMsg("");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={modal.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <View style={modal.sheet}>
            {/* Header */}
            <View style={modal.sheetHeader}>
              <View style={modal.sheetAvatar}>
                <Text style={modal.sheetAvatarText}>{salesmanName.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={modal.sheetName}>{salesmanName}</Text>
                <Text style={modal.sheetSub}>{monthLabel}</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={modal.closeBtn}>
                <Feather name="x" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={true}
              style={modal.scrollArea}
              contentContainerStyle={modal.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {salesLoading ? (
                <View style={modal.loading}>
                  <ActivityIndicator size="large" color={Colors.adminAccent} />
                  <Text style={modal.loadingText}>Loading sales data…</Text>
                </View>
              ) : (
                <>
                  {/* Already approved banner */}
                  {salesData?.alreadyApproved && (
                    <View style={modal.approvedBanner}>
                      <Feather name="check-circle" size={16} color="#065F46" />
                      <Text style={modal.approvedBannerText}>
                        Commission approved{salesData.approvedAt ? ` on ${fmtDate(salesData.approvedAt)}` : ""}
                        {salesData.commissionPercentage !== undefined ? ` · ${salesData.commissionPercentage}%` : ""}
                        {salesData.commissionAmount !== undefined ? ` = Rs. ${fmt(salesData.commissionAmount)}` : ""}
                      </Text>
                    </View>
                  )}

                  {/* Orders / Sales summary */}
                  <View style={modal.salesBox}>
                    <View style={modal.salesRow}>
                      <View style={modal.salesItem}>
                        <Text style={modal.salesLabel}>Orders</Text>
                        <Text style={[modal.salesValue, { color: "#1D4ED8" }]}>{salesData?.orderCount ?? 0}</Text>
                      </View>
                      <View style={[modal.salesItem, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
                        <Text style={modal.salesLabel}>Total Sales</Text>
                        <Text style={[modal.salesValue, { color: "#059669" }]}>Rs. {fmt(salesData?.salesAmount ?? 0)}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Order breakdown list */}
                  {(salesData?.orders?.length ?? 0) > 0 && (
                    <View style={modal.orderList}>
                      <Text style={modal.sectionLabel}>Order Breakdown</Text>
                      {salesData!.orders.map((o) => (
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

                  {/* No sales */}
                  {!salesData?.alreadyApproved && salesAmt === 0 && (
                    <View style={modal.noSales}>
                      <Feather name="info" size={20} color={Colors.textLight} />
                      <Text style={modal.noSalesText}>No active sales for {monthLabel}</Text>
                    </View>
                  )}

                  {/* Commission calculator — shown for all months with sales */}
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

                      {commission !== null && (
                        <View style={modal.preview}>
                          <Text style={modal.previewLabel}>Estimated Commission</Text>
                          <Text style={modal.previewValue}>Rs. {fmt(commission)}</Text>
                          <Text style={modal.previewSub}>{pct}% of Rs. {fmt(salesAmt)}</Text>
                        </View>
                      )}

                      {/* Lock notice for current month */}
                      {!canApprove && (
                        <View style={modal.lockNotice}>
                          <Feather name="lock" size={14} color="#D97706" />
                          <Text style={modal.lockNoticeText}>Approval unlocks once this month ends</Text>
                        </View>
                      )}
                    </>
                  )}
                </>
              )}
            </ScrollView>

            {!!errorMsg && (
              <View style={modal.errorBanner}>
                <Feather name="alert-circle" size={14} color="#DC2626" />
                <Text style={modal.errorBannerText}>{errorMsg}</Text>
              </View>
            )}

            {confirming && commission !== null ? (
              <View style={modal.confirmBox}>
                <Text style={modal.confirmTitle}>Confirm Commission</Text>
                <Text style={modal.confirmDesc}>
                  Approve <Text style={{ fontFamily: "Inter_700Bold" }}>Rs. {fmt(commission)}</Text> ({pct}% of Rs. {fmt(salesAmt)}) for {salesmanName} — {monthLabel}?
                </Text>
                <View style={modal.confirmRow}>
                  <TouchableOpacity style={modal.cancelBtn} onPress={() => setConfirming(false)} activeOpacity={0.8}>
                    <Text style={modal.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[modal.confirmBtn, isPending && { opacity: 0.6 }]} onPress={() => { setConfirming(false); approveCommission(); }} disabled={isPending} activeOpacity={0.8}>
                    {isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={modal.confirmBtnText}>Yes, Approve</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              !salesData?.alreadyApproved && canApprove && salesAmt > 0 && (
                <TouchableOpacity
                  style={[modal.approveBtn, salesLoading && { opacity: 0.6 }]}
                  onPress={handleApprove}
                  activeOpacity={0.8}
                  disabled={salesLoading}
                >
                  <Feather name="check-circle" size={18} color="#fff" />
                  <Text style={modal.approveBtnText}>Approve Commission</Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Month Card ───────────────────────────────────────────────────────────────
function MonthCard({ entry, onPress }: { entry: MonthEntry; onPress: () => void }) {
  const label = new Date(entry.year, entry.month - 1, 1)
    .toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <TouchableOpacity style={[styles.monthCard, entry.alreadyApproved && styles.monthCardApproved]} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.monthLeft}>
        <View style={[styles.monthIcon, entry.alreadyApproved ? styles.monthIconApproved : styles.monthIconPending]}>
          <Feather name={entry.alreadyApproved ? "check-circle" : "calendar"} size={18} color={entry.alreadyApproved ? "#059669" : Colors.adminAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.monthLabel}>{label}</Text>
          <Text style={styles.monthSub}>{entry.orderCount} order{entry.orderCount !== 1 ? "s" : ""}</Text>
        </View>
      </View>

      <View style={styles.monthRight}>
        {entry.alreadyApproved ? (
          <View style={styles.approvedBadge}>
            <Text style={styles.approvedBadgeText}>Approved</Text>
            {entry.commissionAmount !== undefined && (
              <Text style={styles.approvedAmount}>Rs. {fmt(entry.commissionAmount)}</Text>
            )}
          </View>
        ) : entry.canApprove ? (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>Rs. {fmt(entry.salesAmount)}</Text>
            <View style={styles.calcBadgeRow}>
              <Feather name="clock" size={11} color="#D97706" />
              <Text style={[styles.calcBadgeText, { color: "#D97706" }]}>Pending</Text>
            </View>
          </View>
        ) : (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>Rs. {fmt(entry.salesAmount)}</Text>
            <View style={styles.calcBadgeRow}>
              <Feather name="percent" size={11} color={Colors.adminAccent} />
              <Text style={styles.calcBadgeText}>View</Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function SalesmanDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; name?: string; phone?: string }>();
  const salesmanId = parseInt(params.id, 10);
  const displayName = params.name || params.phone || "Salesman";
  const initials = displayName.slice(0, 2).toUpperCase();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const [selectedMonth, setSelectedMonth] = useState<{ month: number; year: number; canApprove: boolean } | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  React.useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(""), 3500);
    return () => clearTimeout(t);
  }, [successMsg]);

  const { data, isLoading, refetch, isFetching } = useQuery<SalesmanMonths>({
    queryKey: ["salesman-months", salesmanId],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${BASE}/commission/salesman-months/${salesmanId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch data");
      return res.json();
    },
    enabled: !isNaN(salesmanId),
  });

  const months = data?.months ?? [];
  const totalApproved = months.filter((m) => m.alreadyApproved).length;
  const totalSalesValue = months.reduce((s, m) => s + m.salesAmount, 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={Colors.adminText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.adminAccent} />
        </View>
      ) : (
        <FlatList
          data={months}
          keyExtractor={(item) => `${item.year}-${item.month}`}
          renderItem={({ item }) => (
            <MonthCard
              entry={item}
              onPress={() => setSelectedMonth({ month: item.month, year: item.year, canApprove: item.canApprove })}
            />
          )}
          ListHeaderComponent={
            <View>
              {/* Profile card */}
              <View style={styles.profileCard}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{displayName}</Text>
                  {params.phone && params.name && (
                    <Text style={styles.profilePhone}>{params.phone}</Text>
                  )}
                </View>
              </View>

              {/* Stats row */}
              {months.length > 0 && (
                <View style={styles.statsRow}>
                  <View style={[styles.statCard, { backgroundColor: "#EFF6FF" }]}>
                    <Feather name="calendar" size={16} color="#1D4ED8" />
                    <Text style={[styles.statVal, { color: "#1D4ED8" }]}>{months.length}</Text>
                    <Text style={styles.statLbl}>Active Months</Text>
                  </View>
                  <View style={[styles.statCard, { backgroundColor: "#DCFCE7" }]}>
                    <Feather name="check-circle" size={16} color="#059669" />
                    <Text style={[styles.statVal, { color: "#059669" }]}>{totalApproved}</Text>
                    <Text style={styles.statLbl}>Approved</Text>
                  </View>
                  <View style={[styles.statCard, { backgroundColor: "#FEF3C7" }]}>
                    <Feather name="trending-up" size={16} color={Colors.adminAccent} />
                    <Text style={[styles.statVal, { color: Colors.adminAccent, fontSize: 11 }]}>Rs. {fmt(totalSalesValue)}</Text>
                    <Text style={styles.statLbl}>Total Sales</Text>
                  </View>
                </View>
              )}

              <Text style={styles.sectionTitle}>Monthly Breakdown</Text>

              {months.length === 0 && (
                <View style={styles.empty}>
                  <Feather name="calendar" size={44} color={Colors.textLight} />
                  <Text style={styles.emptyTitle}>No sales data yet</Text>
                  <Text style={styles.emptySub}>Monthly breakdown will appear once orders are placed</Text>
                </View>
              )}
            </View>
          }
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Colors.adminAccent} />
          }
        />
      )}

      {!!successMsg && (
        <View style={styles.successBanner}>
          <Feather name="check-circle" size={15} color="#065F46" />
          <Text style={styles.successBannerText}>{successMsg}</Text>
        </View>
      )}

      <CommissionModal
        visible={!!selectedMonth}
        salesmanId={salesmanId}
        salesmanName={displayName}
        month={selectedMonth?.month ?? null}
        year={selectedMonth?.year ?? null}
        canApprove={selectedMonth?.canApprove ?? false}
        onClose={() => setSelectedMonth(null)}
        onSuccess={() => {
          setSelectedMonth(null);
          setSuccessMsg("Commission approved successfully.");
          refetch();
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
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.border, justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.adminText, flex: 1, textAlign: "center" },
  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 10 },

  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  profileAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#E87722", justifyContent: "center", alignItems: "center",
  },
  profileAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  profileName: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.adminText },
  profilePhone: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },

  statsRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  statVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },

  sectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginBottom: 8 },

  monthCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  monthCardApproved: { borderLeftWidth: 3, borderLeftColor: "#059669" },
  monthLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  monthIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  monthIconApproved: { backgroundColor: "#DCFCE7" },
  monthIconPending: { backgroundColor: "#FEF3C7" },
  monthLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  monthSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },

  monthRight: { alignItems: "flex-end", gap: 4 },
  approvedBadge: { alignItems: "flex-end", gap: 2 },
  approvedBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#059669", backgroundColor: "#DCFCE7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  approvedAmount: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#059669" },

  pendingBadge: { alignItems: "flex-end", gap: 4 },
  pendingBadgeText: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.adminText },
  calcBadgeRow: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  calcBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.adminAccent },

  successBanner: {
    position: "absolute", bottom: 32, left: 16, right: 16, zIndex: 999,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#D1FAE5", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: "#6EE7B7",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
  },
  successBannerText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#065F46", flex: 1 },

  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 24 },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", alignItems: "center" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, width: "100%", gap: 12, maxHeight: "90%" },
  scrollArea: { flexGrow: 0 },
  scrollContent: { gap: 14, paddingBottom: 4 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#E87722", justifyContent: "center", alignItems: "center" },
  sheetAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  sheetName: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.adminText },
  sheetSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.border, justifyContent: "center", alignItems: "center" },

  loading: { alignItems: "center", paddingVertical: 32, gap: 10 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },

  approvedBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#D1FAE5", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#6EE7B7",
  },
  approvedBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#065F46" },

  salesBox: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, overflow: "hidden" },
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
  orderValue: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.adminText },

  noSales: { alignItems: "center", paddingVertical: 20, gap: 8 },
  noSalesText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  lockNotice: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFFBEB", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  lockNoticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: "#92400E" },

  inputSection: { gap: 8 },
  inputLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  percentInput: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.adminText,
  },
  percentSymbol: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center" },
  percentText: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.adminAccent },

  preview: { backgroundColor: "#F0FDF4", borderRadius: 14, padding: 16, alignItems: "center", gap: 4 },
  previewLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#059669" },
  previewValue: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#065F46" },
  previewSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#059669" },

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEE2E2", borderRadius: 10, padding: 12 },
  errorBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#DC2626" },

  confirmBox: { backgroundColor: "#FEF3C7", borderRadius: 16, padding: 16, gap: 10 },
  confirmTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.adminText },
  confirmDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 20 },
  confirmRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 13, borderRadius: 12, backgroundColor: Colors.border, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  confirmBtn: { flex: 1, padding: 13, borderRadius: 12, backgroundColor: Colors.adminAccent, alignItems: "center" },
  confirmBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  approveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.adminAccent, borderRadius: 16, padding: 16,
  },
  approveBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});
