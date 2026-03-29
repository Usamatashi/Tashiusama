import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/colors";

interface Product {
  id: number;
  name: string;
  salesPrice: number;
  points: number;
}

async function fetchProducts(): Promise<Product[]> {
  const token = (await AsyncStorage.getItem("tashi_token")) || "";
  const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/products`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load products");
  return res.json();
}

function ProductRow({ product, index }: { product: Product; index: number }) {
  return (
    <View style={styles.row}>
      <View style={styles.indexBadge}>
        <Text style={styles.indexText}>{index + 1}</Text>
      </View>
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

  return (
    <View style={[styles.root]}>
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
          <Feather name="truck" size={52} color={Colors.border} />
          <Text style={styles.emptyTitle}>No products yet</Text>
          <Text style={styles.emptyText}>Product catalog will appear here</Text>
        </View>
      ) : (
        <>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 1, marginLeft: 44 }]}>Product</Text>
            <Text style={[styles.tableHeaderText, { marginRight: 4 }]}>Price</Text>
          </View>
          <FlatList
            data={products}
            keyExtractor={item => String(item.id)}
            renderItem={({ item, index }) => <ProductRow product={item} index={index} />}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: botPad + 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F7F4F1",
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFEF",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#EFEFEF",
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: "Inter_700Bold",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  indexBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  indexText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  priceBox: {
    alignItems: "flex-end",
  },
  priceLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 12,
  },
  priceValue: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.primary,
    fontFamily: "Inter_700Bold",
  },
});
