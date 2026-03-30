import React from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/colors";

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

function ProductRow({ product }: { product: Product }) {
  const meta = CATEGORY_META[product.category ?? "other"];
  return (
    <View style={styles.row}>
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
      </View>
      <View style={styles.priceBox}>
        <Text style={styles.priceLabel}>Rs.</Text>
        <Text style={styles.priceValue}>{product.salesPrice.toLocaleString()}</Text>
      </View>
    </View>
  );
}

export default function ProductsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const { data: products = [], isLoading, refetch, isRefetching } = useQuery<Product[]>({
    queryKey: ["user-products"],
    queryFn: fetchProducts,
  });

  const sections = CATEGORY_ORDER
    .map((cat) => ({
      key: cat,
      title: CATEGORY_META[cat].label,
      meta: CATEGORY_META[cat],
      data: products.filter((p) => (p.category ?? "other") === cat),
    }))
    .filter((s) => s.data.length > 0);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: topPad + 14 }]}>
        <Text style={styles.headerTitle}>Products</Text>
        <Text style={styles.headerSub}>{products.length} available</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Feather name="box" size={52} color={Colors.border} />
          <Text style={styles.emptyTitle}>No products yet</Text>
          <Text style={styles.emptyText}>Product catalog will appear here</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <ProductRow product={item} />}
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
  productImage: { width: 38, height: 38, borderRadius: 8 },
  productName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  priceBox: { alignItems: "flex-end" },
  priceLabel: { fontSize: 10, color: Colors.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 12 },
  priceValue: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.primary },
});
