import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useAdminSettings } from "@/context/AdminSettingsContext";
import { Colors } from "@/constants/colors";

async function getToken() { return (await AsyncStorage.getItem("tashi_token")) || ""; }
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error || "Request failed");
  return data as T;
}

interface RetailerBalance {
  id: number; name: string | null; phone: string; city: string | null;
  totalOrdered: number; totalPaid: number; outstanding: number;
}
interface Payment {
  id: number; amount: number; notes: string | null; createdAt: string;
  retailerName: string | null; retailerPhone: string | null;
  collectorName: string | null;
}

type Tab = "balances" | "history";

function fmt(n: number) { return n.toLocaleString(); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function BalanceCard({ item, onCollect }: { item: RetailerBalance; onCollect: (r: RetailerBalance) => void }) {
  const isCredit = item.outstanding < 0;
  const outstandingColor = item.outstanding === 0 ? "#10B981" : isCredit ? "#10B981" : "#EF4444";
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatarCircle}>
          <Feather name="user" size={16} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name || item.phone}</Text>
          <Text style={styles.cardSub}>{item.phone}{item.city ? ` · ${item.city}` : ""}</Text>
        </View>
        {item.outstanding > 0 && (
          <TouchableOpacity style={styles.collectBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onCollect(item); }} activeOpacity={0.8}>
            <Feather name="dollar-sign" size={13} color="#fff" />
            <Text style={styles.collectBtnText}>Collect</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.balanceRow}>
        <View style={styles.balanceCell}>
          <Text style={styles.balanceCellLabel}>Ordered</Text>
          <Text style={styles.balanceCellValue}>Rs. {fmt(item.totalOrdered)}</Text>
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.balanceCell}>
          <Text style={styles.balanceCellLabel}>Paid</Text>
          <Text style={[styles.balanceCellValue, { color: "#10B981" }]}>Rs. {fmt(item.totalPaid)}</Text>
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.balanceCell}>
          <Text style={styles.balanceCellLabel}>{isCredit ? "Credit" : "Balance Due"}</Text>
          <Text style={[styles.balanceCellValue, { color: outstandingColor, fontFamily: "Inter_700Bold" }]}>
            Rs. {fmt(Math.abs(item.outstanding))}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PaymentHistoryCard({ item }: { item: Payment }) {
  return (
    <View style={styles.historyCard}>
      <View style={styles.historyLeft}>
        <View style={styles.cashIcon}>
          <Feather name="arrow-down-circle" size={18} color="#10B981" />
        </View>
        <View>
          <Text style={styles.historyRetailer} numberOfLines={1}>{item.retailerName || item.retailerPhone || "Retailer"}</Text>
          <Text style={styles.historySub}>via {item.collectorName || "Staff"} · {fmtDate(item.createdAt)}</Text>
          {item.notes ? <Text style={styles.historyNotes} numberOfLines={1}>{item.notes}</Text> : null}
        </View>
      </View>
      <Text style={styles.historyAmount}>+ Rs. {fmt(item.amount)}</Text>
    </View>
  );
}

export default function AdminPaymentsScreen() {
  const { user } = useAuth();
  const { settings } = useAdminSettings();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const [tab, setTab] = useState<Tab>("balances");
  const [collectTarget, setCollectTarget] = useState<RetailerBalance | null>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { data: balances = [], isLoading: loadingBalances, refetch: refetchBalances, isRefetching: refetchingBalances } = useQuery<RetailerBalance[]>({
    queryKey: ["admin-retailer-balances"],
    queryFn: () => apiFetch("/payments/retailer-balances"),
  });

  const { data: payments = [], isLoading: loadingHistory, refetch: refetchHistory, isRefetching: refetchingHistory } = useQuery<Payment[]>({
    queryKey: ["admin-payments"],
    queryFn: () => apiFetch("/payments"),
  });

  const recordPayment = useMutation({
    mutationFn: ({ retailerId, amount, notes }: { retailerId: number; amount: number; notes: string }) =>
      apiFetch("/payments", { method: "POST", body: JSON.stringify({ retailerId, amount, notes }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-retailer-balances"] });
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      setCollectTarget(null); setAmount(""); setNotes("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleCollect = useCallback(() => {
    if (!collectTarget || !amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    recordPayment.mutate({ retailerId: collectTarget.id, amount: Number(amount), notes });
  }, [collectTarget, amount, notes, recordPayment]);

  const totalOutstanding = balances.reduce((s, b) => s + Math.max(0, b.outstanding), 0);
  const totalPaidAll = balances.reduce((s, b) => s + b.totalPaid, 0);

  if (user?.role !== "super_admin" && !settings.tab_payments) return <Redirect href="/(admin)" />;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payments</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryCellLabel}>Total Collected</Text>
          <Text style={[styles.summaryCellValue, { color: "#10B981" }]}>Rs. {fmt(totalPaidAll)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCell}>
          <Text style={styles.summaryCellLabel}>Outstanding</Text>
          <Text style={[styles.summaryCellValue, { color: totalOutstanding > 0 ? "#EF4444" : Colors.text }]}>Rs. {fmt(totalOutstanding)}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(["balances", "history"] as Tab[]).map(t => (
          <Pressable key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t === "balances" ? "Retailer Balances" : "Payment History"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "balances" ? (
        loadingBalances ? (
          <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
        ) : balances.length === 0 ? (
          <View style={styles.center}>
            <Feather name="users" size={48} color={Colors.border} />
            <Text style={styles.emptyTitle}>No retailers yet</Text>
          </View>
        ) : (
          <FlatList
            data={balances}
            keyExtractor={i => String(i.id)}
            renderItem={({ item }) => <BalanceCard item={item} onCollect={setCollectTarget} />}
            contentContainerStyle={{ padding: 16, paddingBottom: botPad + 20 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refetchingBalances} onRefresh={refetchBalances} tintColor={Colors.primary} />}
          />
        )
      ) : (
        loadingHistory ? (
          <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
        ) : payments.length === 0 ? (
          <View style={styles.center}>
            <Feather name="credit-card" size={48} color={Colors.border} />
            <Text style={styles.emptyTitle}>No payments yet</Text>
            <Text style={styles.emptyText}>Payments will appear here once collected</Text>
          </View>
        ) : (
          <FlatList
            data={payments}
            keyExtractor={i => String(i.id)}
            renderItem={({ item }) => <PaymentHistoryCard item={item} />}
            contentContainerStyle={{ padding: 16, paddingBottom: botPad + 20 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refetchingHistory} onRefresh={refetchHistory} tintColor={Colors.primary} />}
          />
        )
      )}

      {/* Collect Payment Modal */}
      <Modal visible={!!collectTarget} transparent animationType="slide" onRequestClose={() => setCollectTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setCollectTarget(null)} />
          <View style={[styles.modalSheet, { paddingBottom: botPad + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Record Cash Payment</Text>
            {collectTarget && (
              <>
                <View style={styles.modalRetailerRow}>
                  <Feather name="user" size={15} color={Colors.primary} />
                  <Text style={styles.modalRetailerName}>{collectTarget.name || collectTarget.phone}</Text>
                  <Text style={styles.modalRetailerBalance}>Balance Due: Rs. {fmt(collectTarget.outstanding)}</Text>
                </View>
                <Text style={styles.fieldLabel}>Amount Received (Rs.)</Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="e.g. 50000"
                  placeholderTextColor={Colors.textLight}
                  autoFocus
                />
                <Text style={styles.fieldLabel}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, { height: 70 }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. Partial payment for March"
                  placeholderTextColor={Colors.textLight}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.confirmBtn, (!amount || recordPayment.isPending) && { opacity: 0.5 }]}
                  onPress={handleCollect}
                  disabled={!amount || recordPayment.isPending}
                  activeOpacity={0.8}
                >
                  {recordPayment.isPending
                    ? <ActivityIndicator color="#fff" />
                    : <><Feather name="check-circle" size={18} color="#fff" /><Text style={styles.confirmBtnText}>Confirm Payment</Text></>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F8FA" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  summaryBar: {
    flexDirection: "row", backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  summaryCell: { flex: 1, alignItems: "center", gap: 4 },
  summaryCellLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryCellValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  tabRow: {
    flexDirection: "row", backgroundColor: "#fff", gap: 8, padding: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: "#F0F0F0", alignItems: "center" },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  tabBtnTextActive: { color: "#fff" },
  card: {
    backgroundColor: "#fff", borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#F0F0F0",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${Colors.primary}18`, alignItems: "center", justifyContent: "center" },
  cardName: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  collectBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#10B981", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  collectBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  balanceRow: { flexDirection: "row", paddingVertical: 14 },
  balanceCell: { flex: 1, alignItems: "center", gap: 4 },
  balanceCellLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  balanceCellValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  balanceDivider: { width: 1, backgroundColor: "#EEEEEE" },
  historyCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#F0F0F0",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  historyLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  cashIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center" },
  historyRetailer: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text },
  historySub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  historyNotes: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textLight, fontStyle: "italic", marginTop: 1 },
  historyAmount: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#10B981" },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 12, gap: 14 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0", alignSelf: "center", marginBottom: 8 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  modalRetailerRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  modalRetailerName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text, flex: 1 },
  modalRetailerBalance: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#EF4444" },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.text,
    backgroundColor: "#FAFAFA",
  },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#10B981", borderRadius: 14, paddingVertical: 15,
  },
  confirmBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});
