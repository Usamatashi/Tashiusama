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
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

async function getToken() { return (await AsyncStorage.getItem("tashi_token")) || ""; }

interface BonusOrder {
  id: number;
  status: "pending" | "confirmed" | "cancelled";
  bonusPoints: number;
  totalPoints: number;
  totalValue: number;
  createdAt: string;
  retailerName: string | null;
  retailerPhone: string | null;
  items: Array<{ productName: string; quantity: number; bonusPoints: number; totalValue: number }>;
}

interface BonusSummary {
  totalBonus: number;
  confirmedBonus: number;
  totalSalesValue: number;
  confirmedSalesValue: number;
  totalOrders: number;
  orders: BonusOrder[];
}

function fmt(n: number) { return n.toLocaleString(); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "Pending",   color: "#D97706", bg: "#FEF9C3" },
  confirmed: { label: "Confirmed", color: "#059669", bg: "#DCFCE7" },
  cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2" },
};

function OrderCard({ order }: { order: BonusOrder }) {
  const meta = STATUS_META[order.status] ?? STATUS_META.pending;
  const retailer = order.retailerName || order.retailerPhone || "Unknown retailer";

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderRetailer} numberOfLines={1}>{retailer}</Text>
          <Text style={styles.orderDate}>{fmtDate(order.createdAt)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <View style={styles.orderStats}>
        <View style={styles.orderStat}>
          <Text style={styles.orderStatLabel}>Sale Value</Text>
          <Text style={styles.orderStatValue}>Rs. {fmt(order.totalValue)}</Text>
        </View>
        <View style={[styles.orderStat, styles.orderStatMid]}>
          <Text style={styles.orderStatLabel}>Points Earned</Text>
          <Text style={styles.orderStatValue}>{fmt(order.totalPoints)} pts</Text>
        </View>
        <View style={styles.orderStat}>
          <Text style={styles.orderStatLabel}>Commission</Text>
          <Text style={[styles.orderStatValue, order.status === "confirmed" ? { color: "#059669" } : {}]}>
            {fmt(order.bonusPoints)} pts
          </Text>
        </View>
      </View>

      {order.items && order.items.length > 0 && (
        <View style={styles.itemsList}>
          {order.items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={1}>{item.productName}</Text>
              <Text style={styles.itemQty}>×{item.quantity}</Text>
              <Text style={styles.itemBonus}>+{item.bonusPoints} pts</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function CommissionScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const { data, isLoading, refetch, isFetching } = useQuery<BonusSummary>({
    queryKey: ["my-bonus"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`${BASE}/orders/my-bonus`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const pendingBonus = (data?.totalBonus ?? 0) - (data?.confirmedBonus ?? 0);
  const activeOrders = (data?.orders ?? []).filter((o) => o.status !== "cancelled");
  const confirmedOrders = activeOrders.filter((o) => o.status === "confirmed");

  const renderHeader = useCallback(() => (
    <>
      <LinearGradient
        colors={["#065F46", "#059669", "#34D399"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroDec1} />
        <View style={styles.heroDec2} />
        <Text style={styles.heroLabel}>Confirmed Commission</Text>
        <Text style={styles.heroValue}>
          {isLoading ? "—" : `${fmt(data?.confirmedBonus ?? 0)} pts`}
        </Text>
        <Text style={styles.heroSub}>
          {isLoading ? "" : `from Rs. ${fmt(data?.confirmedSalesValue ?? 0)} confirmed sales`}
        </Text>
      </LinearGradient>

      <View style={styles.statRow}>
        <View style={[styles.statCard, { backgroundColor: "#FEF9C3" }]}>
          <Feather name="clock" size={16} color="#D97706" />
          <Text style={[styles.statVal, { color: "#D97706" }]}>{fmt(pendingBonus)} pts</Text>
          <Text style={styles.statLbl}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#EFF6FF" }]}>
          <Feather name="clipboard" size={16} color="#1D4ED8" />
          <Text style={[styles.statVal, { color: "#1D4ED8" }]}>{data?.totalOrders ?? 0}</Text>
          <Text style={styles.statLbl}>Active Orders</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#DCFCE7" }]}>
          <Feather name="check-circle" size={16} color="#059669" />
          <Text style={[styles.statVal, { color: "#059669" }]}>{confirmedOrders.length}</Text>
          <Text style={styles.statLbl}>Confirmed</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Order Breakdown</Text>

      {activeOrders.length === 0 && !isLoading && (
        <View style={styles.empty}>
          <Feather name="percent" size={44} color={Colors.textLight} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySub}>Your commission breakdown will appear here once you place orders</Text>
        </View>
      )}
    </>
  ), [data, isLoading, pendingBonus, confirmedOrders.length, activeOrders.length]);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={Colors.adminText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Commission</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : (
        <FlatList
          data={activeOrders}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <OrderCard order={item} />}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor="#059669" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F4F1" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.border, justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.adminText },
  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 12 },

  heroCard: {
    borderRadius: 22, padding: 24, marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#059669", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  heroDec1: {
    position: "absolute", width: 140, height: 140, borderRadius: 70,
    top: -40, right: -30, backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroDec2: {
    position: "absolute", width: 80, height: 80, borderRadius: 40,
    bottom: -20, right: 60, backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)", marginBottom: 6 },
  heroValue: { fontSize: 34, fontFamily: "Inter_700Bold", color: "#fff" },
  heroSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 4 },

  statRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  statCard: {
    flex: 1, borderRadius: 14, padding: 12,
    alignItems: "center", gap: 4,
  },
  statVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },

  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginBottom: 8 },

  orderCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    gap: 12,
  },
  orderHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  orderRetailer: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.adminText, maxWidth: 220 },
  orderDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  orderStats: { flexDirection: "row" },
  orderStat: { flex: 1, alignItems: "center", gap: 2 },
  orderStatMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.border },
  orderStatLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  orderStatValue: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.adminText },

  itemsList: { gap: 6, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemName: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  itemQty: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  itemBonus: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#059669" },

  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 24 },
});
