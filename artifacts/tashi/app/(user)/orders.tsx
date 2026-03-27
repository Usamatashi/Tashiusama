import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { Colors } from "@/constants/colors";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Retailer { id: number; name: string | null; phone: string; city: string | null; }
interface Vehicle  { id: number; name: string; points: number; }
interface Order {
  id: number; quantity: number; totalPoints: number; bonusPoints: number;
  status: "pending" | "confirmed" | "cancelled";
  vehicleName: string | null; retailerName: string | null; retailerPhone: string | null;
  createdAt: string;
}

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

// ─── Step indicator ──────────────────────────────────────────────────────────
function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
      {done
        ? <Feather name="check" size={12} color={Colors.white} />
        : <Text style={[styles.stepDotText, active && styles.stepDotTextActive]}>{n}</Text>}
    </View>
  );
}

function StepBar({ step }: { step: number }) {
  return (
    <View style={styles.stepBar}>
      <StepDot n={1} active={step === 1} done={step > 1} />
      <View style={[styles.stepLine, step > 1 && styles.stepLineDone]} />
      <StepDot n={2} active={step === 2} done={step > 2} />
      <View style={[styles.stepLine, step > 2 && styles.stepLineDone]} />
      <StepDot n={3} active={step === 3} done={step > 3} />
    </View>
  );
}

// ─── Order Card ──────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  pending: "#F59E0B", confirmed: "#10B981", cancelled: "#EF4444",
};

function OrderCard({ order }: { order: Order }) {
  const date = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderCardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderVehicle}>{order.vehicleName ?? "—"}</Text>
          <Text style={styles.orderRetailer}>
            {order.retailerName ?? order.retailerPhone ?? "Retailer"}
          </Text>
          <Text style={styles.orderDate}>{date}</Text>
        </View>
        <View style={styles.orderRight}>
          <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLOR[order.status]}20` }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[order.status] }]}>
              {order.status.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.orderQty}>×{order.quantity} units</Text>
        </View>
      </View>
      <View style={styles.orderCardBottom}>
        <View style={styles.orderStat}>
          <Feather name="star" size={13} color={Colors.primary} />
          <Text style={styles.orderStatText}>{order.totalPoints} pts customer</Text>
        </View>
        <View style={styles.orderStat}>
          <Feather name="gift" size={13} color="#10B981" />
          <Text style={[styles.orderStatText, { color: "#10B981" }]}>{order.bonusPoints} bonus pts</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [submitError, setSubmitError] = useState("");

  // Fetch orders list
  const { data: orders = [], isLoading: loadingOrders } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: () => apiFetch("/orders"),
  });

  // Fetch retailers (search)
  const { data: retailers = [], isLoading: loadingRetailers } = useQuery<Retailer[]>({
    queryKey: ["retailers", search],
    queryFn: () => apiFetch(`/orders/retailers?search=${encodeURIComponent(search)}`),
    enabled: showCreate && step === 1,
  });

  // Fetch vehicles
  const { data: vehicles = [], isLoading: loadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["vehicles"],
    queryFn: () => apiFetch("/vehicles"),
    enabled: showCreate && step === 2,
  });

  const createMutation = useMutation({
    mutationFn: (body: { retailerId: number; vehicleId: number; quantity: number }) =>
      apiFetch<Order>("/orders", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["my-bonus"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetFlow();
    },
    onError: (e: Error) => setSubmitError(e.message),
  });

  const resetFlow = useCallback(() => {
    setShowCreate(false);
    setStep(1);
    setSearch("");
    setSelectedRetailer(null);
    setSelectedVehicle(null);
    setQuantity("1");
    setSubmitError("");
  }, []);

  const handleSubmit = () => {
    const qty = parseInt(quantity, 10);
    if (!selectedRetailer || !selectedVehicle || isNaN(qty) || qty < 1) {
      setSubmitError("Please fill in all fields correctly.");
      return;
    }
    setSubmitError("");
    createMutation.mutate({ retailerId: selectedRetailer.id, vehicleId: selectedVehicle.id, quantity: qty });
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  // ── Create Order Modal-like panel ──────────────────────────────────────────
  if (showCreate) {
    return (
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: "#F7F4F1" }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity onPress={resetFlow} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Order</Text>
          <View style={{ width: 40 }} />
        </View>

        <StepBar step={step} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: botPad + 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* STEP 1 — Select retailer */}
          {step === 1 && (
            <View>
              <Text style={styles.stepTitle}>Search Retailer</Text>
              <View style={styles.searchRow}>
                <Feather name="search" size={16} color={Colors.textLight} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Name or phone number..."
                  placeholderTextColor={Colors.textLight}
                  value={search}
                  onChangeText={setSearch}
                  autoFocus
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch("")}>
                    <Feather name="x" size={16} color={Colors.textLight} />
                  </TouchableOpacity>
                )}
              </View>

              {loadingRetailers ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
              ) : retailers.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="users" size={40} color={Colors.border} />
                  <Text style={styles.emptyTitle}>No retailers found</Text>
                  <Text style={styles.emptyText}>Try a different name or phone number</Text>
                </View>
              ) : (
                retailers.map(r => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.selectCard, selectedRetailer?.id === r.id && styles.selectCardActive]}
                    onPress={() => { Haptics.selectionAsync(); setSelectedRetailer(r); }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.selectCardIcon}>
                      <Feather name="user" size={18} color={selectedRetailer?.id === r.id ? Colors.white : Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.selectCardName, selectedRetailer?.id === r.id && styles.selectCardNameActive]}>
                        {r.name || r.phone}
                      </Text>
                      {r.name && <Text style={styles.selectCardSub}>{r.phone}{r.city ? ` · ${r.city}` : ""}</Text>}
                    </View>
                    {selectedRetailer?.id === r.id && <Feather name="check-circle" size={18} color={Colors.white} />}
                  </TouchableOpacity>
                ))
              )}

              {selectedRetailer && (
                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 24 }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep(2); }}
                >
                  <Text style={styles.primaryBtnText}>Next — Select Vehicle</Text>
                  <Feather name="arrow-right" size={18} color={Colors.white} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* STEP 2 — Select vehicle */}
          {step === 2 && (
            <View>
              <Text style={styles.stepTitle}>Select Vehicle</Text>
              {loadingVehicles ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
              ) : vehicles.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="truck" size={40} color={Colors.border} />
                  <Text style={styles.emptyTitle}>No vehicles available</Text>
                </View>
              ) : (
                vehicles.map(v => (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.selectCard, selectedVehicle?.id === v.id && styles.selectCardActive]}
                    onPress={() => { Haptics.selectionAsync(); setSelectedVehicle(v); }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.selectCardIcon}>
                      <Feather name="truck" size={18} color={selectedVehicle?.id === v.id ? Colors.white : Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.selectCardName, selectedVehicle?.id === v.id && styles.selectCardNameActive]}>
                        {v.name}
                      </Text>
                      <Text style={styles.selectCardSub}>{v.points} pts/unit</Text>
                    </View>
                    {selectedVehicle?.id === v.id && <Feather name="check-circle" size={18} color={Colors.white} />}
                  </TouchableOpacity>
                ))
              )}
              <View style={styles.rowBtns}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(1)}>
                  <Feather name="arrow-left" size={16} color={Colors.primary} />
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
                {selectedVehicle && (
                  <TouchableOpacity
                    style={[styles.primaryBtn, { flex: 1, marginLeft: 10 }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep(3); }}
                  >
                    <Text style={styles.primaryBtnText}>Next — Quantity</Text>
                    <Feather name="arrow-right" size={18} color={Colors.white} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* STEP 3 — Quantity */}
          {step === 3 && (
            <View>
              <Text style={styles.stepTitle}>Set Quantity</Text>

              {/* Summary */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Feather name="user" size={15} color={Colors.textSecondary} />
                  <Text style={styles.summaryLabel}>Retailer</Text>
                  <Text style={styles.summaryValue}>{selectedRetailer?.name || selectedRetailer?.phone}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Feather name="truck" size={15} color={Colors.textSecondary} />
                  <Text style={styles.summaryLabel}>Vehicle</Text>
                  <Text style={styles.summaryValue}>{selectedVehicle?.name}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Feather name="star" size={15} color={Colors.textSecondary} />
                  <Text style={styles.summaryLabel}>Points/unit</Text>
                  <Text style={styles.summaryValue}>{selectedVehicle?.points}</Text>
                </View>
              </View>

              {/* Quantity stepper */}
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => {
                    Haptics.selectionAsync();
                    const n = Math.max(1, parseInt(quantity || "1", 10) - 1);
                    setQuantity(String(n));
                  }}
                >
                  <Feather name="minus" size={20} color={Colors.primary} />
                </TouchableOpacity>
                <TextInput
                  style={styles.qtyInput}
                  value={quantity}
                  onChangeText={v => setQuantity(v.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                  textAlign="center"
                />
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => {
                    Haptics.selectionAsync();
                    const n = parseInt(quantity || "0", 10) + 1;
                    setQuantity(String(n));
                  }}
                >
                  <Feather name="plus" size={20} color={Colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Live preview */}
              {parseInt(quantity, 10) > 0 && selectedVehicle && (
                <View style={styles.previewCard}>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Customer Points</Text>
                    <Text style={styles.previewVal}>
                      {parseInt(quantity, 10) * selectedVehicle.points}
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Your Bonus (10%)</Text>
                    <Text style={[styles.previewVal, { color: "#10B981" }]}>
                      {Math.round(parseInt(quantity, 10) * selectedVehicle.points * 0.1)}
                    </Text>
                  </View>
                </View>
              )}

              {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

              <View style={styles.rowBtns}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(2)}>
                  <Feather name="arrow-left" size={16} color={Colors.primary} />
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1, marginLeft: 10 }, createMutation.isPending && styles.btnDisabled]}
                  onPress={handleSubmit}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending
                    ? <ActivityIndicator color={Colors.white} size="small" />
                    : <>
                        <Text style={styles.primaryBtnText}>Place Order</Text>
                        <Feather name="check" size={18} color={Colors.white} />
                      </>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Orders List ───────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: "#F7F4F1" }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={styles.headerTitle}>Orders</Text>
        <TouchableOpacity
          style={styles.newOrderBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCreate(true); }}
        >
          <Feather name="plus" size={18} color={Colors.white} />
          <Text style={styles.newOrderBtnText}>New Order</Text>
        </TouchableOpacity>
      </View>

      {loadingOrders ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Feather name="clipboard" size={52} color={Colors.border} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyText}>Tap "New Order" to place your first order</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <OrderCard order={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad + 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  newOrderBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  newOrderBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.white },

  stepBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 32, paddingVertical: 16,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: Colors.primary },
  stepDotDone: { backgroundColor: Colors.primary },
  stepDotText: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.textLight },
  stepDotTextActive: { color: Colors.white },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: Colors.primary },

  stepTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 16 },

  searchRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.white, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text },

  selectCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  selectCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  selectCardIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: `${Colors.primary}15`,
    alignItems: "center", justifyContent: "center",
  },
  selectCardName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  selectCardNameActive: { color: Colors.white },
  selectCardSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },

  rowBtns: { flexDirection: "row", alignItems: "center", marginTop: 24 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 20,
  },
  primaryBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.white },
  btnDisabled: { opacity: 0.6 },
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: `${Colors.primary}15`, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  secondaryBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.primary },

  summaryCard: {
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 20, overflow: "hidden",
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  summaryLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  summaryValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.border },

  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 20 },
  qtyBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: `${Colors.primary}15`,
    alignItems: "center", justifyContent: "center",
  },
  qtyInput: {
    width: 80, height: 56, borderRadius: 14,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.primary,
    fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.primary,
  },

  previewCard: {
    backgroundColor: "#F0FBF6", borderRadius: 14,
    borderWidth: 1, borderColor: "#A7F3D0",
    padding: 16, marginBottom: 16,
  },
  previewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  previewLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  previewVal: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.primary },

  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#EF4444", textAlign: "center", marginBottom: 12 },

  orderCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 12, overflow: "hidden",
  },
  orderCardTop: { flexDirection: "row", padding: 14 },
  orderVehicle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  orderRetailer: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary, marginTop: 2 },
  orderDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textLight, marginTop: 4 },
  orderRight: { alignItems: "flex-end", gap: 8 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  orderQty: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  orderCardBottom: {
    flexDirection: "row", gap: 16,
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: "#FAFAF9",
  },
  orderStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  orderStatText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },

  emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.text },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
});
