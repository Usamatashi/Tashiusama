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

// ─── Salesman Card ─────────────────────────────────────────────────────────────
function SalesmanCard({ item, onPress }: { item: CommissionEntry; onPress: () => void }) {
  const displayName = item.name || item.phone;
  const initials = displayName.slice(0, 2).toUpperCase();
  const hasOrders = item.totalOrders > 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, !hasOrders && { backgroundColor: "#94A3B8" }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.cardPhone}>{item.phone}</Text>
        </View>
        {hasOrders ? (
          <View style={styles.calcBadge}>
            <Feather name="percent" size={12} color={Colors.adminAccent} />
            <Text style={styles.calcText}>Calculate</Text>
          </View>
        ) : (
          <View style={styles.noOrderBadge}>
            <Feather name="minus-circle" size={12} color="#94A3B8" />
            <Text style={styles.noOrderText}>No Orders</Text>
          </View>
        )}
      </View>

      {/* Order stats row — only when orders exist */}
      {hasOrders && (
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{item.totalOrders}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxMid]}>
            <Text style={[styles.statValue, { color: "#059669" }]}>{item.confirmedOrders}</Text>
            <Text style={styles.statLabel}>Confirmed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: Colors.adminAccent, fontSize: 12 }]}>
              Rs. {item.totalSalesValue.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Sales Value</Text>
          </View>
        </View>
      )}

      {/* No-orders notice */}
      {!hasOrders && (
        <View style={styles.noOrderRow}>
          <Feather name="info" size={13} color="#94A3B8" />
          <Text style={styles.noOrderNotice}>No orders placed yet</Text>
        </View>
      )}

      {/* Tap hint */}
      <View style={styles.tapHint}>
        <Text style={styles.tapHintText}>Tap to view monthly breakdown</Text>
        <Feather name="chevron-right" size={13} color={Colors.textLight} />
      </View>
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

  const entries = data ?? [];

  const renderHeader = useCallback(() => (
    <>
      {entries.length === 0 && !isLoading && (
        <View style={styles.empty}>
          <Feather name="percent" size={44} color={Colors.textLight} />
          <Text style={styles.emptyTitle}>No salesmen yet</Text>
          <Text style={styles.emptySub}>Commission data will appear once salesmen are added</Text>
        </View>
      )}
    </>
  ), [entries.length, isLoading]);

  function handleCardPress(item: CommissionEntry) {
    router.push({
      pathname: "/(admin)/salesman-detail",
      params: {
        id: String(item.salesmanId),
        name: item.name ?? "",
        phone: item.phone,
      },
    });
  }

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
            <SalesmanCard item={item} onPress={() => handleCardPress(item)} />
          )}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Colors.adminAccent} />}
        />
      )}
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
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.adminText },
  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 12 },

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

  noOrderBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  noOrderText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#94A3B8" },

  noOrderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  noOrderNotice: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8" },

  statsGrid: { flexDirection: "row" },
  statBox: { flex: 1, alignItems: "center", gap: 2 },
  statBoxMid: {
    borderLeftWidth: 1, borderRightWidth: 1,
    borderLeftColor: Colors.border, borderRightColor: Colors.border,
  },
  statLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  statValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.adminText },

  tapHint: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  tapHintText: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textLight },

  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 24 },
});
