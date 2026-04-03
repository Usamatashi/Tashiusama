import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
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
  currentMonthOrders: number;
  currentMonthSalesValue: number;
}

interface SmSales { salesmanId: number; name: string | null; phone: string; salesAmount: number; orderCount: number; pct: number; }
interface MonthTotal { year: number; month: number; label: string; totalSales: number; orderCount: number; salesmen: SmSales[]; }
interface MonthlyTotals { months: MonthTotal[]; }

const AVATAR_COLORS = ["#E87722", "#7C3AED", "#0EA5E9", "#059669", "#DC2626", "#D97706"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

function fmtK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString();
}

// ─── Monthly Totals Modal ─────────────────────────────────────────────────────
function MonthlyTotalsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery<MonthlyTotals>({
    queryKey: ["monthly-totals"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${BASE}/commission/monthly-totals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: visible,
    staleTime: 0,
    gcTime: 0,
  });

  const months = data?.months ?? [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mt.overlay}>
        <View style={mt.sheet}>
          {/* Handle + header */}
          <View style={mt.handle} />
          <View style={mt.sheetHeader}>
            <View style={mt.sheetIconWrap}>
              <Feather name="bar-chart-2" size={18} color={Colors.adminAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={mt.sheetTitle}>Monthly Sales</Text>
              <Text style={mt.sheetSub}>All salesmen contribution</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={mt.closeBtn}>
              <Feather name="x" size={17} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={mt.loading}>
              <ActivityIndicator size="large" color={Colors.adminAccent} />
            </View>
          ) : months.length === 0 ? (
            <View style={mt.empty}>
              <Feather name="inbox" size={36} color={Colors.textLight} />
              <Text style={mt.emptyText}>No sales data yet</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {months.map((m, idx) => (
                <View key={`${m.year}-${m.month}`} style={[mt.monthBlock, idx === 0 && mt.monthBlockFirst]}>
                  {/* Month header */}
                  <View style={mt.monthHeader}>
                    <View style={mt.monthPill}>
                      <Feather name="calendar" size={12} color={Colors.adminAccent} />
                      <Text style={mt.monthLabel}>{m.label}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={mt.monthTotal}>Rs. {m.totalSales.toLocaleString()}</Text>
                      <Text style={mt.monthOrders}>{m.orderCount} orders</Text>
                    </View>
                  </View>

                  {/* Salesman breakdown */}
                  {m.salesmen.map((sm, si) => {
                    const color = avatarColor(sm.salesmanId);
                    const name = sm.name || sm.phone;
                    return (
                      <View key={sm.salesmanId} style={mt.smRow}>
                        {/* Rank + avatar */}
                        <View style={[mt.smAvatar, { backgroundColor: color }]}>
                          <Text style={mt.smAvatarText}>{name.slice(0, 2).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1, gap: 4 }}>
                          <View style={mt.smNameRow}>
                            <Text style={mt.smName} numberOfLines={1}>{name}</Text>
                            <Text style={mt.smAmt}>Rs. {sm.salesAmount.toLocaleString()}</Text>
                          </View>
                          {/* Progress bar */}
                          <View style={mt.barTrack}>
                            <View style={[mt.barFill, { width: `${sm.pct}%`, backgroundColor: color }]} />
                          </View>
                          <Text style={[mt.pctLabel, { color }]}>{sm.pct}% of month</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Summary Banner ────────────────────────────────────────────────────────────
function SummaryBanner({ entries, onPressSales }: { entries: CommissionEntry[]; onPressSales: () => void }) {
  const now = new Date();
  const curMonthLabel = now.toLocaleDateString("en-GB", { month: "long" });
  const totalSalesmen = entries.length;
  const curMonthOrders = entries.reduce((s, e) => s + e.currentMonthOrders, 0);
  const curMonthSales = entries.reduce((s, e) => s + e.currentMonthSalesValue, 0);

  return (
    <View style={banner.wrap}>
      {/* Salesmen */}
      <View style={banner.item}>
        <View style={[banner.iconWrap, { backgroundColor: "#EFF6FF" }]}>
          <Feather name="users" size={14} color="#1D4ED8" />
        </View>
        <Text style={banner.val}>{totalSalesmen}</Text>
        <Text style={banner.lbl}>Salesmen</Text>
      </View>

      <View style={banner.divider} />

      {/* Current-month orders */}
      <View style={banner.item}>
        <View style={[banner.iconWrap, { backgroundColor: "#DCFCE7" }]}>
          <Feather name="shopping-bag" size={14} color="#059669" />
        </View>
        <Text style={[banner.val, { color: "#059669" }]}>{curMonthOrders}</Text>
        <Text style={banner.lbl}>Orders ({curMonthLabel})</Text>
      </View>

      <View style={banner.divider} />

      {/* Current-month sales — tappable */}
      <TouchableOpacity style={banner.item} onPress={onPressSales} activeOpacity={0.75}>
        <View style={[banner.iconWrap, { backgroundColor: "#FEF3C7" }]}>
          <Feather name="trending-up" size={14} color={Colors.adminAccent} />
        </View>
        <Text style={[banner.val, { color: Colors.adminAccent, fontSize: 13 }]}>
          Rs. {fmtK(curMonthSales)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Text style={[banner.lbl, { color: Colors.adminAccent }]}>Total Sales</Text>
          <Feather name="chevron-right" size={10} color={Colors.adminAccent} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ─── Salesman Card ─────────────────────────────────────────────────────────────
function SalesmanCard({ item, rank, onPress, contributionPct }: { item: CommissionEntry; rank: number; onPress: () => void; contributionPct: number }) {
  const displayName = item.name || item.phone;
  const initials = displayName.slice(0, 2).toUpperCase();
  const hasOrders = item.totalOrders > 0;
  const color = avatarColor(item.salesmanId);

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: hasOrders ? color : "#CBD5E1" }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Rank badge */}
      <View style={[styles.rankBadge, { backgroundColor: hasOrders ? `${color}18` : "#F1F5F9" }]}>
        <Text style={[styles.rankText, { color: hasOrders ? color : "#94A3B8" }]}>#{rank}</Text>
      </View>

      {/* Top row */}
      <View style={styles.topRow}>
        <View style={[styles.avatar, { backgroundColor: color, opacity: hasOrders ? 1 : 0.4 }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardName, !hasOrders && { color: "#94A3B8" }]} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={styles.phoneRow}>
            <Feather name="phone" size={11} color={hasOrders ? Colors.textSecondary : "#CBD5E1"} />
            <Text style={[styles.cardPhone, !hasOrders && { color: "#CBD5E1" }]}>{item.phone}</Text>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={hasOrders ? color : "#CBD5E1"} />
      </View>

      {/* Active salesman stats */}
      {hasOrders && (
        <View style={styles.salesRow}>
          <View>
            <Text style={styles.salesLbl}>{new Date().toLocaleString("en-GB", { month: "long" })} Sales</Text>
            <Text style={[styles.salesVal, { color }]}>Rs. {item.currentMonthSalesValue.toLocaleString()}</Text>
          </View>
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${contributionPct}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.progressLbl}>{contributionPct}% of month</Text>
          </View>
        </View>
      )}

      {!hasOrders && (
        <View style={styles.inactiveRow}>
          <Feather name="moon" size={13} color="#CBD5E1" />
          <Text style={styles.inactiveText}>No orders placed yet</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function CommissionScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);
  const [showTotals, setShowTotals] = useState(false);

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

  const entries = [...(data ?? [])].sort((a, b) => {
    if (a.totalOrders > 0 && b.totalOrders === 0) return -1;
    if (a.totalOrders === 0 && b.totalOrders > 0) return 1;
    return b.currentMonthSalesValue - a.currentMonthSalesValue;
  });

  const totalMonthSales = entries.reduce((s, e) => s + e.currentMonthSalesValue, 0);

  function handleCardPress(item: CommissionEntry) {
    router.push({
      pathname: "/(admin)/salesman-detail",
      params: { id: String(item.salesmanId), name: item.name ?? "", phone: item.phone },
    });
  }

  const renderHeader = useCallback(() => (
    <>
      {entries.length > 0 && (
        <SummaryBanner entries={entries} onPressSales={() => setShowTotals(true)} />
      )}
      {entries.length > 0 && (
        <View style={styles.sectionLabel}>
          <Feather name="users" size={13} color={Colors.textSecondary} />
          <Text style={styles.sectionLabelText}>All Salesmen</Text>
        </View>
      )}
      {entries.length === 0 && !isLoading && (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Feather name="percent" size={32} color={Colors.adminAccent} />
          </View>
          <Text style={styles.emptyTitle}>No salesmen yet</Text>
          <Text style={styles.emptySub}>Commission data will appear once salesmen are added</Text>
        </View>
      )}
    </>
  ), [entries.length, isLoading]);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <BackButton color={Colors.adminAccent} fallback="/(admin)" />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Commission</Text>
          <Text style={styles.headerSub}>Salesman Overview</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.adminAccent} />
          <Text style={styles.loadingText}>Loading salesmen…</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.salesmanId)}
          renderItem={({ item, index }) => (
            <SalesmanCard
              item={item}
              rank={index + 1}
              onPress={() => handleCardPress(item)}
              contributionPct={totalMonthSales > 0 ? Math.round((item.currentMonthSalesValue / totalMonthSales) * 100) : 0}
            />
          )}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Colors.adminAccent} />
          }
        />
      )}

      <MonthlyTotalsModal visible={showTotals} onClose={() => setShowTotals(false)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6FA" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerCenter: { alignItems: "center", flex: 1 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.adminText },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  list: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  sectionLabel: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  sectionLabelText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, letterSpacing: 0.3 },

  card: {
    backgroundColor: "#fff", borderRadius: 18, padding: 16, borderLeftWidth: 4,
    gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
  },
  rankBadge: { position: "absolute", top: 12, right: 12, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  rankText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 28 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  cardName: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.adminText },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  cardPhone: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  chipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  chipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  salesRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  salesLbl: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  salesVal: { fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 2 },
  progressWrap: { flex: 1, gap: 4, alignItems: "flex-end" },
  progressTrack: { width: "100%", height: 5, borderRadius: 3, backgroundColor: "#F1F5F9", overflow: "hidden" },
  progressFill: { height: 5, borderRadius: 3 },
  progressLbl: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  inactiveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  inactiveText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#CBD5E1" },
  empty: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 32 },
});

const banner = StyleSheet.create({
  wrap: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 18, marginBottom: 16,
    paddingVertical: 16, paddingHorizontal: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  item: { flex: 1, alignItems: "center", gap: 4 },
  divider: { width: 1, backgroundColor: Colors.border, marginVertical: 8 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 2 },
  val: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.adminText },
  lbl: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textAlign: "center" },
});

const mt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 0, paddingTop: 12,
    maxHeight: "88%",
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  sheetIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center" },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.adminText },
  sheetSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.border, justifyContent: "center", alignItems: "center" },
  loading: { paddingVertical: 40, alignItems: "center" },
  empty: { paddingVertical: 40, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },

  monthBlock: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: 16, paddingBottom: 8, gap: 10,
  },
  monthBlockFirst: { borderTopWidth: 0 },
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FEF3C7", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  monthLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  monthTotal: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.adminText, textAlign: "right" },
  monthOrders: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "right" },

  smRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  smAvatar: { width: 34, height: 34, borderRadius: 17, justifyContent: "center", alignItems: "center", marginTop: 2 },
  smAvatarText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  smNameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  smName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.adminText, flex: 1 },
  smAmt: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.adminText },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: "#F1F5F9", overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  pctLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
