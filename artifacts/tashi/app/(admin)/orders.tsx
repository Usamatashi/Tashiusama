import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";

interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPoints: number;
  bonusPoints: number;
  totalValue: number;
}

interface Order {
  id: number;
  salesmanId: number;
  retailerId: number;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
  retailerName: string | null;
  retailerPhone: string | null;
  totalPoints: number;
  bonusPoints: number;
  totalValue: number;
  items: OrderItem[];
}

async function getToken() {
  return (await AsyncStorage.getItem("tashi_token")) || "";
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...opts?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error || "Request failed");
  return data as T;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#10B981",
  cancelled: "#EF4444",
};
const STATUS_BG: Record<string, string> = {
  pending: "#FEF3C7",
  confirmed: "#D1FAE5",
  cancelled: "#FEE2E2",
};

type FilterTab = "all" | "pending" | "confirmed" | "cancelled";

function OrderCard({
  order,
  onConfirm,
  onCancel,
  isUpdating,
}: {
  order: Order;
  onConfirm: (id: number) => void;
  onCancel: (id: number) => void;
  isUpdating: boolean;
}) {
  const date = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const items = order.items ?? [];
  const grandTotal = order.totalValue ?? items.reduce((s, i) => s + i.totalValue, 0);

  return (
    <View style={styles.card}>
      {/* ── Card header: retailer + date + status ── */}
      <View style={styles.cardHeader}>
        <View style={styles.avatarCircle}>
          <Feather name="user" size={16} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.retailerName} numberOfLines={1}>
            {order.retailerName || order.retailerPhone || "—"}
          </Text>
          <Text style={styles.cardDate}>{date}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: STATUS_BG[order.status] }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[order.status] }]}>
            {order.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ── Invoice-style line-item table ── */}
      <View style={styles.table}>
        {/* Column headers */}
        <View style={styles.tableRow}>
          <Text style={[styles.colHead, { flex: 3 }]}>PRODUCT</Text>
          <Text style={[styles.colHead, styles.colCenter, { flex: 1 }]}>QTY</Text>
          <Text style={[styles.colHead, styles.colRight, { flex: 2 }]}>PRICE</Text>
          <Text style={[styles.colHead, styles.colRight, { flex: 2 }]}>TOTAL</Text>
        </View>
        <View style={styles.tableDivider} />

        {/* Item rows */}
        {items.length === 0 ? (
          <View style={[styles.tableRow, { paddingVertical: 12 }]}>
            <Text style={[styles.colVal, { color: Colors.textLight }]}>No items</Text>
          </View>
        ) : (
          items.map((item, idx) => (
            <View key={idx} style={[styles.tableRow, { paddingVertical: 10 }]}>
              <Text style={[styles.colVal, { flex: 3 }]} numberOfLines={2}>
                {item.productName || "—"}
              </Text>
              <Text style={[styles.colVal, styles.colCenter, { flex: 1 }]}>
                {item.quantity}
              </Text>
              <Text style={[styles.colVal, styles.colRight, { flex: 2 }]}>
                {item.unitPrice > 0 ? item.unitPrice.toLocaleString() : "—"}
              </Text>
              <Text style={[styles.colVal, styles.colRight, styles.colTotal, { flex: 2 }]}>
                {item.totalValue > 0 ? item.totalValue.toLocaleString() : "—"}
              </Text>
            </View>
          ))
        )}

        {/* Total footer */}
        <View style={styles.totalFooter}>
          <Text style={styles.totalFooterLabel}>Order Total</Text>
          <Text style={styles.totalFooterValue}>
            Rs. {grandTotal.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* ── Actions (pending only) ── */}
      {order.status === "pending" && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.cancelBtn]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onCancel(order.id); }}
            disabled={isUpdating}
            activeOpacity={0.8}
          >
            <Feather name="x" size={15} color="#EF4444" />
            <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.confirmBtn]}
            onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onConfirm(order.id); }}
            disabled={isUpdating}
            activeOpacity={0.8}
          >
            {isUpdating
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <Feather name="check" size={15} color="#fff" />
                  <Text style={[styles.actionBtnText, { color: "#fff" }]}>Confirm</Text>
                </>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function AdminOrdersScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const { data: orders = [], isLoading, refetch, isRefetching } = useQuery<Order[]>({
    queryKey: ["admin-orders"],
    queryFn: () => apiFetch("/orders"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
    onMutate: ({ id }) => setUpdatingId(id),
    onSettled: () => {
      setUpdatingId(null);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });

  const handleConfirm = useCallback((id: number) => {
    updateStatus.mutate({ id, status: "confirmed" });
  }, [updateStatus]);

  const handleCancel = useCallback((id: number) => {
    updateStatus.mutate({ id, status: "cancelled" });
  }, [updateStatus]);

  const FILTERS: FilterTab[] = ["all", "pending", "confirmed", "cancelled"];
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const pendingCount = orders.filter(o => o.status === "pending").length;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Orders</Text>
        {pendingCount > 0 ? (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
          </View>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <Pressable
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Feather name="clipboard" size={52} color={Colors.border} />
          <Text style={styles.emptyTitle}>No {filter === "all" ? "" : filter} orders</Text>
          <Text style={styles.emptyText}>Orders will appear here once placed</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              isUpdating={updatingId === item.id}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad + 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F8FA" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  pendingBadge: {
    minWidth: 28, height: 28, borderRadius: 14,
    backgroundColor: "#FBBF24",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 8,
  },
  pendingBadgeText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },

  filterRow: {
    flexDirection: "row", gap: 8, padding: 12, paddingHorizontal: 16,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: "#F0F0F0",
  },
  filterTabActive: { backgroundColor: Colors.primary },
  filterTabText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  filterTabTextActive: { color: "#fff" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#F5F5F5",
    backgroundColor: "#FAFAFA",
  },
  avatarCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${Colors.primary}18`,
    alignItems: "center", justifyContent: "center",
  },
  retailerName: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  cardDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textLight, marginTop: 2 },
  statusPill: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },

  table: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 },
  tableRow: { flexDirection: "row", alignItems: "center" },
  tableDivider: { height: 1, backgroundColor: "#EEEEEE", marginVertical: 8 },
  colHead: {
    fontSize: 10, fontFamily: "Inter_700Bold",
    color: Colors.textLight, letterSpacing: 0.7, textTransform: "uppercase",
  },
  colVal: {
    fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text,
  },
  colCenter: { textAlign: "center" },
  colRight: { textAlign: "right" },
  colTotal: { color: Colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 },

  pointsRow: {
    flexDirection: "row", gap: 8, paddingTop: 10, paddingBottom: 4,
    borderTopWidth: 1, borderTopColor: "#F0F0F0", marginTop: 4,
  },
  pointsBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: `${Colors.primary}12`,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
  },
  pointsBadgeText: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary,
  },

  totalFooter: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderTopWidth: 1, borderTopColor: "#EEEEEE",
    marginTop: 8, paddingTop: 12, paddingBottom: 14,
  },
  totalFooterLabel: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  totalFooterValue: {
    fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text,
  },

  actionRow: {
    flexDirection: "row", gap: 10, padding: 14,
    borderTopWidth: 1, borderTopColor: "#F0F0F0",
    backgroundColor: "#FAFAFA",
  },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 11, borderRadius: 10,
  },
  confirmBtn: { backgroundColor: "#10B981" },
  cancelBtn: { backgroundColor: "#FEE2E2" },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
});
