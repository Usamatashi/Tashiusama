import React, { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
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
}

// Deterministic accent color per salesman (cycles through palette)
const AVATAR_COLORS = ["#E87722", "#7C3AED", "#0EA5E9", "#059669", "#DC2626", "#D97706"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

// ─── Summary Banner ────────────────────────────────────────────────────────────
function SummaryBanner({ entries }: { entries: CommissionEntry[] }) {
  const active = entries.filter((e) => e.totalOrders > 0);
  const totalSales = entries.reduce((s, e) => s + e.totalSalesValue, 0);

  return (
    <View style={banner.wrap}>
      <View style={banner.item}>
        <Text style={banner.val}>{entries.length}</Text>
        <Text style={banner.lbl}>Total Salesmen</Text>
      </View>
      <View style={banner.divider} />
      <View style={banner.item}>
        <Text style={[banner.val, { color: "#059669" }]}>{active.length}</Text>
        <Text style={banner.lbl}>With Orders</Text>
      </View>
      <View style={banner.divider} />
      <View style={banner.item}>
        <Text style={[banner.val, { color: Colors.adminAccent, fontSize: 13 }]}>
          Rs.{" "}{totalSales >= 1000 ? `${(totalSales / 1000).toFixed(0)}k` : totalSales.toLocaleString()}
        </Text>
        <Text style={banner.lbl}>Total Sales</Text>
      </View>
    </View>
  );
}

// ─── Salesman Card ─────────────────────────────────────────────────────────────
function SalesmanCard({ item, rank, onPress }: { item: CommissionEntry; rank: number; onPress: () => void }) {
  const displayName = item.name || item.phone;
  const initials = displayName.slice(0, 2).toUpperCase();
  const hasOrders = item.totalOrders > 0;
  const color = avatarColor(item.salesmanId);
  const confirmedPct = item.totalOrders > 0 ? Math.round((item.confirmedOrders / item.totalOrders) * 100) : 0;

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

      {/* Top row: avatar + name + chevron */}
      <View style={styles.topRow}>
        <View style={[styles.avatar, { backgroundColor: color, opacity: hasOrders ? 1 : 0.45 }]}>
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
        <>
          {/* Chip row */}
          <View style={styles.chipRow}>
            <View style={[styles.chip, { backgroundColor: "#EFF6FF" }]}>
              <Feather name="shopping-bag" size={11} color="#1D4ED8" />
              <Text style={[styles.chipText, { color: "#1D4ED8" }]}>{item.totalOrders} orders</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: "#DCFCE7" }]}>
              <Feather name="check" size={11} color="#059669" />
              <Text style={[styles.chipText, { color: "#059669" }]}>{item.confirmedOrders} confirmed</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: "#FEF3C7" }]}>
              <Feather name="star" size={11} color={Colors.adminAccent} />
              <Text style={[styles.chipText, { color: Colors.adminAccent }]}>{item.totalBonus} pts</Text>
            </View>
          </View>

          {/* Sales value + progress bar */}
          <View style={styles.salesRow}>
            <View>
              <Text style={styles.salesLbl}>Total Sales</Text>
              <Text style={[styles.salesVal, { color }]}>Rs. {item.totalSalesValue.toLocaleString()}</Text>
            </View>
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${confirmedPct}%`, backgroundColor: color }]} />
              </View>
              <Text style={styles.progressLbl}>{confirmedPct}% confirmed</Text>
            </View>
          </View>
        </>
      )}

      {/* Inactive salesman notice */}
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

  // Sort: active (with orders) first, then inactive
  const entries = [...(data ?? [])].sort((a, b) => {
    if (a.totalOrders > 0 && b.totalOrders === 0) return -1;
    if (a.totalOrders === 0 && b.totalOrders > 0) return 1;
    return b.totalSalesValue - a.totalSalesValue;
  });

  function handleCardPress(item: CommissionEntry) {
    router.push({
      pathname: "/(admin)/salesman-detail",
      params: { id: String(item.salesmanId), name: item.name ?? "", phone: item.phone },
    });
  }

  const renderHeader = useCallback(() => (
    <>
      {entries.length > 0 && <SummaryBanner entries={entries} />}
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
      {/* Header */}
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
            <SalesmanCard item={item} rank={index + 1} onPress={() => handleCardPress(item)} />
          )}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Colors.adminAccent} />
          }
        />
      )}
    </View>
  );
}

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
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderLeftWidth: 4,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },

  rankBadge: {
    position: "absolute", top: 12, right: 12,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  rankText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  topRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 28 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: "center", alignItems: "center",
  },
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
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 32 },
});

const banner = StyleSheet.create({
  wrap: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 18, marginBottom: 16,
    paddingVertical: 16, paddingHorizontal: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  item: { flex: 1, alignItems: "center", gap: 3 },
  divider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  val: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminText },
  lbl: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textAlign: "center" },
});
