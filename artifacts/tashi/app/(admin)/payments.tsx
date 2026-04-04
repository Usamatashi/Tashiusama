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
import { BackButton } from "@/components/BackButton";

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
  status: "pending" | "verified";
  verifiedAt: string | null;
  verifiedByName: string | null;
  retailerName: string | null; retailerPhone: string | null;
  collectorName: string | null;
}

type Tab = "balances" | "history" | "pending";

function fmt(n: number) { return n.toLocaleString(); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: "pending" | "verified" }) {
  const verified = status === "verified";
  return (
    <View style={[styles.badge, verified ? styles.badgeVerified : styles.badgePending]}>
      <Feather name={verified ? "check-circle" : "clock"} size={10} color={verified ? "#065F46" : "#92400E"} />
      <Text style={[styles.badgeText, { color: verified ? "#065F46" : "#92400E" }]}>
        {verified ? "Verified" : "Pending"}
      </Text>
    </View>
  );
}

function BalanceCard({ item }: { item: RetailerBalance }) {
  const isCredit = item.outstanding < 0;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatarCircle}>
          <Feather name="user" size={16} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name || item.phone}</Text>
          <Text style={styles.cardSub}>{item.phone}</Text>
          <Text style={styles.cardSub}>{item.city || "—"}</Text>
        </View>
        <View style={styles.dueBox}>
          <Text style={styles.dueBoxLabel}>{isCredit ? "Credit" : "Due"}</Text>
          <Text style={styles.dueBoxAmount}>
            Rs. {fmt(Math.abs(item.outstanding))}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PaymentHistoryCard({ item, onVerify, verifying }: { item: Payment; onVerify?: (id: number) => void; verifying?: boolean }) {
  return (
    <View style={styles.historyCard}>
      <View style={styles.historyLeft}>
        <View style={[styles.cashIcon, item.status === "verified" ? styles.cashIconVerified : styles.cashIconPending]}>
          <Feather name={item.status === "verified" ? "check-circle" : "clock"} size={18} color={item.status === "verified" ? "#10B981" : "#D97706"} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.historyRetailer} numberOfLines={1}>{item.retailerName || item.retailerPhone || "Retailer"}</Text>
          <Text style={styles.historySub}>by {item.collectorName || "Staff"} · {fmtDate(item.createdAt)}</Text>
          {item.notes ? <Text style={styles.historyNotes} numberOfLines={1}>{item.notes}</Text> : null}
          {item.status === "verified" && item.verifiedByName ? (
            <Text style={styles.verifiedNote}>Verified by {item.verifiedByName}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.historyRight}>
        <Text style={styles.historyAmount}>Rs. {fmt(item.amount)}</Text>
        <StatusBadge status={item.status} />
        {item.status === "pending" && onVerify && (
          <TouchableOpacity
            style={[styles.verifyBtn, verifying && { opacity: 0.5 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onVerify(item.id); }}
            disabled={verifying}
            activeOpacity={0.8}
          >
            {verifying ? <ActivityIndicator size="small" color="#fff" /> : (
              <><Feather name="check" size={12} color="#fff" /><Text style={styles.verifyBtnText}>Verify</Text></>
            )}
          </TouchableOpacity>
        )}
      </View>
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

  const [tab, setTab] = useState<Tab>("balances"); // balances=Outstanding, history=Collected, pending=Awaiting
  const [collectTarget, setCollectTarget] = useState<RetailerBalance | null>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const { data: balances = [], isLoading: loadingBalances, refetch: refetchBalances, isRefetching: refetchingBalances } = useQuery<RetailerBalance[]>({
    queryKey: ["admin-retailer-balances"],
    queryFn: () => apiFetch("/payments/retailer-balances"),
  });

  const { data: payments = [], isLoading: loadingHistory, refetch: refetchHistory, isRefetching: refetchingHistory } = useQuery<Payment[]>({
    queryKey: ["admin-payments"],
    queryFn: () => apiFetch("/payments"),
  });

  const pendingPayments = payments.filter(p => p.status === "pending");

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

  const verifyPayment = useMutation({
    mutationFn: (paymentId: number) =>
      apiFetch(`/payments/${paymentId}/verify`, { method: "PATCH" }),
    onMutate: (paymentId) => setVerifyingId(paymentId),
    onSettled: () => setVerifyingId(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-retailer-balances"] });
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
      <View style={styles.header}>
        <BackButton color={Colors.adminAccent} fallback="/(admin)" />
        <Text style={styles.headerTitle}>Payments</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Summary banner — each cell is a nav button */}
      <View style={styles.summaryBar}>
        {/* Outstanding */}
        <TouchableOpacity
          style={[styles.summaryCell, tab === "balances" && styles.summaryCellRedActive]}
          onPress={() => setTab("balances")}
          activeOpacity={0.85}
        >
          <View style={[styles.summaryDot, { backgroundColor: tab === "balances" ? "#EF4444" : "#FECACA" }]} />
          <Text style={[styles.summaryCellValue, { color: "#EF4444" }]} numberOfLines={1} adjustsFontSizeToFit>
            Rs. {fmt(totalOutstanding)}
          </Text>
          <Text style={[styles.summaryCellLabel, tab === "balances" && { color: "#EF4444", fontFamily: "Inter_700Bold" }]}>
            Outstanding
          </Text>
          {tab === "balances" && <View style={[styles.summaryActiveLine, { backgroundColor: "#EF4444" }]} />}
        </TouchableOpacity>

        <View style={styles.summaryDivider} />

        {/* Total Collected */}
        <TouchableOpacity
          style={[styles.summaryCell, tab === "history" && styles.summaryCellGreenActive]}
          onPress={() => setTab("history")}
          activeOpacity={0.85}
        >
          <View style={[styles.summaryDot, { backgroundColor: tab === "history" ? "#10B981" : "#A7F3D0" }]} />
          <Text style={[styles.summaryCellValue, { color: "#059669" }]} numberOfLines={1} adjustsFontSizeToFit>
            Rs. {fmt(totalPaidAll)}
          </Text>
          <Text style={[styles.summaryCellLabel, tab === "history" && { color: "#059669", fontFamily: "Inter_700Bold" }]}>
            Collected
          </Text>
          {tab === "history" && <View style={[styles.summaryActiveLine, { backgroundColor: "#10B981" }]} />}
        </TouchableOpacity>

        <View style={styles.summaryDivider} />

        {/* Awaiting — smaller */}
        <TouchableOpacity
          style={[styles.summaryCellSmall, tab === "pending" && styles.summaryCellAmberActive]}
          onPress={() => setTab("pending")}
          activeOpacity={0.85}
        >
          <View style={[styles.summaryDot, { backgroundColor: tab === "pending" ? "#D97706" : "#FDE68A" }]} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={[styles.summaryCellValueSmall, { color: pendingPayments.length > 0 ? "#D97706" : Colors.textSecondary }]}>
              {pendingPayments.length}
            </Text>
            {pendingPayments.length > 0 && (
              <View style={styles.awaitingBadge}>
                <Text style={styles.awaitingBadgeText}>!</Text>
              </View>
            )}
          </View>
          <Text style={[styles.summaryCellLabelSmall, tab === "pending" && { color: "#D97706", fontFamily: "Inter_700Bold" }]}>
            Awaiting
          </Text>
          {tab === "pending" && <View style={[styles.summaryActiveLine, { backgroundColor: "#D97706" }]} />}
        </TouchableOpacity>
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
            renderItem={({ item }) => <BalanceCard item={item} />}
            contentContainerStyle={{ padding: 16, paddingBottom: botPad + 20 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refetchingBalances} onRefresh={refetchBalances} tintColor={Colors.primary} />}
          />
        )
      ) : tab === "history" ? (
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
            renderItem={({ item }) => (
              <PaymentHistoryCard
                item={item}
                onVerify={id => verifyPayment.mutate(id)}
                verifying={verifyingId === item.id}
              />
            )}
            contentContainerStyle={{ padding: 16, paddingBottom: botPad + 20 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refetchingHistory} onRefresh={refetchHistory} tintColor={Colors.primary} />}
          />
        )
      ) : (
        loadingHistory ? (
          <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
        ) : pendingPayments.length === 0 ? (
          <View style={styles.center}>
            <Feather name="check-circle" size={48} color="#10B981" />
            <Text style={styles.emptyTitle}>All verified</Text>
            <Text style={styles.emptyText}>No payments awaiting verification</Text>
          </View>
        ) : (
          <FlatList
            data={pendingPayments}
            keyExtractor={i => String(i.id)}
            renderItem={({ item }) => (
              <PaymentHistoryCard
                item={item}
                onVerify={id => verifyPayment.mutate(id)}
                verifying={verifyingId === item.id}
              />
            )}
            contentContainerStyle={{ padding: 16, paddingBottom: botPad + 20 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refetchingHistory} onRefresh={refetchHistory} tintColor={Colors.primary} />}
            ListHeaderComponent={
              <View style={styles.pendingHeader}>
                <Feather name="alert-circle" size={15} color="#D97706" />
                <Text style={styles.pendingHeaderText}>{pendingPayments.length} payment{pendingPayments.length !== 1 ? "s" : ""} awaiting your verification</Text>
              </View>
            }
          />
        )
      )}

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
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${Colors.adminAccent}18`, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  summaryBar: {
    flexDirection: "row", backgroundColor: "#fff",
    marginHorizontal: 14, marginTop: 14, marginBottom: 4,
    borderRadius: 20, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09, shadowRadius: 14, elevation: 5,
  },
  summaryCell: {
    flex: 1, alignItems: "center", gap: 3,
    paddingTop: 14, paddingBottom: 12, paddingHorizontal: 6,
    position: "relative",
  },
  summaryCellSmall: {
    flex: 0.58, alignItems: "center", gap: 3,
    paddingTop: 14, paddingBottom: 12, paddingHorizontal: 6,
    position: "relative",
  },
  summaryCellRedActive: { backgroundColor: "#FFF5F5" },
  summaryCellGreenActive: { backgroundColor: "#F0FDF9" },
  summaryCellAmberActive: { backgroundColor: "#FFFBEB" },
  summaryDot: {
    width: 7, height: 7, borderRadius: 4, marginBottom: 2,
  },
  summaryCellLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.4 },
  summaryCellLabelSmall: { fontSize: 9, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.4 },
  summaryCellValue: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  summaryCellValueSmall: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  summaryDivider: { width: 1, backgroundColor: "#F0F0F0", marginVertical: 14 },
  summaryActiveLine: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: 3, borderRadius: 0,
  },
  awaitingBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#D97706", alignItems: "center", justifyContent: "center",
  },
  awaitingBadgeText: { fontSize: 9, fontFamily: "Inter_800ExtraBold", color: "#fff" },
  card: {
    backgroundColor: "#fff", borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#F0F0F0",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${Colors.primary}18`, alignItems: "center", justifyContent: "center" },
  cardName: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  dueBox: {
    borderWidth: 1.5, borderColor: "#EF4444", borderRadius: 10,
    paddingVertical: 6, paddingHorizontal: 10,
    alignItems: "center", minWidth: 80, backgroundColor: "#fff",
  },
  dueBoxLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#EF4444", textTransform: "uppercase", letterSpacing: 0.5 },
  dueBoxAmount: { fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 2, color: "#EF4444" },
  historyCard: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#F0F0F0",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  historyLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1 },
  historyRight: { alignItems: "flex-end", gap: 6 },
  cashIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  cashIconVerified: { backgroundColor: "#D1FAE5" },
  cashIconPending: { backgroundColor: "#FEF3C7" },
  historyRetailer: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text },
  historySub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  historyNotes: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textLight, fontStyle: "italic", marginTop: 1 },
  verifiedNote: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#10B981", marginTop: 2 },
  historyAmount: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#10B981" },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  badgeVerified: { backgroundColor: "#D1FAE5" },
  badgePending: { backgroundColor: "#FEF3C7" },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  verifyBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  verifyBtnText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  pendingHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF3C7", borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  pendingHeaderText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#92400E", flex: 1 },
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
