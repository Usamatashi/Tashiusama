import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { useAdminSettings } from "@/context/AdminSettingsContext";
import { Colors } from "@/constants/colors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ProductCategory = "disc_pad" | "brake_shoes" | "other";

interface Product {
  id: number;
  name: string;
  points: number;
  salesPrice: number;
  category: ProductCategory;
  imageBase64: string | null;
  createdAt: string;
}

const CATEGORIES: { key: ProductCategory; label: string; icon: React.ComponentProps<typeof Feather>["name"]; color: string; bg: string }[] = [
  { key: "disc_pad",    label: "Disc Pad",      icon: "circle",   color: "#E87722", bg: "#FFF4EC" },
  { key: "brake_shoes", label: "Brake Shoes",   icon: "truck",    color: "#2563EB", bg: "#EFF6FF" },
  { key: "other",       label: "Other Products",icon: "box",      color: "#7B2FBE", bg: "#F5F0FF" },
];

function categoryMeta(key: ProductCategory) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[2];
}

const SECTION_TITLES: Record<ProductCategory, string> = {
  disc_pad:    "Disc Pads",
  brake_shoes: "Brake Shoes",
  other:       "Other Products",
};

type Step = "category" | "details" | "image";

function ImageLightbox({ product, onClose }: { product: Product; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const meta = categoryMeta(product.category ?? "other");
  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={lbStyles.overlay}>
        <TouchableOpacity
          style={[lbStyles.closeBtn, { top: insets.top + 16 }]}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Feather name="x" size={20} color="#fff" />
        </TouchableOpacity>
        {product.imageBase64 ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${product.imageBase64}` }}
            style={lbStyles.image}
            resizeMode="contain"
          />
        ) : (
          <View style={[lbStyles.placeholder, { backgroundColor: meta.bg }]}>
            <Feather name={meta.icon} size={72} color={meta.color} />
          </View>
        )}
        <View style={[lbStyles.infoCard, { paddingBottom: insets.bottom + 24 }]}>
          <View style={[lbStyles.badge, { backgroundColor: meta.bg }]}>
            <Feather name={meta.icon} size={12} color={meta.color} />
            <Text style={[lbStyles.badgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={lbStyles.name}>{product.name}</Text>
          <View style={lbStyles.priceRow}>
            <Text style={lbStyles.priceLabel}>Price</Text>
            <Text style={lbStyles.price}>Rs. {product.salesPrice.toLocaleString()}</Text>
          </View>
          {product.points > 0 && (
            <View style={lbStyles.pointsRow}>
              <Feather name="star" size={14} color="#E87722" />
              <Text style={lbStyles.pointsText}>{product.points} pts/unit</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const lbStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.93)", justifyContent: "center", alignItems: "center" },
  closeBtn: { position: "absolute", right: 20, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", zIndex: 10 },
  image: { width: SCREEN_WIDTH, height: SCREEN_WIDTH, resizeMode: "contain" },
  placeholder: { width: SCREEN_WIDTH * 0.6, height: SCREEN_WIDTH * 0.6, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  infoCard: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#1A1A1A", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 20, gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  name: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  priceLabel: { fontSize: 13, color: "#999", fontFamily: "Inter_400Regular" },
  price: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#E87722" },
  pointsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  pointsText: { fontSize: 13, color: "#aaa", fontFamily: "Inter_400Regular" },
});

type FilterKey = ProductCategory | "all";

export default function ProductsScreen() {
  const { token, user } = useAuth();
  const { settings } = useAdminSettings();
  const insets = useSafeAreaInsets();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("disc_pad");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState<Step>("category");
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  // Field state
  const [category, setCategory] = useState<ProductCategory>("disc_pad");
  const [name, setName] = useState("");
  const [points, setPoints] = useState("");
  const [salesPrice, setSalesPrice] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [confirmProduct, setConfirmProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lightboxProduct, setLightboxProduct] = useState<Product | null>(null);

  const lastTapRef = useRef<{ id: number; time: number } | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleProductTap = useCallback((item: Product) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === item.id && now - last.time < 350) {
      // Double tap — select
      if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
      lastTapRef.current = null;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedProductId((prev) => (prev === item.id ? null : item.id));
    } else {
      // First tap — wait to confirm it's not a double tap
      lastTapRef.current = { id: item.id, time: now };
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = setTimeout(() => {
        lastTapRef.current = null;
        tapTimerRef.current = null;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setLightboxProduct(item);
      }, 350);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setProducts(await res.json());
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openAdd = () => {
    setEditProduct(null);
    setErrorMsg("");
    setStep("category");
    setCategory("disc_pad");
    setName(""); setPoints(""); setSalesPrice("");
    setImageUri(null); setImageBase64(null);
    setModalVisible(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setErrorMsg("");
    setStep("category");
    setCategory(p.category ?? "other");
    setName(p.name);
    setPoints(String(p.points));
    setSalesPrice(String(p.salesPrice ?? 0));
    setImageUri(p.imageBase64 ? `data:image/jpeg;base64,${p.imageBase64}` : null);
    setImageBase64(p.imageBase64 ?? null);
    setModalVisible(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setErrorMsg("Photo library permission is required to add a product image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !points.trim()) {
      setErrorMsg("Name and points are required");
      return;
    }
    setErrorMsg("");
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const url = editProduct ? `${BASE}/products/${editProduct.id}` : `${BASE}/products`;
      const method = editProduct ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          points: Number(points),
          salesPrice: Number(salesPrice) || 0,
          category,
          imageBase64,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || "Failed to save product"); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
      fetchProducts();
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmProduct) return;
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}/products/${confirmProduct.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setConfirmProduct(null);
        fetchProducts();
      }
    } catch {
    } finally {
      setDeleting(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  // Build SectionList sections (filtered by activeFilter)
  const filteredCategories = activeFilter === "all" ? CATEGORIES : CATEGORIES.filter(c => c.key === activeFilter);
  const sections = filteredCategories.map((cat) => ({
    key: cat.key,
    title: SECTION_TITLES[cat.key],
    meta: cat,
    data: products.filter((p) => (p.category ?? "other") === cat.key),
  })).filter((s) => s.data.length > 0);

  const renderProduct = ({ item }: { item: Product }) => {
    const isSelected = selectedProductId === item.id;
    const meta = categoryMeta(item.category ?? "other");
    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => handleProductTap(item)}
        activeOpacity={0.85}
      >
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); setLightboxProduct(item); }}
          activeOpacity={0.8}
        >
          {item.imageBase64 ? (
            <Image
              source={{ uri: `data:image/jpeg;base64,${item.imageBase64}` }}
              style={styles.productImage}
            />
          ) : (
            <View style={[styles.cardIconWrap, { backgroundColor: meta.bg }]}>
              <Feather name={meta.icon} size={20} color={meta.color} />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.cardLeft}>
          <Text style={styles.productName}>{item.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Feather name="star" size={11} color={meta.color} />
              <Text style={[styles.metaChipText, { color: meta.color }]}>{item.points} pts/unit</Text>
            </View>
          </View>
        </View>
        {item.salesPrice > 0 && (
          <View style={styles.priceWrap}>
            <Text style={styles.priceCurrency}>Rs.</Text>
            <Text style={styles.priceValue}>{item.salesPrice.toLocaleString()}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: { title: string; meta: typeof CATEGORIES[0] } }) => (
    <View style={[styles.sectionHeader, { backgroundColor: section.meta.bg }]}>
      <Feather name={section.meta.icon} size={14} color={section.meta.color} />
      <Text style={[styles.sectionTitle, { color: section.meta.color }]}>{section.title}</Text>
    </View>
  );

  if (user?.role !== "super_admin" && !settings.tab_products) return <Redirect href="/(admin)" />;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        {selectedProduct ? (
          <>
            <TouchableOpacity style={styles.cancelSelBtn} onPress={() => setSelectedProductId(null)} activeOpacity={0.7}>
              <Feather name="x" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitleSelected} numberOfLines={1}>{selectedProduct.name}</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.headerActionBtn, styles.editHeaderBtn]}
                onPress={() => { setSelectedProductId(null); openEdit(selectedProduct); }}
                activeOpacity={0.8}
              >
                <Feather name="edit-2" size={16} color={Colors.adminAccent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerActionBtn, styles.deleteHeaderBtn]}
                onPress={() => { setSelectedProductId(null); setConfirmProduct(selectedProduct); }}
                activeOpacity={0.8}
              >
                <Feather name="trash-2" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.headerTitle}>Products & Points</Text>
            <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
              <Feather name="plus" size={20} color={Colors.white} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Category filter buttons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeFilter === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.filterBtn,
                isActive && { backgroundColor: cat.color, borderColor: cat.color },
                !isActive && { borderColor: cat.color + "55" },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter(isActive ? "all" : cat.key);
              }}
              activeOpacity={0.8}
            >
              <Feather name={cat.icon} size={10} color={isActive ? "#fff" : cat.color} />
              <Text style={[styles.filterBtnText, { color: isActive ? "#fff" : cat.color }]}>
                {cat.label}
              </Text>
              <View style={[styles.filterCount, { backgroundColor: isActive ? "rgba(255,255,255,0.25)" : cat.bg }]}>
                <Text style={[styles.filterCountText, { color: isActive ? "#fff" : cat.color }]}>
                  {products.filter((p) => (p.category ?? "other") === cat.key).length}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {products.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Feather name="box" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>No products yet.{"\n"}Tap + to add one.</Text>
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="inbox" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>No products in this category.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 16 }]}
          refreshing={loading}
          onRefresh={fetchProducts}
          renderItem={renderProduct}
          renderSectionHeader={() => null}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Multi-step Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={[styles.modal, { paddingBottom: bottomPad + 16 }]}>
            <View style={styles.modalHandle} />

            {/* Step indicator */}
            <View style={styles.stepRow}>
              {(["category", "details", "image"] as Step[]).map((s, idx) => (
                <React.Fragment key={s}>
                  <View style={[styles.stepDot, step === s && styles.stepDotActive, (step === "details" && idx === 0) || (step === "image" && idx < 2) ? styles.stepDotDone : {}]} />
                  {idx < 2 && <View style={[styles.stepLine, (step === "details" && idx === 0) || (step === "image" && idx < 2) ? styles.stepLineDone : {}]} />}
                </React.Fragment>
              ))}
            </View>

            {/* STEP 1: Category */}
            {step === "category" && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>{editProduct ? "Edit Product" : "Add Product"}</Text>
                <Text style={styles.stepSubtitle}>Step 1 — Select a category</Text>
                <View style={styles.categoryList}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      style={[styles.categoryCard, category === cat.key && { borderColor: cat.color, borderWidth: 2 }]}
                      onPress={() => { Haptics.selectionAsync(); setCategory(cat.key); }}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.categoryIcon, { backgroundColor: cat.bg }]}>
                        <Feather name={cat.icon} size={24} color={cat.color} />
                      </View>
                      <Text style={[styles.categoryLabel, category === cat.key && { color: cat.color }]}>{cat.label}</Text>
                      {category === cat.key && (
                        <View style={[styles.categoryCheck, { backgroundColor: cat.color }]}>
                          <Feather name="check" size={12} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.saveBtn, { marginTop: 8 }]}
                  onPress={() => setStep("details")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveBtnText}>Next</Text>
                  <Feather name="arrow-right" size={16} color="#fff" />
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* STEP 2: Details */}
            {step === "details" && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>{editProduct ? "Edit Product" : "Add Product"}</Text>
                <Text style={styles.stepSubtitle}>Step 2 — Product details</Text>

                <View style={styles.selectedCatBadge}>
                  <Feather name={categoryMeta(category).icon} size={13} color={categoryMeta(category).color} />
                  <Text style={[styles.selectedCatText, { color: categoryMeta(category).color }]}>
                    {categoryMeta(category).label}
                  </Text>
                </View>

                <View style={styles.modalFields}>
                  <Text style={styles.fieldLabel}>Product Name *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Honda 125"
                    placeholderTextColor={Colors.textLight}
                    value={name}
                    onChangeText={setName}
                    autoCorrect={false}
                  />
                  <Text style={styles.fieldLabel}>Points per Unit *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 100"
                    placeholderTextColor={Colors.textLight}
                    value={points}
                    onChangeText={setPoints}
                    keyboardType="numeric"
                  />
                  <Text style={styles.fieldLabel}>Sales Price (Rs.)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 250000"
                    placeholderTextColor={Colors.textLight}
                    value={salesPrice}
                    onChangeText={setSalesPrice}
                    keyboardType="numeric"
                  />
                  {errorMsg ? (
                    <View style={styles.errorBox}>
                      <Feather name="alert-circle" size={14} color="#EF4444" />
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep("category")} activeOpacity={0.8}>
                    <Feather name="arrow-left" size={16} color={Colors.textSecondary} />
                    <Text style={styles.cancelBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => {
                      if (!name.trim() || !points.trim()) {
                        setErrorMsg("Name and points are required");
                        return;
                      }
                      setErrorMsg("");
                      setStep("image");
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.saveBtnText}>Next</Text>
                    <Feather name="arrow-right" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {/* STEP 3: Image */}
            {step === "image" && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>{editProduct ? "Edit Product" : "Add Product"}</Text>
                <Text style={styles.stepSubtitle}>Step 3 — Product image (optional)</Text>

                <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.85}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Feather name="camera" size={36} color={Colors.textLight} />
                      <Text style={styles.imagePlaceholderText}>Tap to add photo</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {imageUri && (
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => { setImageUri(null); setImageBase64(null); }}
                    activeOpacity={0.8}
                  >
                    <Feather name="trash-2" size={14} color="#EF4444" />
                    <Text style={styles.removeImageText}>Remove image</Text>
                  </TouchableOpacity>
                )}

                {errorMsg ? (
                  <View style={[styles.errorBox, { marginTop: 12 }]}>
                    <Feather name="alert-circle" size={14} color="#EF4444" />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                ) : null}

                <View style={[styles.modalBtns, { marginTop: 16 }]}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep("details")} activeOpacity={0.8}>
                    <Feather name="arrow-left" size={16} color={Colors.textSecondary} />
                    <Text style={styles.cancelBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.saveBtnText}>
                      {saving ? (editProduct ? "Saving..." : "Adding...") : (editProduct ? "Save" : "Add Product")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal visible={!!confirmProduct} transparent animationType="fade" onRequestClose={() => setConfirmProduct(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIcon}>
              <Feather name="trash-2" size={28} color="#EF4444" />
            </View>
            <Text style={styles.confirmTitle}>Delete Product</Text>
            <Text style={styles.confirmMsg}>
              Are you sure you want to delete{"\n"}
              <Text style={{ fontFamily: "Inter_600SemiBold" }}>{confirmProduct?.name}</Text>
              ?{"\n"}This cannot be undone.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirmProduct(null)} activeOpacity={0.8}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDelete, deleting && { opacity: 0.6 }]}
                onPress={confirmDelete}
                disabled={deleting}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmDeleteText}>{deleting ? "Deleting..." : "Delete"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {lightboxProduct && (
        <ImageLightbox product={lightboxProduct} onClose={() => setLightboxProduct(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FA" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminText },
  headerTitleSelected: {
    flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold",
    color: Colors.adminText, marginHorizontal: 10,
  },
  cancelSelBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  headerActions: { flexDirection: "row", gap: 8, flexShrink: 0 },
  headerActionBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  editHeaderBtn: { backgroundColor: `${Colors.adminAccent}18` },
  deleteHeaderBtn: { backgroundColor: "#FEE2E2" },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.adminAccent, alignItems: "center", justifyContent: "center",
  },

  list: { padding: 16 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, marginBottom: 8, marginTop: 6,
  },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },

  card: {
    backgroundColor: Colors.white, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: Colors.adminAccent, borderWidth: 2, backgroundColor: "#FFF3E6",
  },
  cardIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  productImage: { width: 44, height: 44, borderRadius: 10, flexShrink: 0 },
  cardLeft: { flex: 1, gap: 6 },
  productName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  metaRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaChipText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  priceWrap: { alignItems: "flex-end", justifyContent: "center", flexShrink: 0 },
  priceCurrency: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, letterSpacing: 0.3 },
  priceValue: { fontSize: 19, fontFamily: "Inter_700Bold", color: Colors.adminText, letterSpacing: -0.5 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { color: Colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center" },

  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modal: {
    backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, gap: 12, maxHeight: "92%",
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: "center", marginBottom: 4,
  },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  stepDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.border,
  },
  stepDotActive: { backgroundColor: Colors.adminAccent, width: 14, height: 14, borderRadius: 7 },
  stepDotDone: { backgroundColor: Colors.adminAccent },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, maxWidth: 60 },
  stepLineDone: { backgroundColor: Colors.adminAccent },

  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  stepSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginBottom: 8 },

  categoryList: { gap: 10, marginBottom: 16 },
  categoryCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#F7F8FA", borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  categoryIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  categoryLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  categoryCheck: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },

  selectedCatBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, alignSelf: "flex-start",
    backgroundColor: "#F7F8FA", marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  selectedCatText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  modalFields: { gap: 8 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginTop: 8 },
  modalInput: {
    backgroundColor: "#F7F8FA", borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text,
  },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, marginTop: 8,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#EF4444", flex: 1 },

  imagePicker: {
    borderRadius: 16, overflow: "hidden", borderWidth: 1.5,
    borderColor: Colors.border, borderStyle: "dashed",
    height: 200, marginBottom: 8,
  },
  imagePreview: { width: "100%", height: "100%" },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#F7F8FA" },
  imagePlaceholderText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textLight },
  removeImageBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "center", paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: "#FEF2F2", borderRadius: 20,
  },
  removeImageText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#EF4444" },

  modalBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingVertical: 14, alignItems: "center",
    flexDirection: "row", justifyContent: "center", gap: 6,
  },
  cancelBtnText: { color: Colors.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  saveBtn: {
    flex: 1, backgroundColor: Colors.adminAccent,
    borderRadius: 12, paddingVertical: 14, alignItems: "center",
    flexDirection: "row", justifyContent: "center", gap: 8,
  },
  saveBtnText: { color: Colors.white, fontFamily: "Inter_600SemiBold", fontSize: 15 },

  confirmOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  confirmBox: {
    backgroundColor: Colors.white, borderRadius: 24,
    padding: 28, alignItems: "center", gap: 12, width: "100%", maxWidth: 340,
  },
  confirmIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  confirmTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  confirmMsg: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },
  confirmBtns: { flexDirection: "row", gap: 12, width: "100%", marginTop: 4 },
  confirmCancel: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  confirmCancelText: { color: Colors.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  confirmDelete: { flex: 1, backgroundColor: "#EF4444", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  confirmDeleteText: { color: Colors.white, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  filterScroll: { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterRow: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 4, gap: 5 },
  filterBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderWidth: 1, borderRadius: 10,
    paddingVertical: 2, paddingHorizontal: 7,
    backgroundColor: Colors.white,
  },
  filterBtnText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  filterCount: { borderRadius: 6, minWidth: 14, height: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  filterCountText: { fontSize: 9, fontFamily: "Inter_700Bold" },
});
