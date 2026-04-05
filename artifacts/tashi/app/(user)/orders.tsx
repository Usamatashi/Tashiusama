import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Animated,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import * as SMS from "expo-sms";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import { router } from "expo-router";
import { BackButton } from "@/components/BackButton";

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
interface CartItem { product: Product; quantity: number; discountPercent: number; }

interface OrderItemResponse {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPoints: number;
  bonusPoints: number;
  totalValue: number;
  discountPercent: number;
  discountedValue: number;
}

interface Order {
  id: number;
  totalPoints: number;
  bonusPoints: number;
  totalValue: number;
  billDiscountPercent: number;
  subtotal: number;
  billDiscountAmount: number;
  finalAmount: number;
  status: "pending" | "confirmed" | "dispatched" | "cancelled";
  retailerName: string | null;
  retailerPhone: string | null;
  createdAt: string;
  items: OrderItemResponse[];
}

interface RetailerOrder {
  id: number;
  totalPoints: number;
  totalValue: number;
  billDiscountPercent: number;
  subtotal: number;
  billDiscountAmount: number;
  finalAmount: number;
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

// ─── Salesman Edit Order Modal ────────────────────────────────────────────────
function SalesmanEditOrderModal({
  order,
  visible,
  onClose,
  onSaved,
}: {
  order: Order | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [tab, setTab] = useState<"cart" | "add">("cart");
  const [saveError, setSaveError] = useState("");

  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch("/products"),
    enabled: visible,
  });

  React.useEffect(() => {
    if (visible && order && products.length > 0) {
      const initial: CartItem[] = order.items
        .map(item => {
          const p = products.find(p => p.id === item.productId);
          return p ? { product: p, quantity: item.quantity } : null;
        })
        .filter((x): x is CartItem => x !== null);
      setCart(initial);
      setTab("cart");
      setSelectedProduct(null);
      setQuantity("1");
      setSaveError("");
    }
  }, [visible, order, products]);

  const saveItemsMutation = useMutation({
    mutationFn: (items: { productId: number; quantity: number }[]) =>
      apiFetch(`/orders/${order!.id}/items`, {
        method: "PUT",
        body: JSON.stringify({ items }),
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["orders"] });
      onSaved();
      onClose();
    },
    onError: (e: Error) => setSaveError(e.message),
  });

  const addToCart = () => {
    if (!selectedProduct) return;
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) return;
    Haptics.selectionAsync();
    setCart(prev => {
      const idx = prev.findIndex(c => c.product.id === selectedProduct.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { product: selectedProduct, quantity: qty };
        return updated;
      }
      return [...prev, { product: selectedProduct, quantity: qty }];
    });
    setSelectedProduct(null);
    setQuantity("1");
    setTab("cart");
  };

  const updateQty = (productId: number, newQty: number) => {
    if (newQty < 1) return;
    setCart(prev => prev.map(c => c.product.id === productId ? { ...c, quantity: newQty } : c));
  };

  const removeFromCart = (productId: number) => {
    Haptics.selectionAsync();
    setCart(prev => prev.filter(c => c.product.id !== productId));
  };

  const handleSave = () => {
    if (cart.length === 0) { setSaveError("Order must have at least one product."); return; }
    setSaveError("");
    saveItemsMutation.mutate(cart.map(c => ({ productId: c.product.id, quantity: c.quantity })));
  };

  const cartTotal = cart.reduce((s, c) => s + c.product.salesPrice * c.quantity, 0);

  if (!order) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={editModal.root}>
        {/* Header */}
        <View style={editModal.header}>
          <TouchableOpacity onPress={onClose} style={editModal.headerBtn}>
            <Feather name="x" size={22} color="#1A1A1A" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={editModal.headerTitle}>Edit Order #{order.id}</Text>
            <Text style={editModal.headerSub}>{order.retailerName || order.retailerPhone || "Retailer"}</Text>
          </View>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saveItemsMutation.isPending || cart.length === 0}
            style={[editModal.saveBtn, (saveItemsMutation.isPending || cart.length === 0) && editModal.saveBtnDisabled]}
          >
            {saveItemsMutation.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={editModal.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={editModal.tabRow}>
          {(["cart", "add"] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[editModal.tabBtn, tab === t && editModal.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Feather
                name={t === "cart" ? "shopping-cart" : "plus-circle"}
                size={14}
                color={tab === t ? Colors.primary : "#888"}
              />
              <Text style={[editModal.tabBtnText, tab === t && editModal.tabBtnTextActive]}>
                {t === "cart" ? `Cart (${cart.length})` : "Add Products"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {saveError ? (
          <View style={editModal.errorBanner}>
            <Feather name="alert-circle" size={14} color="#EF4444" />
            <Text style={editModal.errorText}>{saveError}</Text>
          </View>
        ) : null}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Cart tab */}
          {tab === "cart" && (
            cart.length === 0 ? (
              <View style={editModal.emptyState}>
                <Feather name="shopping-cart" size={44} color="#DDD" />
                <Text style={editModal.emptyTitle}>Cart is empty</Text>
                <Text style={editModal.emptyText}>Tap "Add Products" to add items</Text>
                <TouchableOpacity style={editModal.addTabBtn} onPress={() => setTab("add")}>
                  <Feather name="plus" size={16} color="#fff" />
                  <Text style={editModal.addTabBtnText}>Add Products</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {cart.map(c => (
                  <View key={c.product.id} style={editModal.cartRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={editModal.cartItemName}>{c.product.name}</Text>
                      <Text style={editModal.cartItemPrice}>Rs. {c.product.salesPrice.toLocaleString()} / unit</Text>
                    </View>
                    <View style={editModal.qtyControls}>
                      <TouchableOpacity style={editModal.qtyBtn} onPress={() => updateQty(c.product.id, c.quantity - 1)}>
                        <Feather name="minus" size={14} color={Colors.primary} />
                      </TouchableOpacity>
                      <TextInput
                        style={editModal.qtyInput}
                        value={String(c.quantity)}
                        onChangeText={v => { const n = parseInt(v.replace(/[^0-9]/g, ""), 10); if (!isNaN(n) && n >= 1) updateQty(c.product.id, n); }}
                        keyboardType="number-pad"
                        textAlign="center"
                      />
                      <TouchableOpacity style={editModal.qtyBtn} onPress={() => updateQty(c.product.id, c.quantity + 1)}>
                        <Feather name="plus" size={14} color={Colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <View style={{ alignItems: "flex-end", minWidth: 80, marginLeft: 8 }}>
                      <Text style={editModal.cartItemTotal}>Rs. {(c.product.salesPrice * c.quantity).toLocaleString()}</Text>
                      <TouchableOpacity onPress={() => removeFromCart(c.product.id)} style={{ marginTop: 4 }}>
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <View style={editModal.totalRow}>
                  <Text style={editModal.totalLabel}>Order Total</Text>
                  <Text style={editModal.totalValue}>Rs. {cartTotal.toLocaleString()}</Text>
                </View>
              </View>
            )
          )}

          {/* Add products tab */}
          {tab === "add" && (
            selectedProduct ? (
              <View>
                <View style={editModal.selectedCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={editModal.selectedName}>{selectedProduct.name}</Text>
                    <Text style={editModal.selectedPrice}>Rs. {selectedProduct.salesPrice.toLocaleString()} / unit</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setSelectedProduct(null); setQuantity("1"); }}>
                    <Feather name="x" size={18} color="#888" />
                  </TouchableOpacity>
                </View>
                <View style={editModal.qtyRowCenter}>
                  <TouchableOpacity style={editModal.qtyBtn} onPress={() => setQuantity(String(Math.max(1, parseInt(quantity || "1", 10) - 1)))}>
                    <Feather name="minus" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                  <TextInput
                    style={editModal.qtyInputLarge}
                    value={quantity}
                    onChangeText={v => setQuantity(v.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                  <TouchableOpacity style={editModal.qtyBtn} onPress={() => setQuantity(String(parseInt(quantity || "0", 10) + 1))}>
                    <Feather name="plus" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                {parseInt(quantity, 10) > 0 && (
                  <View style={editModal.previewTotal}>
                    <Text style={editModal.totalLabel}>Line Total</Text>
                    <Text style={[editModal.totalValue, { color: Colors.primary }]}>
                      Rs. {(parseInt(quantity, 10) * selectedProduct.salesPrice).toLocaleString()}
                    </Text>
                  </View>
                )}
                <TouchableOpacity style={editModal.addToCartBtn} onPress={addToCart}>
                  <Feather name="plus-circle" size={18} color="#fff" />
                  <Text style={editModal.addToCartBtnText}>
                    {cart.some(c => c.product.id === selectedProduct.id) ? "Update in Cart" : "Add to Cart"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : loadingProducts ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
            ) : (
              CATEGORY_ORDER.map(cat => {
                const catProducts = products.filter(p => (p.category ?? "other") === cat);
                if (catProducts.length === 0) return null;
                const meta = CATEGORY_META[cat];
                return (
                  <View key={cat}>
                    <View style={[editModal.catHeader, { backgroundColor: meta.bg }]}>
                      <Text style={[editModal.catHeaderText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    {catProducts.map(p => {
                      const inCart = cart.find(c => c.product.id === p.id);
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[editModal.productRow, inCart && editModal.productRowInCart]}
                          onPress={() => { Haptics.selectionAsync(); setSelectedProduct(p); setQuantity(inCart ? String(inCart.quantity) : "1"); }}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={editModal.productName}>{p.name}</Text>
                            <Text style={editModal.productPrice}>Rs. {p.salesPrice.toLocaleString()} / unit</Text>
                          </View>
                          {inCart ? (
                            <View style={editModal.inCartBadge}>
                              <Text style={editModal.inCartText}>{inCart.quantity} in cart</Text>
                            </View>
                          ) : (
                            <Feather name="plus" size={18} color={Colors.primary} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })
            )
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Status colours ──────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  pending: "#F59E0B", confirmed: "#10B981", dispatched: "#3B82F6", cancelled: "#EF4444",
};
const STATUS_BG: Record<string, string> = {
  pending: "#FEF3C7", confirmed: "#D1FAE5", dispatched: "#DBEAFE", cancelled: "#FEE2E2",
};

// ─── Invoice Card (accordion — tap header to expand/collapse) ─────────────────
function InvoiceCard({
  headerIcon,
  headerTitle,
  headerSub,
  date,
  status,
  items = [],
  billDiscountPercent = 0,
  billDiscountAmount = 0,
  finalAmount,
  expanded,
  onToggle,
  style,
}: {
  headerIcon: "user" | "truck";
  headerTitle: string;
  headerSub?: string;
  date: string;
  status: string;
  items: OrderItemResponse[];
  billDiscountPercent?: number;
  billDiscountAmount?: number;
  finalAmount?: number;
  expanded: boolean;
  onToggle: () => void;
  style?: object;
}) {
  const hasItemDisc = items.some(i => (i.discountPercent ?? 0) > 0);
  const subtotal = items.reduce((s, i) => s + (i.discountedValue ?? i.totalValue), 0);
  const grandTotal = finalAmount ?? (subtotal - (billDiscountAmount ?? 0));
  return (
    <View style={[styles.card, style]}>
      {/* Tappable summary row — always visible */}
      <TouchableOpacity style={styles.cardHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.avatarCircle}>
          <Feather name={headerIcon} size={15} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardPrimaryTitle} numberOfLines={1}>{headerTitle}</Text>
          {headerSub ? <Text style={styles.cardSecondaryTitle} numberOfLines={1}>{headerSub}</Text> : null}
          <Text style={styles.cardDate}>{date}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <View style={[styles.statusPill, { backgroundColor: STATUS_BG[status] ?? "#eee" }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[status] ?? "#999" }]}>
              {status.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.cardTotalInline}>Rs. {grandTotal.toLocaleString()}</Text>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color="#B0AAA4"
          style={{ marginLeft: 8 }}
        />
      </TouchableOpacity>

      {/* Expanded: full items table */}
      {expanded && (
        <View style={styles.table}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 430 }}>
              <View style={styles.tableRow}>
                <Text style={[styles.colHead, { width: 120 }]}>PRODUCT</Text>
                <Text style={[styles.colHead, styles.colCenter, { width: 40 }]}>SETS</Text>
                <Text style={[styles.colHead, styles.colRight, { width: 80 }]}>SALE PRICE</Text>
                <Text style={[styles.colHead, styles.colRight, { width: 85 }]}>DISC. PRICE</Text>
                <Text style={[styles.colHead, styles.colRight, { width: 80 }]}>TOTAL</Text>
              </View>
              <View style={styles.tableDivider} />
              {items.map((item, idx) => {
                const discPct = item.discountPercent ?? 0;
                const lineTotal = item.discountedValue ?? item.totalValue;
                const discUnitPrice = discPct > 0 ? Math.round(item.unitPrice * (1 - discPct / 100)) : item.unitPrice;
                return (
                  <View key={idx} style={[styles.tableRow, { paddingVertical: 8, borderBottomWidth: idx < items.length - 1 ? 1 : 0, borderBottomColor: "#F0EDE8" }]}>
                    <View style={{ width: 120 }}>
                      <Text style={styles.colVal} numberOfLines={2}>{item.productName}</Text>
                    </View>
                    <Text style={[styles.colVal, styles.colCenter, { width: 40 }]}>{item.quantity}</Text>
                    <Text style={[styles.colVal, styles.colRight, { width: 80 }]}>
                      {item.unitPrice > 0 ? item.unitPrice.toLocaleString() : "—"}
                    </Text>
                    <Text style={[styles.colVal, styles.colRight, { width: 85, color: discPct > 0 ? "#10B981" : undefined, fontWeight: discPct > 0 ? "700" : "400" }]}>
                      {discUnitPrice > 0 ? discUnitPrice.toLocaleString() : "—"}
                    </Text>
                    <Text style={[styles.colVal, styles.colRight, { width: 80, fontWeight: discPct > 0 ? "700" : "400" }]}>
                      {lineTotal > 0 ? lineTotal.toLocaleString() : "—"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
          {(hasItemDisc || billDiscountPercent > 0) && (
            <View style={[styles.tableRow, { paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#F0EDE8" }]}>
              <Text style={[styles.colHead, { flex: 1 }]}>Subtotal</Text>
              <Text style={[styles.colVal, styles.colRight, { flex: 1 }]}>Rs. {subtotal.toLocaleString()}</Text>
            </View>
          )}
          {billDiscountPercent > 0 && (
            <View style={[styles.tableRow, { paddingVertical: 6 }]}>
              <Text style={[styles.colHead, { flex: 1, color: "#10B981" }]}>Bill Discount ({billDiscountPercent}%)</Text>
              <Text style={[styles.colVal, styles.colRight, { flex: 1, color: "#10B981" }]}>−Rs. {billDiscountAmount.toLocaleString()}</Text>
            </View>
          )}
          <View style={styles.totalFooter}>
            <Text style={styles.totalFooterLabel}>Order Total</Text>
            <Text style={styles.totalFooterValue}>Rs. {grandTotal.toLocaleString()}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function OrderCard({
  order,
  onCancel,
  onEdit,
  isCancelling,
}: {
  order: Order;
  onCancel?: (id: number) => void;
  onEdit?: (order: Order) => void;
  isCancelling?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
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
        billDiscountPercent={order.billDiscountPercent ?? 0}
        billDiscountAmount={order.billDiscountAmount ?? 0}
        finalAmount={order.finalAmount}
        expanded={expanded}
        onToggle={() => { Haptics.selectionAsync(); setExpanded(prev => !prev); }}
      />
      {expanded && order.status === "pending" && (onCancel || onEdit) && (
        <View style={styles.orderActionRow}>
          {onEdit && (
            <TouchableOpacity
              style={[styles.orderActionBtn, styles.orderEditBtn]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onEdit(order); }}
              activeOpacity={0.8}
            >
              <Feather name="edit-2" size={15} color={Colors.primary} />
              <Text style={[styles.orderActionBtnText, { color: Colors.primary }]}>Edit Order</Text>
            </TouchableOpacity>
          )}
          {onCancel && (
            <TouchableOpacity
              style={[styles.orderActionBtn, styles.orderCancelBtn]}
              onPress={() => {
                Alert.alert("Cancel Order", "Are you sure you want to cancel this order?", [
                  { text: "No", style: "cancel" },
                  { text: "Yes, Cancel", style: "destructive", onPress: () => onCancel(order.id) },
                ]);
              }}
              disabled={isCancelling}
              activeOpacity={0.8}
            >
              {isCancelling
                ? <ActivityIndicator color="#EF4444" size="small" />
                : <>
                    <Feather name="x-circle" size={15} color="#EF4444" />
                    <Text style={[styles.orderActionBtnText, { color: "#EF4444" }]}>Cancel</Text>
                  </>}
            </TouchableOpacity>
          )}
        </View>
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
  const [expanded, setExpanded] = useState(false);
  const [pendingTap, setPendingTap] = useState(false);
  const isPending = order.status === "pending";

  // ── Pulse animation for pending orders ────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isPending) {
      pulseAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isPending]);

  const animatedBorderColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(245,158,11,0.18)", "rgba(245,158,11,0.95)"],
  });
  const animatedShadowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });

  const date = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const safeItems = order.items ?? [];
  const firstProduct = safeItems[0]?.productName ?? "Order";

  const handleToggle = () => {
    Haptics.selectionAsync();
    if (expanded) setPendingTap(false);
    setExpanded(prev => !prev);
  };

  const handleConfirmPress = () => {
    if (pendingTap) {
      setPendingTap(false);
      onConfirm();
    } else {
      setPendingTap(true);
    }
  };

  return (
    <Animated.View
      style={[
        styles.pendingCardWrapper,
        isPending && {
          borderColor: animatedBorderColor,
          shadowOpacity: animatedShadowOpacity,
        },
      ]}
    >
      {isPending && (
        <View style={styles.pendingBadgeStrip}>
          <Animated.View style={[styles.pendingBadgeDot, { opacity: pulseAnim }]} />
          <Text style={styles.pendingBadgeText}>Needs your confirmation</Text>
        </View>
      )}
      <InvoiceCard
        headerIcon="truck"
        headerTitle={safeItems.length > 1 ? `${safeItems.length} products` : firstProduct}
        date={date}
        status={order.status}
        items={safeItems}
        billDiscountPercent={order.billDiscountPercent ?? 0}
        billDiscountAmount={order.billDiscountAmount ?? 0}
        finalAmount={order.finalAmount}
        expanded={expanded}
        onToggle={handleToggle}
        style={{ marginBottom: 0 }}
      />
      {expanded && isPending && (
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
              onPress={handleConfirmPress}
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
            onPress={handleConfirmPress}
            disabled={isConfirming}
            activeOpacity={0.82}
          >
            <Feather name="check-circle" size={18} color="#FFF" />
            <Text style={styles.confirmOrderBtnText}>Confirm Order</Text>
          </TouchableOpacity>
        )
      )}
    </Animated.View>
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
        <BackButton />
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 40 }} />
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
  const [itemDiscount, setItemDiscount] = useState("0");
  const [billDiscount, setBillDiscount] = useState("0");
  const [submitError, setSubmitError] = useState("");
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [smsSending, setSmsSending] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

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
    mutationFn: (body: { retailerId: number; billDiscountPercent: number; items: { productId: number; quantity: number; discountPercent: number }[] }) =>
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
    setItemDiscount("0");
    setBillDiscount("0");
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
    const itemLines = items.map(i => {
      const discPct = i.discountPercent ?? 0;
      const lineTotal = i.discountedValue ?? i.totalValue;
      const discStr = discPct > 0 ? ` (${discPct}% off)` : "";
      return `• ${i.productName}: ${i.quantity} set${i.quantity !== 1 ? "s" : ""} × Rs. ${i.unitPrice.toLocaleString()} = Rs. ${lineTotal.toLocaleString()}${discStr}`;
    }).join("\n");

    const finalTotal = order.finalAmount ?? items.reduce((s, i) => s + (i.discountedValue ?? i.totalValue), 0);
    const billPct = order.billDiscountPercent ?? 0;
    const billAmt = order.billDiscountAmount ?? 0;
    const subtotalLine = billPct > 0 ? `\nSubtotal: Rs. ${(order.subtotal ?? finalTotal + billAmt).toLocaleString()}\nBill Discount (${billPct}%): −Rs. ${billAmt.toLocaleString()}` : "";
    const retailerName = order.retailerName ? `\nRetailer: ${order.retailerName}` : "";

    const message =
      `*Tashi Order #${order.id}*${retailerName}\nDate: ${date}\n\n` +
      `${itemLines}\n${subtotalLine}\n` +
      `Order Total: Rs. ${finalTotal.toLocaleString()}\nStatus: PENDING\n\n` +
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
    const discountPct = Math.min(100, Math.max(0, parseInt(itemDiscount || "0", 10)));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCartItems(prev => {
      const existing = prev.findIndex(c => c.product.id === selectedProduct.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { product: selectedProduct, quantity: updated[existing].quantity + qty, discountPercent: discountPct };
        return updated;
      }
      return [...prev, { product: selectedProduct, quantity: qty, discountPercent: discountPct }];
    });
    setSelectedProduct(null);
    setQuantity("1");
    setItemDiscount("0");
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
    const billDiscountPct = Math.min(100, Math.max(0, parseInt(billDiscount || "0", 10)));
    createMutation.mutate({
      retailerId: selectedRetailer.id,
      billDiscountPercent: billDiscountPct,
      items: cartItems.map(c => ({ productId: c.product.id, quantity: c.quantity, discountPercent: c.discountPercent })),
    });
  };

  const cartTotal = cartItems.reduce((s, c) => s + c.product.salesPrice * c.quantity, 0);
  const cartSubtotal = cartItems.reduce((s, c) => {
    const lineTotal = c.product.salesPrice * c.quantity;
    return s + Math.round(lineTotal * (1 - c.discountPercent / 100));
  }, 0);
  const billDiscountPct = Math.min(100, Math.max(0, parseInt(billDiscount || "0", 10)));
  const billDiscountAmt = Math.round(cartSubtotal * (billDiscountPct / 100));
  const cartFinalAmount = cartSubtotal - billDiscountAmt;
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  // ── Order Placed Success Panel ───────────────────────────────────────────────
  if (placedOrder) {
    const orderItems = placedOrder.items ?? [];
    const hasItemDisc = orderItems.some(i => (i.discountPercent ?? 0) > 0);
    const placedSubtotal = placedOrder.subtotal ?? orderItems.reduce((s, i) => s + (i.discountedValue ?? i.totalValue), 0);
    const placedBillPct = placedOrder.billDiscountPercent ?? 0;
    const placedBillAmt = placedOrder.billDiscountAmount ?? 0;
    const placedFinal = placedOrder.finalAmount ?? placedSubtotal;
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
              {orderItems.map((item, idx) => {
                const discPct = item.discountPercent ?? 0;
                const lineTotal = item.discountedValue ?? item.totalValue;
                return (
                  <View
                    key={idx}
                    style={[styles.tableRow, { paddingVertical: 8, borderBottomWidth: idx < orderItems.length - 1 ? 1 : 0, borderBottomColor: "#F0EDE8", flexWrap: "wrap" }]}
                  >
                    <View style={{ flex: 3 }}>
                      <Text style={styles.colVal} numberOfLines={2}>{item.productName}</Text>
                      {discPct > 0 && <Text style={{ fontSize: 10, color: "#10B981", fontWeight: "700" }}>−{discPct}% off</Text>}
                    </View>
                    <Text style={[styles.colVal, styles.colCenter, { flex: 1 }]}>{item.quantity}</Text>
                    <Text style={[styles.colVal, styles.colRight, { flex: 2 }]}>Rs.{"\u00A0"}{item.unitPrice.toLocaleString()}</Text>
                    <Text style={[styles.colVal, styles.colRight, { flex: 2, fontWeight: discPct > 0 ? "700" : "400" }]}>Rs.{"\u00A0"}{lineTotal.toLocaleString()}</Text>
                  </View>
                );
              })}
              {(hasItemDisc || placedBillPct > 0) && (
                <View style={[styles.tableRow, { paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#F0EDE8" }]}>
                  <Text style={[styles.colHead, { flex: 1 }]}>Subtotal</Text>
                  <Text style={[styles.colVal, styles.colRight, { flex: 1 }]}>Rs.{"\u00A0"}{placedSubtotal.toLocaleString()}</Text>
                </View>
              )}
              {placedBillPct > 0 && (
                <View style={[styles.tableRow, { paddingVertical: 6 }]}>
                  <Text style={[styles.colHead, { flex: 1, color: "#10B981" }]}>Bill Discount ({placedBillPct}%)</Text>
                  <Text style={[styles.colVal, styles.colRight, { flex: 1, color: "#10B981" }]}>−Rs.{"\u00A0"}{placedBillAmt.toLocaleString()}</Text>
                </View>
              )}
              <View style={styles.totalFooter}>
                <Text style={styles.totalFooterLabel}>Grand Total</Text>
                <Text style={styles.totalFooterValue}>Rs.{"\u00A0"}{placedFinal.toLocaleString()}</Text>
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
                    <Text style={styles.cartBoxTotal}>Rs. {cartSubtotal.toLocaleString()}</Text>
                  </View>
                  {cartItems.map(c => {
                    const lineTotal = c.quantity * c.product.salesPrice;
                    const discounted = Math.round(lineTotal * (1 - c.discountPercent / 100));
                    return (
                      <View key={c.product.id} style={styles.cartRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cartItemName}>{c.product.name}</Text>
                          <Text style={styles.cartItemSub}>
                            {c.quantity} sets × Rs. {c.product.salesPrice.toLocaleString()}
                            {c.discountPercent > 0 ? ` −${c.discountPercent}% = Rs. ${discounted.toLocaleString()}` : ` = Rs. ${lineTotal.toLocaleString()}`}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => removeFromCart(c.product.id)} style={styles.removeBtn}>
                          <Feather name="trash-2" size={15} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
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

                  {/* Item discount % */}
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <Text style={[styles.previewLabel, { fontWeight: "600", color: Colors.textSecondary }]}>Item Discount (%)</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E5E0DB", borderRadius: 10, backgroundColor: "#FFF", overflow: "hidden" }}>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                        onPress={() => { const n = Math.max(0, parseInt(itemDiscount || "0", 10) - 1); setItemDiscount(String(n)); }}
                      >
                        <Feather name="minus" size={14} color={Colors.primary} />
                      </TouchableOpacity>
                      <TextInput
                        style={{ width: 44, textAlign: "center", fontSize: 15, fontWeight: "700", color: Colors.text }}
                        value={itemDiscount}
                        onChangeText={v => { const n = Math.min(100, parseInt(v.replace(/[^0-9]/g, "") || "0", 10)); setItemDiscount(String(n)); }}
                        keyboardType="number-pad"
                        maxLength={3}
                      />
                      <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.textSecondary, paddingRight: 4 }}>%</Text>
                      <TouchableOpacity
                        style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                        onPress={() => { const n = Math.min(100, parseInt(itemDiscount || "0", 10) + 1); setItemDiscount(String(n)); }}
                      >
                        <Feather name="plus" size={14} color={Colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Line total */}
                  {parseInt(quantity, 10) > 0 && (
                    <View style={styles.previewCard}>
                      {(() => {
                        const qty = parseInt(quantity, 10);
                        const discPct = Math.min(100, Math.max(0, parseInt(itemDiscount || "0", 10)));
                        const lineTotal = qty * selectedProduct.salesPrice;
                        const discounted = Math.round(lineTotal * (1 - discPct / 100));
                        return (
                          <>
                            {discPct > 0 && (
                              <View style={styles.previewRow}>
                                <Text style={styles.previewLabel}>Original</Text>
                                <Text style={[styles.previewVal, { textDecorationLine: "line-through", color: Colors.textLight }]}>
                                  Rs. {lineTotal.toLocaleString()}
                                </Text>
                              </View>
                            )}
                            <View style={styles.previewRow}>
                              <Text style={styles.previewLabel}>{discPct > 0 ? `After ${discPct}% Off` : "Line Total"}</Text>
                              <Text style={[styles.previewVal, { color: Colors.primary, fontWeight: "700" }]}>
                                Rs. {discounted.toLocaleString()}
                              </Text>
                            </View>
                          </>
                        );
                      })()}
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
                    const discounted = Math.round(lineTotal * (1 - c.discountPercent / 100));
                    return (
                      <View key={c.product.id} style={[styles.tableRow, { paddingVertical: 8, borderBottomWidth: idx < cartItems.length - 1 ? 1 : 0, borderBottomColor: "#F0EDE8" }]}>
                        <View style={{ flex: 3 }}>
                          <Text style={styles.colVal} numberOfLines={2}>{c.product.name}</Text>
                          {c.discountPercent > 0 && <Text style={{ fontSize: 10, color: "#10B981", fontWeight: "700" }}>−{c.discountPercent}% off</Text>}
                        </View>
                        <Text style={[styles.colVal, styles.colCenter, { flex: 1 }]}>{c.quantity}</Text>
                        <Text style={[styles.colVal, styles.colRight, { flex: 2 }]}>Rs.{"\u00A0"}{c.product.salesPrice.toLocaleString()}</Text>
                        <Text style={[styles.colVal, styles.colRight, { flex: 2, fontWeight: c.discountPercent > 0 ? "700" : "400" }]}>Rs.{"\u00A0"}{discounted.toLocaleString()}</Text>
                      </View>
                    );
                  })}
                  {cartItems.some(c => c.discountPercent > 0) && (
                    <View style={[styles.tableRow, { paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#F0EDE8" }]}>
                      <Text style={[styles.colHead, { flex: 1 }]}>Subtotal</Text>
                      <Text style={[styles.colVal, styles.colRight, { flex: 1 }]}>Rs.{"\u00A0"}{cartSubtotal.toLocaleString()}</Text>
                    </View>
                  )}
                  {billDiscountPct > 0 && (
                    <View style={[styles.tableRow, { paddingVertical: 6 }]}>
                      <Text style={[styles.colHead, { flex: 1, color: "#10B981" }]}>Bill Disc ({billDiscountPct}%)</Text>
                      <Text style={[styles.colVal, styles.colRight, { flex: 1, color: "#10B981" }]}>−Rs.{"\u00A0"}{billDiscountAmt.toLocaleString()}</Text>
                    </View>
                  )}
                  <View style={styles.totalFooter}>
                    <Text style={styles.totalFooterLabel}>Grand Total</Text>
                    <Text style={styles.totalFooterValue}>Rs. {cartFinalAmount.toLocaleString()}</Text>
                  </View>
                </View>
              </View>

              {/* Bill-level discount */}
              <View style={[styles.summaryCard, { marginTop: -2 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.text }}>Bill Discount (%)</Text>
                    <Text style={{ fontSize: 11, color: Colors.textLight, marginTop: 2 }}>Applied to the whole bill</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E5E0DB", borderRadius: 10, backgroundColor: "#FFF", overflow: "hidden" }}>
                    <TouchableOpacity
                      style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                      onPress={() => { const n = Math.max(0, parseInt(billDiscount || "0", 10) - 1); setBillDiscount(String(n)); }}
                    >
                      <Feather name="minus" size={14} color={Colors.primary} />
                    </TouchableOpacity>
                    <TextInput
                      style={{ width: 44, textAlign: "center", fontSize: 15, fontWeight: "700", color: Colors.text }}
                      value={billDiscount}
                      onChangeText={v => { const n = Math.min(100, parseInt(v.replace(/[^0-9]/g, "") || "0", 10)); setBillDiscount(String(n)); }}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.textSecondary, paddingRight: 4 }}>%</Text>
                    <TouchableOpacity
                      style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                      onPress={() => { const n = Math.min(100, parseInt(billDiscount || "0", 10) + 1); setBillDiscount(String(n)); }}
                    >
                      <Feather name="plus" size={14} color={Colors.primary} />
                    </TouchableOpacity>
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
        <BackButton />
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
              onEdit={setEditingOrder}
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

      <SalesmanEditOrderModal
        order={editingOrder}
        visible={editingOrder !== null}
        onClose={() => setEditingOrder(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["orders"] })}
      />
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

  pendingCardWrapper: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
    marginBottom: 12,
    shadowColor: "#F59E0B",
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    elevation: 0,
  },
  pendingBadgeStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#FDE68A",
  },
  pendingBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400E",
    letterSpacing: 0.3,
  },
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
  cardTotalInline: { fontSize: 12, fontWeight: "700", color: Colors.primary },
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

  orderActionRow: {
    flexDirection: "row" as const, gap: 10,
    marginHorizontal: 16, marginBottom: 14, marginTop: -6,
  },
  orderActionBtn: {
    flex: 1, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const,
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  orderEditBtn: {
    backgroundColor: "#FFF4EC",
    borderColor: `${Colors.primary}40`,
  },
  orderCancelBtn: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
  },
  orderActionBtnText: { fontSize: 14, fontWeight: "600" as const },
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

// ─── Edit Order Modal Styles ──────────────────────────────────────────────────
const editModal = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F8FA" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EEEEEE",
  },
  headerBtn: { width: 36, height: 36, justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
  headerSub: { fontSize: 12, color: "#888", marginTop: 1 },
  saveBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, minWidth: 60, alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  tabRow: {
    flexDirection: "row", gap: 10, padding: 12, paddingHorizontal: 16,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EEEEEE",
  },
  tabBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F0F0F0",
  },
  tabBtnActive: { backgroundColor: `${Colors.primary}15`, borderWidth: 1, borderColor: `${Colors.primary}30` },
  tabBtnText: { fontSize: 13, fontWeight: "600", color: "#888" },
  tabBtnTextActive: { color: Colors.primary },

  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEE2E2", padding: 12, paddingHorizontal: 16,
  },
  errorText: { fontSize: 13, color: "#EF4444", flex: 1 },

  emptyState: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
  emptyText: { fontSize: 13, color: "#888", textAlign: "center" },
  addTabBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, marginTop: 8,
  },
  addTabBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },

  cartRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#EEEEEE",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cartItemName: { fontSize: 14, fontWeight: "600", color: "#1A1A1A", marginBottom: 2 },
  cartItemPrice: { fontSize: 12, color: "#888" },
  cartItemTotal: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1,
    borderColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  qtyInput: {
    width: 44, height: 30, borderWidth: 1, borderColor: "#E0E0E0",
    borderRadius: 8, fontSize: 13, fontWeight: "600", color: "#1A1A1A",
    backgroundColor: "#F8F8F8", textAlign: "center", textAlignVertical: "center",
  },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12, padding: 16, marginTop: 8,
    borderWidth: 1, borderColor: "#EEEEEE",
  },
  totalLabel: { fontSize: 13, fontWeight: "600", color: "#888", textTransform: "uppercase", letterSpacing: 0.5 },
  totalValue: { fontSize: 18, fontWeight: "700", color: "#1A1A1A" },

  selectedCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: `${Colors.primary}0D`, borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: `${Colors.primary}40`,
  },
  selectedName: { fontSize: 15, fontWeight: "700", color: Colors.primary },
  selectedPrice: { fontSize: 12, color: "#888", marginTop: 2 },

  qtyRowCenter: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginVertical: 12 },
  qtyInputLarge: {
    width: 64, height: 36, borderWidth: 1.5, borderColor: "#E0E0E0",
    borderRadius: 10, fontSize: 15, fontWeight: "600", color: "#1A1A1A",
    backgroundColor: "#fff", textAlign: "center", textAlignVertical: "center",
  },
  previewTotal: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: "#EEEEEE",
  },
  addToCartBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: Colors.primary, padding: 14, borderRadius: 12,
  },
  addToCartBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  catHeader: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, marginTop: 14, marginBottom: 6 },
  catHeaderText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  productRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: "#EEEEEE",
  },
  productRowInCart: { borderColor: "#10B981", backgroundColor: "#F0FDF4" },
  productName: { fontSize: 14, fontWeight: "600", color: "#1A1A1A" },
  productPrice: { fontSize: 12, color: "#888", marginTop: 2 },
  inCartBadge: { backgroundColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  inCartText: { fontSize: 11, fontWeight: "700", color: "#059669" },
});
