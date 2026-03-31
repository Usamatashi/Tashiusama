import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  RefreshControl,
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
import { useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type ProductCategory = "disc_pad" | "brake_shoes" | "other";

interface Product {
  id: number;
  name: string;
  salesPrice: number;
  points: number;
  category: ProductCategory;
  imageBase64: string | null;
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
      {product.imageBase64 ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${product.imageBase64}` }}
          style={styles.productImage}
        />
      ) : (
        <View style={[styles.iconBadge, { backgroundColor: meta.bg }]}>
          <Feather name={meta.icon} size={16} color={meta.color} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productCategory}>{meta.label}</Text>
      </View>
      <View style={styles.priceBox}>
        <Text style={styles.priceLabel}>Rs.</Text>
        <Text style={styles.priceValue}>{product.salesPrice.toLocaleString()}</Text>
      </View>
      {product.imageBase64 && (
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
        {product.imageBase64 ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${product.imageBase64}` }}
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
  useLocalSearchParams<{ category?: string }>();
  const [activeFilter, setActiveFilter] = useState<ProductCategory>("disc_pad");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: products = [], isLoading, refetch, isRefetching } = useQuery<Product[]>({
    queryKey: ["user-products"],
    queryFn: fetchProducts,
  });

  const filteredProducts = products.filter((p) => (p.category ?? "other") === activeFilter);

  const sections = [{
    key: activeFilter,
    title: CATEGORY_META[activeFilter].label,
    meta: CATEGORY_META[activeFilter],
    data: filteredProducts,
  }].filter((s) => s.data.length > 0);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: topPad + 14 }]}>
        <Text style={styles.headerTitle}>Products</Text>
        <Text style={styles.headerSub}>{filteredProducts.length} available</Text>
      </View>

      {/* Category filter buttons */}
      <View style={styles.filterRow}>
        {CATEGORY_ORDER.map((cat) => {
          const meta = CATEGORY_META[cat];
          const isActive = activeFilter === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterBtn,
                isActive
                  ? { backgroundColor: meta.color, borderColor: meta.color }
                  : { borderColor: meta.color + "55" },
              ]}
              onPress={() => { Haptics.selectionAsync(); setActiveFilter(cat); }}
              activeOpacity={0.8}
            >
              <Feather name={meta.icon} size={12} color={isActive ? "#fff" : meta.color} />
              <Text
                style={[styles.filterBtnText, { color: isActive ? "#fff" : meta.color }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {meta.label}
              </Text>
              <View style={[styles.filterCount, { backgroundColor: isActive ? "rgba(255,255,255,0.25)" : meta.bg }]}>
                <Text style={[styles.filterCountText, { color: isActive ? "#fff" : meta.color }]}>
                  {products.filter((p) => (p.category ?? "other") === cat).length}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

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
          renderSectionHeader={() => null}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: botPad + 100 }}
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
    paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1, borderBottomColor: "#EFEFEF",
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  headerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontFamily: "Inter_400Regular" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", fontFamily: "Inter_400Regular" },

  filterRow: {
    flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, gap: 8,
    backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#EFEFEF",
  },
  filterBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    borderWidth: 1.5, borderRadius: 12, height: 45, backgroundColor: "#FFFFFF",
  },
  filterBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  filterCount: { borderRadius: 6, minWidth: 14, height: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  filterCountText: { fontSize: 9, fontFamily: "Inter_700Bold" },

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
