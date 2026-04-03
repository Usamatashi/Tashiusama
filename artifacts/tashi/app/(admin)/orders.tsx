import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { Asset } from "expo-asset";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { BackButton } from "@/components/BackButton";

// ─── Types ────────────────────────────────────────────────────────────────────
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
  status: "pending" | "confirmed" | "dispatched" | "cancelled";
  createdAt: string;
  retailerName: string | null;
  retailerPhone: string | null;
  totalPoints: number;
  bonusPoints: number;
  totalValue: number;
  items: OrderItem[];
}

type ProductCategory = "disc_pad" | "brake_shoes" | "other";
interface Product {
  id: number;
  name: string;
  points: number;
  salesPrice: number;
  category: ProductCategory;
}

interface CartItem {
  product: Product;
  quantity: number;
}

// ─── API helpers ──────────────────────────────────────────────────────────────
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

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#10B981",
  dispatched: "#3B82F6",
  cancelled: "#EF4444",
};
const STATUS_BG: Record<string, string> = {
  pending: "#FEF3C7",
  confirmed: "#D1FAE5",
  dispatched: "#DBEAFE",
  cancelled: "#FEE2E2",
};

const CATEGORY_META: Record<ProductCategory, { label: string; color: string; bg: string }> = {
  disc_pad:    { label: "Disc Pads",      color: "#E87722", bg: "#FFF4EC" },
  brake_shoes: { label: "Brake Shoes",    color: "#2563EB", bg: "#EFF6FF" },
  other:       { label: "Other Products", color: "#7B2FBE", bg: "#F5F0FF" },
};
const CATEGORY_ORDER: ProductCategory[] = ["disc_pad", "brake_shoes", "other"];

type FilterTab = "all" | "pending" | "confirmed" | "dispatched" | "cancelled";

// ─── Edit Order Modal ─────────────────────────────────────────────────────────
function EditOrderModal({
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

  // Populate cart when modal opens with existing order items
  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch("/products"),
    enabled: visible,
  });

  React.useEffect(() => {
    if (visible && order && products.length > 0) {
      const initialCart: CartItem[] = order.items
        .map(item => {
          const product = products.find(p => p.id === item.productId);
          if (!product) return null;
          return { product, quantity: item.quantity };
        })
        .filter((x): x is CartItem => x !== null);
      setCart(initialCart);
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
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
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
    if (cart.length === 0) {
      setSaveError("Order must have at least one product.");
      return;
    }
    setSaveError("");
    saveItemsMutation.mutate(cart.map(c => ({ productId: c.product.id, quantity: c.quantity })));
  };

  const cartTotal = cart.reduce((s, c) => s + c.product.salesPrice * c.quantity, 0);

  if (!order) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={editStyles.root}>
        {/* Header */}
        <View style={editStyles.header}>
          <TouchableOpacity onPress={onClose} style={editStyles.headerBtn}>
            <Feather name="x" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={editStyles.headerTitle}>Edit Order #{order.id}</Text>
            <Text style={editStyles.headerSub}>{order.retailerName || order.retailerPhone || "Retailer"}</Text>
          </View>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saveItemsMutation.isPending || cart.length === 0}
            style={[editStyles.saveBtn, (saveItemsMutation.isPending || cart.length === 0) && editStyles.saveBtnDisabled]}
          >
            {saveItemsMutation.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={editStyles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={editStyles.tabRow}>
          <TouchableOpacity
            style={[editStyles.tabBtn, tab === "cart" && editStyles.tabBtnActive]}
            onPress={() => setTab("cart")}
          >
            <Feather name="shopping-cart" size={14} color={tab === "cart" ? Colors.primary : Colors.textSecondary} />
            <Text style={[editStyles.tabBtnText, tab === "cart" && editStyles.tabBtnTextActive]}>
              Cart ({cart.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[editStyles.tabBtn, tab === "add" && editStyles.tabBtnActive]}
            onPress={() => setTab("add")}
          >
            <Feather name="plus-circle" size={14} color={tab === "add" ? Colors.primary : Colors.textSecondary} />
            <Text style={[editStyles.tabBtnText, tab === "add" && editStyles.tabBtnTextActive]}>
              Add Products
            </Text>
          </TouchableOpacity>
        </View>

        {saveError ? (
          <View style={editStyles.errorBanner}>
            <Feather name="alert-circle" size={14} color="#EF4444" />
            <Text style={editStyles.errorText}>{saveError}</Text>
          </View>
        ) : null}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          {/* ── Cart Tab ── */}
          {tab === "cart" && (
            <View>
              {cart.length === 0 ? (
                <View style={editStyles.emptyState}>
                  <Feather name="shopping-cart" size={44} color={Colors.border} />
                  <Text style={editStyles.emptyTitle}>Cart is empty</Text>
                  <Text style={editStyles.emptyText}>Tap "Add Products" to add items</Text>
                  <TouchableOpacity style={editStyles.addTabBtn} onPress={() => setTab("add")}>
                    <Feather name="plus" size={16} color="#fff" />
                    <Text style={editStyles.addTabBtnText}>Add Products</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {cart.map((c, idx) => (
                    <View key={c.product.id} style={editStyles.cartRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={editStyles.cartItemName}>{c.product.name}</Text>
                        <Text style={editStyles.cartItemPrice}>
                          Rs. {c.product.salesPrice.toLocaleString()} / unit
                        </Text>
                      </View>
                      <View style={editStyles.qtyControls}>
                        <TouchableOpacity
                          style={editStyles.qtyBtn}
                          onPress={() => updateQty(c.product.id, c.quantity - 1)}
                        >
                          <Feather name="minus" size={14} color={Colors.primary} />
                        </TouchableOpacity>
                        <TextInput
                          style={editStyles.qtyInput}
                          value={String(c.quantity)}
                          onChangeText={v => {
                            const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
                            if (!isNaN(n) && n >= 1) updateQty(c.product.id, n);
                          }}
                          keyboardType="number-pad"
                          textAlign="center"
                        />
                        <TouchableOpacity
                          style={editStyles.qtyBtn}
                          onPress={() => updateQty(c.product.id, c.quantity + 1)}
                        >
                          <Feather name="plus" size={14} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
                      <View style={{ alignItems: "flex-end", minWidth: 80, marginLeft: 8 }}>
                        <Text style={editStyles.cartItemTotal}>
                          Rs. {(c.product.salesPrice * c.quantity).toLocaleString()}
                        </Text>
                        <TouchableOpacity onPress={() => removeFromCart(c.product.id)} style={{ marginTop: 4 }}>
                          <Feather name="trash-2" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}

                  <View style={editStyles.totalRow}>
                    <Text style={editStyles.totalLabel}>Order Total</Text>
                    <Text style={editStyles.totalValue}>Rs. {cartTotal.toLocaleString()}</Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── Add Products Tab ── */}
          {tab === "add" && (
            <View>
              {selectedProduct ? (
                <View>
                  <View style={editStyles.selectedProductCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={editStyles.selectedProductName}>{selectedProduct.name}</Text>
                      <Text style={editStyles.selectedProductPrice}>Rs. {selectedProduct.salesPrice.toLocaleString()} / unit</Text>
                    </View>
                    <TouchableOpacity onPress={() => { setSelectedProduct(null); setQuantity("1"); }}>
                      <Feather name="x" size={18} color={Colors.textLight} />
                    </TouchableOpacity>
                  </View>

                  <View style={editStyles.qtyRowStandalone}>
                    <TouchableOpacity style={editStyles.qtyBtn} onPress={() => setQuantity(String(Math.max(1, parseInt(quantity || "1", 10) - 1)))}>
                      <Feather name="minus" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                    <TextInput
                      style={editStyles.qtyInputLarge}
                      value={quantity}
                      onChangeText={v => setQuantity(v.replace(/[^0-9]/g, ""))}
                      keyboardType="number-pad"
                      textAlign="center"
                    />
                    <TouchableOpacity style={editStyles.qtyBtn} onPress={() => setQuantity(String(parseInt(quantity || "0", 10) + 1))}>
                      <Feather name="plus" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {parseInt(quantity, 10) > 0 && (
                    <View style={editStyles.previewTotal}>
                      <Text style={editStyles.totalLabel}>Line Total</Text>
                      <Text style={[editStyles.totalValue, { color: Colors.primary }]}>
                        Rs. {(parseInt(quantity, 10) * selectedProduct.salesPrice).toLocaleString()}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity style={editStyles.addToCartBtn} onPress={addToCart}>
                    <Feather name="plus-circle" size={18} color="#fff" />
                    <Text style={editStyles.addToCartBtnText}>
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
                      <View style={[editStyles.catHeader, { backgroundColor: meta.bg }]}>
                        <Text style={[editStyles.catHeaderText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                      {catProducts.map(p => {
                        const inCart = cart.find(c => c.product.id === p.id);
                        return (
                          <TouchableOpacity
                            key={p.id}
                            style={[editStyles.productRow, inCart && editStyles.productRowInCart]}
                            onPress={() => { Haptics.selectionAsync(); setSelectedProduct(p); setQuantity(inCart ? String(inCart.quantity) : "1"); }}
                            activeOpacity={0.7}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={editStyles.productName}>{p.name}</Text>
                              <Text style={editStyles.productPrice}>Rs. {p.salesPrice.toLocaleString()} / unit</Text>
                            </View>
                            {inCart ? (
                              <View style={editStyles.inCartBadge}>
                                <Text style={editStyles.inCartText}>{inCart.quantity} in cart</Text>
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
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Bill Modal ───────────────────────────────────────────────────────────────
function BillModal({
  order,
  visible,
  onClose,
}: {
  order: Order | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [sharing, setSharing] = useState(false);

  if (!order) return null;

  const items = order.items ?? [];
  const grandTotal = order.totalValue ?? items.reduce((s, i) => s + i.totalValue, 0);
  const date = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const time = new Date(order.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  const handleShare = async () => {
    Haptics.selectionAsync();
    setSharing(true);
    try {
      if (Platform.OS === "web") {
        Alert.alert("Share", "PDF sharing is only available on mobile devices.");
        return;
      }

      let logoDataUri = "";
      try {
        const logoAsset = Asset.fromModule(require("@/assets/images/tashi-logo.png"));
        await logoAsset.downloadAsync();
        if (logoAsset.localUri) {
          const logoBase64 = await FileSystem.readAsStringAsync(logoAsset.localUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          logoDataUri = `data:image/png;base64,${logoBase64}`;
        }
      } catch {
        // Logo loading failed, will use text fallback in PDF
      }

      const itemRows = items.map(i => `
        <tr>
          <td>${i.productName || "Product"}</td>
          <td style="text-align:center">${i.quantity}</td>
          <td style="text-align:right">Rs. ${i.totalValue.toLocaleString()}</td>
        </tr>
      `).join("");

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1"/>
          <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family: Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 32px 28px; }
            .accent { background: #E87722; height: 8px; border-radius: 4px; margin-bottom: 28px; }
            .header { text-align: center; margin-bottom: 24px; }
            .header img { width: 180px; }
            .divider { border: none; border-top: 1px solid #eee; margin: 20px 0; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; background: #f9f9fb; border-radius: 12px; padding: 16px; }
            .meta-label { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
            .meta-value { font-size: 14px; font-weight: 700; color: #1a1a2e; }
            .customer-box { display: flex; align-items: center; gap: 14px; background: #fff8f4; border: 1px solid rgba(232,119,34,0.2); border-radius: 12px; padding: 14px; margin-bottom: 20px; }
            .customer-icon { width: 42px; height: 42px; background: rgba(232,119,34,0.12); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
            .customer-name { font-size: 16px; font-weight: 700; }
            .customer-phone { font-size: 13px; color: #888; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; font-size: 14px; }
            thead tr { background: #f7f8fa; }
            thead th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #888; }
            thead th:nth-child(2) { text-align: center; }
            thead th:nth-child(3) { text-align: right; }
            tbody tr { border-bottom: 1px solid #f0f0f0; }
            tbody td { padding: 12px; vertical-align: middle; }
            .total-row { background: #E87722; color: #fff; border-radius: 10px; }
            .total-row td { padding: 14px 12px; font-weight: 700; font-size: 15px; }
            .footer { text-align: center; margin-top: 32px; color: #bbb; font-size: 12px; }
            .footer strong { color: #E87722; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="accent"></div>
          <div class="header">
            ${logoDataUri
              ? `<img src="${logoDataUri}" style="width:180px;height:auto;" alt="Tashi" />`
              : `<strong style="font-size:28px;color:#E87722;letter-spacing:1px;">TASHI</strong>`
            }
          </div>
          <hr class="divider"/>
          <div class="meta-grid">
            <div>
              <div class="meta-label">Order No.</div>
              <div class="meta-value">#${order.id}</div>
            </div>
            <div>
              <div class="meta-label">Date</div>
              <div class="meta-value">${date}</div>
            </div>
            <div>
              <div class="meta-label">Time</div>
              <div class="meta-value">${time}</div>
            </div>
            <div>
              <div class="meta-label">Status</div>
              <div class="meta-value" style="color:#3b82f6">DISPATCHED</div>
            </div>
          </div>
          <div class="customer-box">
            <div class="customer-icon">👤</div>
            <div>
              <div class="customer-name">${order.retailerName || "Customer"}</div>
              ${order.retailerPhone ? `<div class="customer-phone">${order.retailerPhone}</div>` : ""}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style="text-align:center">Qty</th>
                <th style="text-align:right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="2">Grand Total</td>
                <td style="text-align:right">Rs. ${grandTotal.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
          <div class="footer">
            <p>Thank you for your business!</p>
            <br/>
            <strong>Tashi</strong>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Sharing unavailable", "Your device does not support sharing.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Tashi Bill – Order #${order.id}`,
        UTI: "com.adobe.pdf",
      });
    } catch (e) {
      Alert.alert("Error", "Could not generate the bill PDF. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={billStyles.root}>
        {/* Header bar */}
        <View style={billStyles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={billStyles.closeBtn}>
            <Feather name="x" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={billStyles.modalTitle}>Dispatch Bill</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          {/* Bill card */}
          <View style={billStyles.billCard}>
            {/* Top accent stripe */}
            <View style={billStyles.accentStripe} />

            {/* Logo */}
            <View style={billStyles.logoRow}>
              <Image
                source={require("@/assets/images/tashi-logo.png")}
                style={billStyles.logo}
                resizeMode="contain"
              />
            </View>

            {/* Divider */}
            <View style={billStyles.divider} />

            {/* Order meta */}
            <View style={billStyles.metaGrid}>
              <View style={billStyles.metaItem}>
                <Text style={billStyles.metaLabel}>ORDER NO.</Text>
                <Text style={billStyles.metaValue}>#{order.id}</Text>
              </View>
              <View style={billStyles.metaItem}>
                <Text style={billStyles.metaLabel}>DATE</Text>
                <Text style={billStyles.metaValue}>{date}</Text>
              </View>
              <View style={billStyles.metaItem}>
                <Text style={billStyles.metaLabel}>TIME</Text>
                <Text style={billStyles.metaValue}>{time}</Text>
              </View>
              <View style={billStyles.metaItem}>
                <Text style={billStyles.metaLabel}>STATUS</Text>
                <View style={billStyles.dispatchedChip}>
                  <Text style={billStyles.dispatchedChipText}>DISPATCHED</Text>
                </View>
              </View>
            </View>

            {/* Customer info */}
            <View style={billStyles.customerBox}>
              <View style={billStyles.customerIcon}>
                <Feather name="user" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={billStyles.customerName}>{order.retailerName || "Customer"}</Text>
                {order.retailerPhone ? (
                  <Text style={billStyles.customerPhone}>{order.retailerPhone}</Text>
                ) : null}
              </View>
            </View>

            {/* Items table */}
            <View style={billStyles.tableHeader}>
              <Text style={[billStyles.th, { flex: 3 }]}>PRODUCT</Text>
              <Text style={[billStyles.th, billStyles.thCenter, { flex: 1 }]}>QTY</Text>
              <Text style={[billStyles.th, billStyles.thRight, { flex: 2 }]}>TOTAL</Text>
            </View>
            <View style={billStyles.tableDivider} />

            {items.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <Text style={{ color: Colors.textLight, fontFamily: "Inter_400Regular" }}>No items</Text>
              </View>
            ) : (
              items.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    billStyles.tableRow,
                    idx % 2 === 0 ? billStyles.tableRowEven : null,
                  ]}
                >
                  <Text style={[billStyles.td, { flex: 3 }]} numberOfLines={2}>{item.productName || "—"}</Text>
                  <Text style={[billStyles.td, billStyles.tdCenter, { flex: 1 }]}>{item.quantity}</Text>
                  <Text style={[billStyles.td, billStyles.tdRight, billStyles.tdTotal, { flex: 2 }]}>
                    Rs. {item.totalValue.toLocaleString()}
                  </Text>
                </View>
              ))
            )}

            <View style={billStyles.tableDivider} />

            {/* Grand total */}
            <View style={billStyles.grandTotalRow}>
              <Text style={billStyles.grandTotalLabel}>GRAND TOTAL</Text>
              <Text style={billStyles.grandTotalValue}>Rs. {grandTotal.toLocaleString()}</Text>
            </View>

            {/* Footer */}
            <View style={billStyles.billFooter}>
              <Text style={billStyles.footerText}>Thank you for your business!</Text>
              <Text style={billStyles.footerBrand}>Tashi</Text>
            </View>
          </View>

          {/* Share button */}
          <TouchableOpacity
            style={[billStyles.shareBtn, sharing && { opacity: 0.7 }]}
            onPress={handleShare}
            activeOpacity={0.85}
            disabled={sharing}
          >
            {sharing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="share-2" size={18} color="#fff" />}
            <Text style={billStyles.shareBtnText}>{sharing ? "Preparing..." : "Send to Customer"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({
  order,
  onCancel,
  onEdit,
  onDispatch,
  onSendBill,
  isUpdating,
}: {
  order: Order;
  onCancel: (id: number) => void;
  onEdit: (order: Order) => void;
  onDispatch: (id: number) => void;
  onSendBill: (order: Order) => void;
  isUpdating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const date = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const items = order.items ?? [];
  const grandTotal = order.totalValue ?? items.reduce((s, i) => s + i.totalValue, 0);

  return (
    <View style={styles.card}>
      {/* Tappable header — always visible */}
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => { Haptics.selectionAsync(); setExpanded(prev => !prev); }}
        activeOpacity={0.7}
      >
        <View style={styles.avatarCircle}>
          <Feather name="user" size={16} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.retailerName} numberOfLines={1}>
            {order.retailerName || order.retailerPhone || "—"}
          </Text>
          <Text style={styles.cardDate}>{date}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <View style={[styles.statusPill, { backgroundColor: STATUS_BG[order.status] }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[order.status] }]}>
              {order.status.toUpperCase()}
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

      {/* Expanded: invoice table + actions */}
      {expanded && (
        <>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.colHead, { flex: 3 }]}>PRODUCT</Text>
              <Text style={[styles.colHead, styles.colCenter, { flex: 1 }]}>QTY</Text>
              <Text style={[styles.colHead, styles.colRight, { flex: 2 }]}>PRICE</Text>
              <Text style={[styles.colHead, styles.colRight, { flex: 2 }]}>TOTAL</Text>
            </View>
            <View style={styles.tableDivider} />

            {items.length === 0 ? (
              <View style={[styles.tableRow, { paddingVertical: 12 }]}>
                <Text style={[styles.colVal, { color: Colors.textLight }]}>No items</Text>
              </View>
            ) : (
              items.map((item, idx) => (
                <View key={idx} style={[styles.tableRow, { paddingVertical: 8, borderBottomWidth: idx < items.length - 1 ? 1 : 0, borderBottomColor: "#F0EDE8" }]}>
                  <Text style={[styles.colVal, { flex: 3 }]} numberOfLines={2}>{item.productName || "—"}</Text>
                  <Text style={[styles.colVal, styles.colCenter, { flex: 1 }]}>{item.quantity}</Text>
                  <Text style={[styles.colVal, styles.colRight, { flex: 2 }]}>
                    {item.unitPrice > 0 ? item.unitPrice.toLocaleString() : "—"}
                  </Text>
                  <Text style={[styles.colVal, styles.colRight, styles.colTotal, { flex: 2 }]}>
                    {item.totalValue > 0 ? item.totalValue.toLocaleString() : "—"}
                  </Text>
                </View>
              ))
            )}

            <View style={styles.totalFooter}>
              <Text style={styles.totalFooterLabel}>Order Total</Text>
              <Text style={styles.totalFooterValue}>Rs. {grandTotal.toLocaleString()}</Text>
            </View>
          </View>

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
                style={[styles.actionBtn, styles.dispatchBtn]}
                onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onDispatch(order.id); }}
                disabled={isUpdating}
                activeOpacity={0.8}
              >
                {isUpdating
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                      <Feather name="send" size={15} color="#fff" />
                      <Text style={[styles.actionBtnText, { color: "#fff" }]}>Dispatch</Text>
                    </>}
              </TouchableOpacity>
            </View>
          )}

          {order.status === "confirmed" && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.editBtn]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onEdit(order); }}
                disabled={isUpdating}
                activeOpacity={0.8}
              >
                <Feather name="edit-2" size={15} color={Colors.primary} />
                <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.dispatchBtn]}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  onDispatch(order.id);
                }}
                disabled={isUpdating}
                activeOpacity={0.8}
              >
                {isUpdating
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                      <Feather name="send" size={15} color="#fff" />
                      <Text style={[styles.actionBtnText, { color: "#fff" }]}>Dispatch</Text>
                    </>}
              </TouchableOpacity>
            </View>
          )}

          {order.status === "dispatched" && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.sendBillBtn]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSendBill(order); }}
                activeOpacity={0.8}
              >
                <Feather name="file-text" size={15} color="#fff" />
                <Text style={[styles.actionBtnText, { color: "#fff" }]}>Send Bill</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AdminOrdersScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [dispatchingId, setDispatchingId] = useState<number | null>(null);
  const [billOrder, setBillOrder] = useState<Order | null>(null);

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
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["retailer-orders"] });
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status: "dispatched" }) }),
    onMutate: (id) => setDispatchingId(id),
    onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    onSettled: () => {
      setDispatchingId(null);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  const handleCancel = useCallback((id: number) => {
    Alert.alert("Cancel Order", "Are you sure you want to cancel this order?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: () => updateStatus.mutate({ id, status: "cancelled" }),
      },
    ]);
  }, [updateStatus]);

  const FILTERS: FilterTab[] = ["all", "pending", "confirmed", "dispatched", "cancelled"];
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const pendingCount = orders.filter(o => o.status === "pending").length;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton color={Colors.adminAccent} fallback="/(admin)" />
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
              onCancel={handleCancel}
              onEdit={setEditingOrder}
              onDispatch={(id) => dispatchMutation.mutate(id)}
              onSendBill={setBillOrder}
              isUpdating={updatingId === item.id || dispatchingId === item.id}
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

      <EditOrderModal
        order={editingOrder}
        visible={editingOrder !== null}
        onClose={() => setEditingOrder(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["admin-orders"] })}
      />

      <BillModal
        order={billOrder}
        visible={billOrder !== null}
        onClose={() => setBillOrder(null)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${Colors.adminAccent}18`, justifyContent: "center", alignItems: "center" },
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
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  cardTotalInline: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },

  table: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 },
  tableRow: { flexDirection: "row", alignItems: "center" },
  tableDivider: { height: 1, backgroundColor: "#EEEEEE", marginVertical: 8 },
  colHead: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.textLight, letterSpacing: 0.7, textTransform: "uppercase" },
  colVal: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  colCenter: { textAlign: "center" },
  colRight: { textAlign: "right" },
  colTotal: { color: Colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 },

  totalFooter: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderTopWidth: 1, borderTopColor: "#EEEEEE",
    marginTop: 8, paddingTop: 12, paddingBottom: 14,
  },
  totalFooterLabel: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  totalFooterValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },

  actionRow: {
    flexDirection: "row", gap: 10, padding: 14,
    borderTopWidth: 1, borderTopColor: "#F0F0F0",
    backgroundColor: "#FAFAFA",
  },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 11, borderRadius: 10,
  },
  cancelBtn: { backgroundColor: "#FEE2E2" },
  editBtn: { backgroundColor: `${Colors.primary}12`, borderWidth: 1, borderColor: `${Colors.primary}30` },
  dispatchBtn: { backgroundColor: "#3B82F6" },
  sendBillBtn: { backgroundColor: Colors.primary },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
});

// ─── Bill Styles ──────────────────────────────────────────────────────────────
const billStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F4F6FA" },

  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: { width: 36, height: 36, justifyContent: "center" },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text },

  billCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  accentStripe: {
    height: 6,
    backgroundColor: Colors.primary,
  },

  logoRow: {
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  logo: { width: 240, height: 80 },
  billBadge: {
    backgroundColor: `${Colors.primary}15`,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: `${Colors.primary}30`,
  },
  billBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.primary, letterSpacing: 0.8 },

  divider: { height: 1, backgroundColor: "#F0EDE8", marginHorizontal: 20 },

  metaGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 12,
  },
  metaItem: { width: "45%", gap: 4 },
  metaLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.textLight,
    letterSpacing: 0.8, textTransform: "uppercase",
  },
  metaValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text },
  dispatchedChip: {
    backgroundColor: "#DBEAFE", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start",
  },
  dispatchedChipText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#3B82F6", letterSpacing: 0.6 },

  customerBox: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 20, marginTop: 8, marginBottom: 16,
    backgroundColor: "#FFF8F4", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: `${Colors.primary}20`,
  },
  customerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: `${Colors.primary}18`, alignItems: "center", justifyContent: "center",
  },
  customerName: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  customerPhone: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },

  tableHeader: {
    flexDirection: "row", paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: "#F7F8FA",
  },
  th: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.textLight, letterSpacing: 0.8, textTransform: "uppercase" },
  thCenter: { textAlign: "center" },
  thRight: { textAlign: "right" },
  tableDivider: { height: 1, backgroundColor: "#EEEEEE", marginHorizontal: 20 },
  tableRow: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 12 },
  tableRowEven: { backgroundColor: "#FAFAFA" },
  td: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  tdCenter: { textAlign: "center" },
  tdRight: { textAlign: "right" },
  tdTotal: { fontFamily: "Inter_700Bold", color: Colors.primary },

  grandTotalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 18,
    backgroundColor: `${Colors.primary}08`,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.8,
  },
  grandTotalValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.primary },

  billFooter: {
    alignItems: "center", paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: "#F0EDE8",
    gap: 4,
  },
  footerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  footerBrand: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.primary, letterSpacing: 1 },

  shareBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16, borderRadius: 16,
    marginTop: 20,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  shareBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});

const editStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F8FA" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerBtn: { width: 36, height: 36, justifyContent: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  saveBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, minWidth: 60, alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },

  tabRow: {
    flexDirection: "row", gap: 10, padding: 12, paddingHorizontal: 16,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tabBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F0F0F0",
  },
  tabBtnActive: { backgroundColor: `${Colors.primary}15`, borderWidth: 1, borderColor: `${Colors.primary}30` },
  tabBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  tabBtnTextActive: { color: Colors.primary },

  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEE2E2", padding: 12, paddingHorizontal: 16,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#EF4444", flex: 1 },

  emptyState: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  addTabBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, marginTop: 8,
  },
  addTabBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  cartRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#EEEEEE",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cartItemName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 2 },
  cartItemPrice: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  cartItemTotal: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.primary },
  qtyControls: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1,
    borderColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  qtyInput: {
    width: 36, height: 30, borderWidth: 1, borderColor: "#E0E0E0",
    borderRadius: 8, fontSize: 13, fontFamily: "Inter_600SemiBold",
    color: Colors.text, backgroundColor: "#F8F8F8",
  },

  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12, padding: 16, marginTop: 8,
    borderWidth: 1, borderColor: "#EEEEEE",
  },
  totalLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  totalValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },

  selectedProductCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: `${Colors.primary}0D`, borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: `${Colors.primary}40`,
  },
  selectedProductName: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.primary },
  selectedProductPrice: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },

  qtyRowStandalone: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 20, marginVertical: 12,
  },
  qtyInputLarge: {
    width: 64, height: 44, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 10, fontSize: 18, fontFamily: "Inter_700Bold",
    color: Colors.text, backgroundColor: "#fff",
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
  addToCartBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },

  catHeader: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, marginTop: 14, marginBottom: 6,
  },
  catHeaderText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  productRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: "#EEEEEE",
  },
  productRowInCart: { borderColor: "#10B981", backgroundColor: "#F0FDF4" },
  productName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  productPrice: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  inCartBadge: { backgroundColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  inCartText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#059669" },
});
