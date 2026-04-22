import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, router } from "expo-router";
import { BackButton } from "@/components/BackButton";
import { Colors } from "@/constants/colors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type ProductCategory = "disc_pad" | "brake_shoes" | "other";

interface Product {
  id: number;
  name: string;
  salesPrice: number;
  points: number;
  category: ProductCategory;
  productNumber: string | null;
  vehicleManufacturer: string | null;
  imageUrl: string | null;
}

const CATEGORY_META: Record<ProductCategory, { label: string; icon: React.ComponentProps<typeof Feather>["name"]; color: string; bg: string }> = {
  disc_pad:    { label: "Disc Pads",       icon: "circle",  color: "#E87722", bg: "#FFF4EC" },
  brake_shoes: { label: "Brake Shoes",     icon: "truck",   color: "#2563EB", bg: "#EFF6FF" },
  other:       { label: "Other Products",  icon: "box",     color: "#7B2FBE", bg: "#F5F0FF" },
};

const CATEGORY_ORDER: ProductCategory[] = ["disc_pad", "brake_shoes", "other"];

async function fetchProducts(): Promise<Product[]> {
  const token = (await AsyncStorage.getItem("tashi_token")) || "";
  const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/products`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load products");
  return res.json();
}

function ProductRow({ product, onPress }: { product: Product; onPress: (p: Product) => void }) {
  const meta = CATEGORY_META[product.category ?? "other"];
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(product)} activeOpacity={0.75}>
      {product.imageUrl ? (
        <Image
          source={{ uri: product.imageUrl }}
          style={styles.productImage}
        />
      ) : (
        <View style={[styles.iconBadge, { backgroundColor: meta.bg }]}>
          <Feather name={meta.icon} size={16} color={meta.color} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.productName}>{product.name}</Text>
        {product.category !== "other" && product.productNumber ? (
          <Text style={[styles.productNumber, { color: meta.color }]} numberOfLines={1}>
            {product.productNumber}
            {product.vehicleManufacturer ? (
              <Text style={styles.productManufacturer}>  ·  {product.vehicleManufacturer}</Text>
            ) : null}
          </Text>
        ) : (
          <Text style={styles.productCategory}>{meta.label}</Text>
        )}
      </View>
      <View style={styles.priceBox}>
        <Text style={styles.priceLabel}>Rs.</Text>
        <Text style={styles.priceValue}>{product.salesPrice.toLocaleString()}</Text>
      </View>
      {product.imageUrl && (
        <Feather name="maximize-2" size={14} color="#C0C0C0" style={{ marginLeft: 4 }} />
      )}
    </TouchableOpacity>
  );
}

function ImageLightbox({ product, onClose }: { product: Product; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const meta = CATEGORY_META[product.category ?? "other"];

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={styles.overlay}>
        {/* Close button */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 16 }]}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Feather name="x" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Image */}
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={styles.lightboxImage}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.lightboxPlaceholder, { backgroundColor: meta.bg }]}>
            <Feather name={meta.icon} size={72} color={meta.color} />
          </View>
        )}

        {/* Product info card at bottom */}
        <View style={[styles.infoCard, { paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.categoryBadge, { backgroundColor: meta.bg }]}>
            <Feather name={meta.icon} size={12} color={meta.color} />
            <Text style={[styles.categoryBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={styles.lightboxName}>{product.name}</Text>
          {product.category !== "other" && product.productNumber ? (
            <Text style={styles.lightboxProductNumber}>#{product.productNumber}</Text>
          ) : null}
          {product.vehicleManufacturer ? (
            <Text style={styles.lightboxManufacturer}>{product.vehicleManufacturer}</Text>
          ) : null}
          <View style={styles.lightboxPriceRow}>
            <Text style={styles.lightboxPriceLabel}>Price</Text>
            <Text style={styles.lightboxPrice}>Rs. {product.salesPrice.toLocaleString()}</Text>
          </View>
          {product.points > 0 && (
            <View style={styles.pointsRow}>
              <Feather name="star" size={14} color="#E87722" />
              <Text style={styles.pointsText}>{product.points} pts earned on purchase</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function ProductsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);
  const { category } = useLocalSearchParams<{ category?: string }>();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeManufacturer, setActiveManufacturer] = useState<string | null>(null);

  const { data: products = [], isLoading, refetch, isRefetching } = useQuery<Product[]>({
    queryKey: ["user-products"],
    queryFn: fetchProducts,
  });

  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.vehicleManufacturer && p.vehicleManufacturer.trim()) {
        set.add(p.vehicleManufacturer.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const visibleCategories: ProductCategory[] =
    category === "disc_pad"
      ? ["disc_pad"]
      : category === "brake_shoes"
      ? ["brake_shoes", "other"]
      : CATEGORY_ORDER;

  const headerTitle =
    category === "disc_pad"
      ? "Disc Pads"
      : category === "brake_shoes"
      ? "Brake Shoes & Other"
      : "Products";

  const matchesManufacturer = (p: Product) =>
    !activeManufacturer ||
    (p.vehicleManufacturer && p.vehicleManufacturer.trim() === activeManufacturer);

  const filteredProducts = products.filter(
    (p) => visibleCategories.includes(p.category ?? "other") && matchesManufacturer(p)
  );

  const sections = visibleCategories
    .map((cat) => ({
      key: cat,
      title: CATEGORY_META[cat].label,
      meta: CATEGORY_META[cat],
      data: products.filter((p) => (p.category ?? "other") === cat && matchesManufacturer(p)),
    }))
    .filter((s) => s.data.length > 0);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: topPad + 14 }]}>
        <BackButton />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerSub}>{filteredProducts.length} available</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {manufacturers.length > 0 && (
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <TouchableOpacity
              style={[styles.filterChip, !activeManufacturer && styles.filterChipActive]}
              onPress={() => setActiveManufacturer(null)}
              activeOpacity={0.8}
            >
              <Feather name="grid" size={12} color={!activeManufacturer ? "#fff" : Colors.textSecondary} />
              <Text style={[styles.filterChipText, !activeManufacturer && styles.filterChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {manufacturers.map((m) => {
              const active = activeManufacturer === m;
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setActiveManufacturer(active ? null : m)}
                  activeOpacity={0.8}
                >
                  <Feather name="truck" size={12} color={active ? "#fff" : Colors.textSecondary} />
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.center}>
          <Feather name="box" size={52} color={Colors.border} />
          <Text style={styles.emptyTitle}>No products yet</Text>
          <Text style={styles.emptyText}>Product catalog will appear here</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ProductRow product={item} onPress={setSelectedProduct} />
          )}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: section.meta.bg }]}>
              <Feather name={section.meta.icon} size={14} color={section.meta.color} />
              <Text style={[styles.sectionTitle, { color: section.meta.color }]}>
                {section.title}
              </Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: botPad + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
        />
      )}

      {selectedProduct && (
        <ImageLightbox product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F4F1" },
  header: {
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1, borderBottomColor: "#EFEFEF",
    flexDirection: "row", alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  headerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontFamily: "Inter_400Regular", textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", fontFamily: "Inter_400Regular" },

  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, marginTop: 16, marginBottom: 6,
  },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },

  row: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF", borderRadius: 12,
    marginBottom: 8, paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    gap: 12,
  },
  iconBadge: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  productImage: { width: 44, height: 44, borderRadius: 10 },
  productName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  productCategory: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  productNumber: { fontSize: 14, fontFamily: "Inter_700Bold", marginTop: 2, letterSpacing: 0.3 },
  productManufacturer: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, letterSpacing: 0 },

  filterBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1, borderBottomColor: "#EFEFEF",
  },
  filterScroll: {
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary,
  },
  filterChipTextActive: { color: "#fff" },

  lightboxProductNumber: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#E87722", letterSpacing: 0.5 },
  lightboxManufacturer: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#bbb" },
  priceBox: { alignItems: "flex-end" },
  priceLabel: { fontSize: 10, color: Colors.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 12 },
  priceValue: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.primary },

  // Lightbox
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.93)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  lightboxImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  lightboxPlaceholder: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.6,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 8,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  categoryBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  lightboxName: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  lightboxPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  lightboxPriceLabel: { fontSize: 13, color: "#999", fontFamily: "Inter_400Regular" },
  lightboxPrice: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.primary },
  pointsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  pointsText: { fontSize: 13, color: "#aaa", fontFamily: "Inter_400Regular" },
});
