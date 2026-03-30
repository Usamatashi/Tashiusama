import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
import * as SMS from "expo-sms";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Retailer { id: number; name: string | null; phone: string; city: string | null; }
type ProductCategory = "disc_pad" | "brake_shoes" | "other";
interface Product  { id: number; name: string; points: number; salesPrice: number; category: ProductCategory; imageBase64: string | null; }

const CATEGORY_META: Record<ProductCategory, { label: string; icon: React.ComponentProps<typeof Feather>["name"]; color: string; bg: string }> = {
  disc_pad:    { label: "Disc Pads",      icon: "circle", color: "#E87722", bg: "#FFF4EC" },
  brake_shoes: { label: "Brake Shoes",    icon: "truck",  color: "#2563EB", bg: "#EFF6FF" },
  other:       { label: "Other Products", icon: "box",    color: "#7B2FBE", bg: "#F5F0FF" },
};
const CATEGORY_ORDER: ProductCategory[] = ["disc_pad", "brake_shoes", "other"];
interface CartItem { product: Product; quantity: number; }

interface OrderItemResponse {
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
  totalPoints: number;
  bonusPoints: number;
  totalValue: number;
  status: "pending" | "confirmed" | "cancelled";
  retailerName: string | null;
  retailerPhone: string | null;
  createdAt: string;
  items: OrderItemResponse[];
}

interface RetailerOrder {
  id: number;
  totalPoints: number;
  totalValue: number;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
  items: OrderItemResponse[];
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
      <StepDot n={3} active={step === 3} done={false} />
    </View>
  );
}

// ─── Status colours ──────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  pending: "#F59E0B", confirmed: "#10B981", dispatched: "#3B82F6", cancelled: "#EF4444",
};
const STATUS_BG: Record<string, string> = {
  pending: "#FEF3C7", confirmed: "#D1FAE5", dispatched: "#DBEAFE", cancelled: "#FEE2E2",
};

// ─── Invoice Card (supports multiple line items) ─────────────────────────────
function InvoiceCard({
  headerIcon,
  headerTitle,
  headerSub,
  date,
  status,
  items = [],
}: {
  headerIcon: "user" | "truck";
  headerTitle: string;
  headerSub?: string;
  date: string;
  status: string;
  items: OrderItemResponse[];
}) {
  const grandTotal = items.reduce((s, i) => s + i.totalValue, 0);
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.avatarCircle}>
          <Feather name={headerIcon} size={15} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardPrimaryTitle} numberOfLines={1}>{headerTitle}</Text>
          {headerSub ? <Text style={styles.cardSecondaryTitle} numberOfLines={1}>{headerSub}</Text> : null}
          <Text style={styles.cardDate}>{date}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: STATUS_BG[status] ?? "#eee" }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[status] ?? "#999" }]}>
            {status.toUpperCase()}
          </Text>
        </View>
      </View>
      {/* Invoice table */}
      <View style={styles.table}>
        <View style={styles.tableRow}>
          <Text style={[styles.colHead, { flex: 3 }]}>PRODUCT</Text>
          <Text style={[styles.colHead, styles.colCenter, { flex: 1 }]}>SETS</Text>
          <Text style={[styles.colHead, styles.colRight, { flex: 2 }]}>PRICE</Text>
          <Text style={[styles.colHead, styles.colRight, { flex: 2 }]}>TOTAL</Text>
        </View>
        <View style={styles.tableDivider} />
        {items.map((item, idx) => (
          <View key={idx} style={[styles.tableRow, { paddingVertical: 8, borderBottomWidth: idx < items.length - 1 ? 1 : 0, borderBottomColor: "#F0EDE8" }]}>
            <Text style={[styles.colVal, { flex: 3 }]} numberOfLines={2}>{item.productName}</Text>
            <Text style={[styles.colVal, styles.colCenter, { flex: 1 }]}>{item.quantity}</Text>
            <Text style={[styles.colVal, styles.colRight, { flex: 2 }]}>
              {item.unitPrice > 0 ? item.unitPrice.toLocaleString() : "—"}
            </Text>
            <Text style={[styles.colVal, styles.colRight, { flex: 2 }]}>
              {item.totalValue > 0 ? item.totalValue.toLocaleString() : "—"}
            </Text>
          </View>
        ))}
        <View style={styles.totalFooter}>
          <Text style={styles.totalFooterLabel}>Order Total</Text>
          <Text style={styles.totalFooterValue}>Rs. {grandTotal.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
}

function OrderCard({
  order,
  onCancel,
  isCancelling,
}: {
  order: Order;
  onCancel?: (id: number) => void;
  isCancelling?: boolean;
}) {
  const date = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
  return (
    <View>
      <InvoiceCard
        headerIcon="user"
        headerTitle={order.retailerName ?? order.retailerPhone ?? "Retailer"}
        headerSub={order.retailerPhone ?? undefined}
        date={date}
        status={order.status}
        items={order.items}
      />
      {order.status === "pending" && onCancel && (
        <TouchableOpacity
          style={styles.cancelOrderBtn}
          onPress={() => {
            Alert.alert(
              "Cancel Order",
              "Are you sure you want to cancel this order?",
              [
                { text: "No", style: "cancel" },
                { text: "Yes, Cancel", style: "destructive", onPress: () => onCancel(order.id) },
              ]
            );
          }}
          disabled={isCancelling}
          activeOpacity={0.8}
        >
          {isCancelling
            ? <ActivityIndicator color="#EF4444" size="small" />
            : <>
                <Feather name="x-circle" size={16} color="#EF4444" />
                <Text style={styles.cancelOrderBtnText}>Cancel Order</Text>
              </>}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Retailer Order Card ─────────────────────────────────────────────────────
function RetailerOrderCard({
  order,
  onConfirm,
  isConfirming,
}: {
  order: RetailerOrder;
  onConfirm: () => void;
  isConfirming: boolean;
}) {
  const [pendingTap, setPendingTap] = useState(false);
  const date = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const safeItems = order.items ?? [];
  const firstProduct = safeItems[0]?.productName ?? "Order";

  const handlePress = () => {
    if (pendingTap) {
      setPendingTap(false);
      onConfirm();
    } else {
      setPendingTap(true);
    }
  };

  return (
    <View>
      <InvoiceCard
        headerIcon="truck"
        headerTitle={safeItems.length > 1 ? `${safeItems.length} products` : firstProduct}
        date={date}
        status={order.status}
        items={safeItems}
      />
      {order.status === "pending" && (
        pendingTap ? (
          <View style={styles.confirmRowInline}>
            <TouchableOpacity
              style={styles.confirmRowCancel}
              onPress={() => setPendingTap(false)}
              activeOpacity={0.8}
            >
              <Feather name="x" size={16} color="#EF4444" />
              <Text style={styles.confirmRowCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmOrderBtn, { flex: 1, marginTop: 0, marginHorizontal: 0, marginBottom: 0 }, isConfirming && styles.btnDisabled]}
              onPress={handlePress}
              disabled={isConfirming}
              activeOpacity={0.82}
            >
              {isConfirming ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Feather name="check-circle" size={16} color="#FFF" />
                  <Text style={styles.confirmOrderBtnText}>Yes, Confirm</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.confirmOrderBtn, isConfirming && styles.btnDisabled]}
            onPress={handlePress}
            disabled={isConfirming}
            activeOpacity={0.82}
          >
            <Feather name="check-circle" size={18} color="#FFF" />
            <Text style={styles.confirmOrderBtnText}>Confirm Order</Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}

function RetailerOrdersScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);
  const qc = useQueryClient();
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const { data: orders = [], isLoading, refetch, isRefetching } = useQuery<RetailerOrder[]>({
    queryKey: ["retailer-orders"],
    queryFn: () => apiFetch("/orders/my-retail-orders"),
  });

  const confirmMutation = useMutation({
    mutationFn: (orderId: number) =>
      apiFetch(`/orders/${orderId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: "confirmed" }),
      }),
    onMutate: (orderId) => setConfirmingId(orderId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["retailer-orders"] });
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
    onSettled: () => setConfirmingId(null),
  });

  const handleConfirm = (orderId: number) => {
    confirmMutation.mutate(orderId);
  };

  return (
    <View style={[styles.root, { backgroundColor: "#F7F4F1" }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Feather name="clipboard" size={52} color={Colors.border} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyText}>Orders placed by your salesman will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <RetailerOrderCard
              order={item}
              onConfirm={() => handleConfirm(item.id)}
              isConfirming={confirmingId === item.id}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
        />
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function OrdersScreen() {
  const { user } = useAuth();
  if (user?.role === "retailer") return <RetailerOrdersScreen />;

  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [submitError, setSubmitError] = useState("");
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [smsSending, setSmsSending] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const { data: orders = [], isLoading: loadingOrders, refetch, isRefetching } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: () => apiFetch("/orders"),
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: number) =>
      apiFetch(`/orders/${orderId}/status`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) }),
    onMutate: (orderId) => setCancellingId(orderId),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["my-bonus"] });
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
    onSettled: () => setCancellingId(null),
  });

  const { data: retailers = [], isLoading: loadingRetailers } = useQuery<Retailer[]>({
    queryKey: ["retailers", search],
    queryFn: () => apiFetch(`/orders/retailers?search=${encodeURIComponent(search)}`),
    enabled: showCreate && step === 1,
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch("/products"),
    enabled: showCreate && step === 2,
  });

  const createMutation = useMutation({
    mutationFn: (body: { retailerId: number; items: { productId: number; quantity: number }[] }) =>
      apiFetch<Order>("/orders", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["my-bonus"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Enrich with retailer info from local state before API refreshes
      setPlacedOrder({
        ...order,
        retailerName: order.retailerName ?? selectedRetailer?.name ?? null,
        retailerPhone: order.retailerPhone ?? selectedRetailer?.phone ?? null,
      });
    },
    onError: (e: Error) => setSubmitError(e.message),
  });

  const resetFlow = useCallback(() => {
    setShowCreate(false);
    setPlacedOrder(null);
    setStep(1);
    setSearch("");
    setSelectedRetailer(null);
    setCartItems([]);
    setSelectedProduct(null);
    setQuantity("1");
    setSubmitError("");
    setSmsSending(false);
  }, []);

  const sendOrderSms = useCallback(async (order: Order) => {
    const phone = order.retailerPhone;
    if (!phone) {
      Alert.alert("No Phone Number", "This retailer has no phone number on record.");
      return;
    }

    const available = await SMS.isAvailableAsync();
    if (!available) {
      Alert.alert("SMS Not Available", "SMS is not supported on this device.");
      return;
    }

    const date = new Date(order.createdAt).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });

    const items = order.items ?? [];
    const itemLines = items.map(i =>
      `• ${i.productName}: ${i.quantity} set${i.quantity !== 1 ? "s" : ""} × Rs. ${i.unitPrice.toLocaleString()} = Rs. ${i.totalValue.toLocaleString()}`
    ).join("\n");

    const grandTotal = items.reduce((s, i) => s + i.totalValue, 0);
    const retailerName = order.retailerName ? `\nRetailer: ${order.retailerName}` : "";

    const message =
      `*Tashi Order #${order.id}*${retailerName}\nDate: ${date}\n\n` +
      `${itemLines}\n\n` +
      `Order Total: Rs. ${grandTotal.toLocaleString()}\nStatus: PENDING\n\n` +
      `This order is pending confirmation. Thank you!`;

    setSmsSending(true);
    try {
      await SMS.sendSMSAsync([phone], message);
    } finally {
      setSmsSending(false);
    }
  }, []);

  const addToCart = () => {
    if (!selectedProduct) return;
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCartItems(prev => {
      const existing = prev.findIndex(c => c.product.id === selectedProduct.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { product: selectedProduct, quantity: updated[existing].quantity + qty };
        return updated;
      }
      return [...prev, { product: selectedProduct, quantity: qty }];
    });
    setSelectedProduct(null);
    setQuantity("1");
  };

  const removeFromCart = (productId: number) => {
    Haptics.selectionAsync();
    setCartItems(prev => prev.filter(c => c.product.id !== productId));
  };

  const handleSubmit = () => {
    if (!selectedRetailer || cartItems.length === 0) {
      setSubmitError("Please add at least one product.");
      return;
    }
    setSubmitError("");
    createMutation.mutate({
      retailerId: selectedRetailer.id,
      items: cartItems.map(c => ({ productId: c.product.id, quantity: c.quantity })),
    });
  };

  const cartTotal = cartItems.reduce((s, c) => s + c.product.salesPrice * c.quantity, 0);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  // ── Order Placed Success Panel ───────────────────────────────────────────────
  if (placedOrder) {
    const orderItems = placedOrder.items ?? [];
    const grandTotal = orderItems.reduce((s, i) => s + i.totalValue, 0);
    const date = new Date(placedOrder.createdAt).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
    return (
      <View style={[styles.root, { backgroundColor: "#F7F4F1" }]}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: topPad + 24, paddingBottom: botPad + 60 }}>

          {/* Success badge */}
          <View style={styles.successBadge}>
            <View style={styles.successIcon}>
              <Feather name="check" size={32} color="#FFF" />
            </View>
            <Text style={styles.successTitle}>Order Placed!</Text>
            <Text style={styles.successSub}>Order #{placedOrder.id} · {date}</Text>
          </View>

          {/* Retailer info */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Feather name="user" size={15} color={Colors.textSecondary} />
              <Text style={styles.summaryLabel}>Retailer</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {placedOrder.retailerName || placedOrder.retailerPhone || "—"}
              </Text>
            </View>
            {placedOrder.retailerPhone && placedOrder.retailerName && (
              <>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Feather name="phone" size={15} color={Colors.textSecondary} />
                  <Text style={styles.summaryLabel}>Phone</Text>
                  <Text style={styles.summaryValue}>{placedOrder.retailerPhone}</Text>
                </View>
              </>
            )}
          </View>

          {/* Order items table */}
          <View style={styles.card}>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                <Text style={[styles.colHead, { flex: 3 }]}>PRODUCT</Text>
                <Text style={[styles.colHead, styles.colCenter, { flex: 1 }]}>SETS</Text>
                <Text style={[styles.colHead, styles.colRight, { flex: 2 }]}>PRICE</Text>
                <Text style={[styles.colHead, styles.colRight, { flex: 2 }]}>TOTAL</Text>
              </View>
              <View style={styles.tableDivider} />
              {orderItems.map((item, idx) => (
                <View
                  key={idx}
                  style={[styles.tableRow, { paddingVertical: 8, borderBottomWidth: idx < orderItems.length - 1 ? 1 : 0, borderBottomColor: "#F0EDE8" }]}
                >
                  <Text style={[styles.colVal, { flex: 3 }]} numberOfLines={2}>{item.productName}</Text>
                  <Text style={[styles.colVal, styles.colCenter, { flex: 1 }]}>{item.quantity}</Text>
                  <Text style={[styles.colVal, styles.colRight, { flex: 2 }]}>Rs.{"\u00A0"}{item.unitPrice.toLocaleString()}</Text>
                  <Text style={[styles.colVal, styles.colRight, { flex: 2 }]}>Rs.{"\u00A0"}{item.totalValue.toLocaleString()}</Text>
                </View>
              ))}
              <View style={styles.totalFooter}>
                <Text style={styles.totalFooterLabel}>Grand Total</Text>
                <Text style={styles.totalFooterValue}>{grandTotal.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Status pill */}
          <View style={[styles.statusInfoRow]}>
            <Feather name="clock" size={14} color="#F59E0B" />
            <Text style={styles.statusInfoText}>Pending retailer confirmation</Text>
          </View>

          {/* SMS button */}
          <TouchableOpacity
            style={[styles.smsBtn, smsSending && styles.btnDisabled]}
            onPress={() => sendOrderSms(placedOrder)}
            disabled={smsSending}
            activeOpacity={0.8}
          >
            {smsSending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Feather name="message-square" size={20} color="#FFF" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.smsBtnTitle}>Send SMS to Retailer</Text>
                  <Text style={styles.smsBtnSub}>
                    {placedOrder.retailerPhone ?? "No phone number"}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.7)" />
              </>
            )}
          </TouchableOpacity>

          {/* Done button */}
          <TouchableOpacity style={styles.outlineBtn} onPress={resetFlow}>
            <Feather name="check-circle" size={18} color={Colors.primary} />
            <Text style={styles.outlineBtnText}>Done</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    );
  }

  // ── Create Order Flow ───────────────────────────────────────────────────────
  if (showCreate) {
    return (
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: "#F7F4F1" }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
          contentContainerStyle={{ padding: 20, paddingBottom: botPad + 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── STEP 1: Select Retailer ── */}
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
                  <Text style={styles.primaryBtnText}>Next — Add Products</Text>
                  <Feather name="arrow-right" size={18} color={Colors.white} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── STEP 2: Build Cart ── */}
          {step === 2 && (
            <View>
              {/* Retailer chip */}
              <View style={styles.retailerChip}>
                <Feather name="user" size={13} color={Colors.primary} />
                <Text style={styles.retailerChipText}>{selectedRetailer?.name || selectedRetailer?.phone}</Text>
              </View>

              <Text style={styles.stepTitle}>Add Products</Text>
              <Text style={styles.stepSubtitle}>Select a product and set quantity, then tap Add. Repeat for each product.</Text>

              {/* Cart summary */}
              {cartItems.length > 0 && (
                <View style={styles.cartBox}>
                  <View style={styles.cartBoxHeader}>
                    <Text style={styles.cartBoxTitle}>Cart ({cartItems.length} product{cartItems.length !== 1 ? "s" : ""})</Text>
                    <Text style={styles.cartBoxTotal}>Rs. {cartTotal.toLocaleString()}</Text>
                  </View>
                  {cartItems.map(c => (
                    <View key={c.product.id} style={styles.cartRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cartItemName}>{c.product.name}</Text>
                        <Text style={styles.cartItemSub}>
                          {c.quantity} sets × Rs. {c.product.salesPrice.toLocaleString()} = Rs. {(c.quantity * c.product.salesPrice).toLocaleString()}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => removeFromCart(c.product.id)} style={styles.removeBtn}>
                        <Feather name="trash-2" size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Vehicle picker */}
              <Text style={styles.sectionLabel}>
                {selectedProduct ? "Set Quantity" : "Select Product"}
              </Text>

              {!selectedProduct ? (
                loadingProducts ? (
                  <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
                ) : products.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Feather name="box" size={40} color={Colors.border} />
                    <Text style={styles.emptyTitle}>No products available</Text>
                  </View>
                ) : (
                  CATEGORY_ORDER.map(cat => {
                    const catProducts = products.filter(p => (p.category ?? "other") === cat);
                    if (catProducts.length === 0) return null;
                    const meta = CATEGORY_META[cat];
                    return (
                      <View key={cat}>
                        <View style={[styles.catHeader, { backgroundColor: meta.bg }]}>
                          <Feather name={meta.icon} size={13} color={meta.color} />
                          <Text style={[styles.catHeaderText, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                        {catProducts.map(v => {
                          const alreadyAdded = cartItems.some(c => c.product.id === v.id);
                          return (
                            <TouchableOpacity
                              key={v.id}
                              style={[styles.selectCard, alreadyAdded && styles.selectCardAdded]}
                              onPress={() => { Haptics.selectionAsync(); setSelectedProduct(v); setQuantity("1"); }}
                              activeOpacity={0.7}
                            >
                              {v.imageBase64 ? (
                                <Image
                                  source={{ uri: `data:image/jpeg;base64,${v.imageBase64}` }}
                                  style={styles.productThumb}
                                />
                              ) : (
                                <View style={[styles.selectCardIcon, alreadyAdded && { backgroundColor: "#D1FAE5" }]}>
                                  <Feather name={meta.icon} size={18} color={alreadyAdded ? "#10B981" : meta.color} />
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={styles.selectCardName}>{v.name}</Text>
                                <Text style={styles.selectCardSub}>Rs. {v.salesPrice.toLocaleString()}/unit</Text>
                              </View>
                              {alreadyAdded && (
                                <View style={styles.addedBadge}>
                                  <Text style={styles.addedBadgeText}>Added</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })
                )
              ) : (
                <View>
                  {/* Selected vehicle summary */}
                  <View style={styles.selectedProductCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectedProductName}>{selectedProduct.name}</Text>
                      <Text style={styles.selectedProductPrice}>Rs. {selectedProduct.salesPrice.toLocaleString()}/unit</Text>
                    </View>
                    <TouchableOpacity onPress={() => { setSelectedProduct(null); setQuantity("1"); }}>
                      <Feather name="x" size={18} color={Colors.textLight} />
                    </TouchableOpacity>
                  </View>

                  {/* Quantity stepper */}
                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => { Haptics.selectionAsync(); const n = Math.max(1, parseInt(quantity || "1", 10) - 1); setQuantity(String(n)); }}
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
                      onPress={() => { Haptics.selectionAsync(); const n = parseInt(quantity || "0", 10) + 1; setQuantity(String(n)); }}
                    >
                      <Feather name="plus" size={20} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* Line total */}
                  {parseInt(quantity, 10) > 0 && (
                    <View style={styles.previewCard}>
                      <View style={styles.previewRow}>
                        <Text style={styles.previewLabel}>Line Total</Text>
                        <Text style={[styles.previewVal, { color: Colors.primary, fontWeight: "700" }]}>
                          Rs. {(parseInt(quantity, 10) * selectedProduct.salesPrice).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.primaryBtn, { marginTop: 12 }]}
                    onPress={addToCart}
                  >
                    <Feather name="plus-circle" size={18} color={Colors.white} />
                    <Text style={styles.primaryBtnText}>Add to Order</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.rowBtns, { marginTop: 24 }]}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(1)}>
                  <Feather name="arrow-left" size={16} color={Colors.primary} />
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
                {cartItems.length > 0 && (
                  <TouchableOpacity
                    style={[styles.primaryBtn, { flex: 1, marginLeft: 10 }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep(3); }}
                  >
                    <Text style={styles.primaryBtnText}>Review Order</Text>
                    <Feather name="arrow-right" size={18} color={Colors.white} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* ── STEP 3: Review & Place ── */}
          {step === 3 && (
            <View>
              <Text style={styles.stepTitle}>Review Order</Text>

              {/* Retailer */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Feather name="user" size={15} color={Colors.textSecondary} />
                  <Text style={styles.summaryLabel}>Retailer</Text>
                  <Text style={styles.summaryValue}>{selectedRetailer?.name || selectedRetailer?.phone}</Text>
                </View>
                {selectedRetailer?.phone && selectedRetailer?.name && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.summaryRow}>
                      <Feather name="phone" size={15} color={Colors.textSecondary} />
                      <Text style={styles.summaryLabel}>Phone</Text>
                      <Text style={styles.summaryValue}>{selectedRetailer.phone}</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Order items table */}
              <View style={styles.card}>
                <View style={styles.table}>
                  <View style={styles.tableRow}>
                    <Text style={[styles.colHead, { flex: 3 }]}>PRODUCT</Text>
                    <Text style={[styles.colHead, styles.colCenter, { flex: 1 }]}>SETS</Text>
                    <Text style={[styles.colHead, styles.colRight, { flex: 2 }]}>PRICE</Text>
                    <Text style={[styles.colHead, styles.colRight, { flex: 2 }]}>TOTAL</Text>
                  </View>
                  <View style={styles.tableDivider} />
                  {cartItems.map((c, idx) => {
                    const lineTotal = c.quantity * c.product.salesPrice;
                    return (
                      <View key={c.product.id} style={[styles.tableRow, { paddingVertical: 8, borderBottomWidth: idx < cartItems.length - 1 ? 1 : 0, borderBottomColor: "#F0EDE8" }]}>
                        <Text style={[styles.colVal, { flex: 3 }]} numberOfLines={2}>{c.product.name}</Text>
                        <Text style={[styles.colVal, styles.colCenter, { flex: 1 }]}>{c.quantity}</Text>
                        <Text style={[styles.colVal, styles.colRight, { flex: 2 }]}>Rs.{"\u00A0"}{c.product.salesPrice.toLocaleString()}</Text>
                        <Text style={[styles.colVal, styles.colRight, { flex: 2 }]}>Rs.{"\u00A0"}{lineTotal.toLocaleString()}</Text>
                      </View>
                    );
                  })}
                  <View style={styles.totalFooter}>
                    <Text style={styles.totalFooterLabel}>Grand Total</Text>
                    <Text style={styles.totalFooterValue}>Rs. {cartTotal.toLocaleString()}</Text>
                  </View>
                </View>
              </View>

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
          <Text style={styles.emptyText}>Tap + to book your first order</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onCancel={(id) => cancelMutation.mutate(id)}
              isCancelling={cancellingId === item.id}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#EDE8E3",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#1A1A1A" },
  newOrderBtn: {
    backgroundColor: Colors.primary, width: 36, height: 36,
    borderRadius: 18, alignItems: "center", justifyContent: "center",
  },
  backBtn: { padding: 4 },

  stepBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 32,
    paddingVertical: 16, backgroundColor: "#FFF",
    borderBottomWidth: 1, borderBottomColor: "#EDE8E3",
  },
  stepDot: {
    width: 28, height: 28, borderRadius: 14, alignItems: "center",
    justifyContent: "center", borderWidth: 2, borderColor: "#D1C9C0",
    backgroundColor: "#FFF",
  },
  stepDotActive: { borderColor: Colors.primary, backgroundColor: "#EEF4FB" },
  stepDotDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepDotText: { fontSize: 12, color: "#9E9590", fontWeight: "600" },
  stepDotTextActive: { color: Colors.primary },
  stepLine: { flex: 1, height: 2, backgroundColor: "#E5E0DB" },
  stepLineDone: { backgroundColor: Colors.primary },

  stepTitle: { fontSize: 17, fontWeight: "700", color: "#1A1A1A", marginBottom: 4 },
  stepSubtitle: { fontSize: 13, color: Colors.textLight, marginBottom: 16, lineHeight: 18 },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary, marginBottom: 10, marginTop: 8, textTransform: "uppercase", letterSpacing: 0.5 },

  searchRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFF", borderRadius: 12, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: "#E5E0DB",
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },

  selectCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFF", borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1.5, borderColor: "#E5E0DB",
  },
  selectCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  selectCardAdded: { borderColor: "#10B981", opacity: 0.75 },
  catHeader: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, marginTop: 14, marginBottom: 4,
  },
  catHeaderText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  productThumb: { width: 36, height: 36, borderRadius: 8, marginRight: 12 },
  selectCardIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  selectCardName: { fontSize: 15, fontWeight: "600", color: Colors.text },
  selectCardNameActive: { color: Colors.white },
  selectCardSub: { fontSize: 12, color: Colors.textLight, marginTop: 2 },

  addedBadge: { backgroundColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  addedBadgeText: { fontSize: 11, fontWeight: "700", color: "#059669" },

  retailerChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#EEF4FB", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: "flex-start", marginBottom: 14,
  },
  retailerChipText: { fontSize: 13, fontWeight: "600", color: Colors.primary },

  cartBox: {
    backgroundColor: "#FFF", borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: "#E5E0DB",
  },
  cartBoxHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10,
  },
  cartBoxTitle: { fontSize: 13, fontWeight: "700", color: Colors.text },
  cartBoxTotal: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  cartRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#F0EDE8",
  },
  cartItemName: { fontSize: 13, fontWeight: "600", color: Colors.text },
  cartItemSub: { fontSize: 12, color: Colors.textLight, marginTop: 1 },
  removeBtn: { padding: 6 },

  selectedProductCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#EEF4FB", borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  selectedProductName: { fontSize: 15, fontWeight: "700", color: Colors.primary },
  selectedProductPrice: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  qtyRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 20, marginVertical: 12,
  },
  qtyBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1.5,
    borderColor: Colors.primary, alignItems: "center", justifyContent: "center",
    backgroundColor: "#FFF",
  },
  qtyInput: {
    width: 72, height: 44, borderRadius: 10,
    borderWidth: 1.5, borderColor: "#E5E0DB",
    backgroundColor: "#FFF", fontSize: 20, fontWeight: "700", color: Colors.text,
    textAlign: "center",
  },

  previewCard: {
    backgroundColor: "#F7F4F1", borderRadius: 10, padding: 12, marginBottom: 4,
  },
  previewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  previewLabel: { fontSize: 13, color: Colors.textSecondary },
  previewVal: { fontSize: 14, fontWeight: "600", color: Colors.text },

  summaryCard: {
    backgroundColor: "#FFF", borderRadius: 12, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: "#E5E0DB",
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary, width: 64 },
  summaryValue: { flex: 1, fontSize: 14, fontWeight: "600", color: Colors.text, textAlign: "right" },
  divider: { height: 1, backgroundColor: "#F0EDE8", marginVertical: 10 },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, gap: 8,
  },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: Colors.white },
  btnDisabled: { opacity: 0.5 },
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "600", color: Colors.primary },
  rowBtns: { flexDirection: "row", alignItems: "center", marginTop: 16 },

  errorText: { color: "#EF4444", fontSize: 13, marginBottom: 8, textAlign: "center" },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: Colors.text, textAlign: "center" },
  emptyText: { fontSize: 13, color: Colors.textLight, textAlign: "center" },

  card: {
    backgroundColor: "#FFF", borderRadius: 14, marginBottom: 12,
    borderWidth: 1, borderColor: "#E5E0DB", overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, borderBottomWidth: 1, borderBottomColor: "#F0EDE8",
  },
  avatarCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#EEF4FB", alignItems: "center", justifyContent: "center",
  },
  cardPrimaryTitle: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  cardSecondaryTitle: { fontSize: 12, color: Colors.textLight, marginTop: 1 },
  cardDate: { fontSize: 11, color: "#B0AAA4", marginTop: 1 },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },

  table: { paddingHorizontal: 14, paddingBottom: 4 },
  tableRow: { flexDirection: "row", alignItems: "center" },
  tableDivider: { height: 1, backgroundColor: "#F0EDE8", marginVertical: 6 },
  colHead: { fontSize: 10, fontWeight: "700", color: "#B0AAA4", letterSpacing: 0.4, paddingVertical: 4 },
  colVal: { fontSize: 12, color: "#1A1A1A" },
  colCenter: { textAlign: "center" },
  colRight: { textAlign: "right" },
  colTotal: { fontWeight: "700" },
  totalFooter: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: "#F0EDE8", marginTop: 4,
  },
  totalFooterLabel: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  totalFooterValue: { fontSize: 14, fontWeight: "800", color: Colors.primary },

  successBadge: { alignItems: "center", marginBottom: 24, gap: 8 },
  successIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#10B981", alignItems: "center", justifyContent: "center",
    shadowColor: "#10B981", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
  },
  successTitle: { fontSize: 26, fontWeight: "800", color: "#1A1A1A", marginTop: 4 },
  successSub: { fontSize: 13, color: Colors.textLight },

  statusInfoRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FEF3C7", borderRadius: 10, padding: 12, marginBottom: 16,
  },
  statusInfoText: { fontSize: 13, color: "#92400E", fontWeight: "600" },

  cancelOrderBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const,
    gap: 6, marginHorizontal: 16, marginBottom: 14, marginTop: -6,
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: "#FEE2E2",
    borderWidth: 1, borderColor: "#FECACA",
  },
  cancelOrderBtnText: { fontSize: 14, fontWeight: "600" as const, color: "#EF4444" },
  confirmOrderBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#10B981", borderRadius: 12,
    paddingVertical: 13, marginHorizontal: 16, marginTop: 8, marginBottom: 16,
    shadowColor: "#10B981", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  confirmOrderBtnText: { fontSize: 15, fontWeight: "700", color: "#FFF" },

  confirmRowInline: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginTop: 8, marginBottom: 16,
  },
  confirmRowCancel: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1.5, borderColor: "#EF4444", borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 16, backgroundColor: "#FFF",
  },
  confirmRowCancelText: { fontSize: 14, fontWeight: "700", color: "#EF4444" },

  smsBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 18, marginBottom: 12,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  smsBtnTitle: { fontSize: 15, fontWeight: "700", color: "#FFF" },
  smsBtnSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  outlineBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 14,
    paddingVertical: 14, backgroundColor: "#FFF",
  },
  outlineBtnText: { fontSize: 15, fontWeight: "700", color: Colors.primary },
});
