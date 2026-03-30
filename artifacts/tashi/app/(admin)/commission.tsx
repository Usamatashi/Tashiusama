import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
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

function fmt(n: number) { return n.toLocaleString(); }

function SalesmanCard({ item }: { item: CommissionEntry }) {
  const displayName = item.name || item.phone;
  const initials = displayName.slice(0, 2).toUpperCase();
  const conversionRate = item.totalOrders > 0
    ? Math.round((item.confirmedOrders / item.totalOrders) * 100)
    : 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.cardPhone}>{item.phone}</Text>
        </View>
        <View style={[styles.convBadge, { backgroundColor: conversionRate >= 60 ? "#DCFCE7" : conversionRate >= 30 ? "#FEF9C3" : "#FEE2E2" }]}>
          <Text style={[styles.convText, { color: conversionRate >= 60 ? "#15803D" : conversionRate >= 30 ? "#92400E" : "#B91C1C" }]}>
            {conversionRate}% conv.
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total Orders</Text>
          <Text style={styles.statValue}>{item.totalOrders}</Text>
          <Text style={styles.statSub}>{item.confirmedOrders} confirmed</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxMid]}>
          <Text style={styles.statLabel}>Sales Value</Text>
          <Text style={[styles.statValue, { color: "#1D4ED8" }]}>Rs. {fmt(item.confirmedSalesValue)}</Text>
          <Text style={styles.statSub}>of Rs. {fmt(item.totalSalesValue)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Commission</Text>
          <Text style={[styles.statValue, { color: "#059669" }]}>{fmt(item.confirmedBonus)} pts</Text>
          <Text style={styles.statSub}>{fmt(item.totalBonus)} total</Text>
        </View>
      </View>

      {item.totalOrders > 0 && (
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${conversionRate}%` as any, backgroundColor: conversionRate >= 60 ? "#059669" : conversionRate >= 30 ? "#D97706" : "#DC2626" }]} />
        </View>
      )}
    </View>
  );
}

export default function CommissionScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
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
  const totalCommission = (data ?? []).reduce((s, e) => s + e.confirmedBonus, 0);
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
          <Feather name="award" size={16} color="#D97706" />
          <Text style={[styles.summaryVal, { color: "#D97706" }]}>{fmt(totalCommission)}</Text>
          <Text style={styles.summarySub}>Total Pts Earned</Text>
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
  ), [totalSalesmen, totalConfirmedSales, totalCommission, search, entries.length, isLoading]);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={Colors.adminText} />
        </TouchableOpacity>
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
          renderItem={({ item }) => <SalesmanCard item={item} />}
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
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.border, justifyContent: "center", alignItems: "center",
  },
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
  convBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  convText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

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
