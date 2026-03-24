import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

interface Ad {
  id: number;
  imageBase64: string;
  title: string | null;
  createdAt: string;
}

async function getToken() {
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  return (await AsyncStorage.getItem("tashi_token")) || "";
}

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

export default function CreateAdsScreen() {
  const insets = useSafeAreaInsets();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchAds = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/ads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAds(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  const pickAndUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please allow photo library access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 7],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets[0].base64) return;

    const asset = result.assets[0];
    const ext = asset.uri.split(".").pop()?.toLowerCase() ?? "jpeg";
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    const imageBase64 = `data:${mime};base64,${asset.base64}`;

    setUploading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/ads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imageBase64 }),
      });
      if (res.ok) {
        const ad = await res.json();
        setAds((prev) => [...prev, ad]);
      } else {
        Alert.alert("Upload failed", "Could not upload banner.");
      }
    } catch {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setUploading(false);
    }
  };

  const deleteAd = (id: number) => {
    Alert.alert("Delete Banner", "Remove this banner from users' screens?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeletingId(id);
          try {
            const token = await getToken();
            await fetch(`${BASE}/ads/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            setAds((prev) => prev.filter((a) => a.id !== id));
          } catch {
            Alert.alert("Error", "Could not delete banner.");
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.adminText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Banners</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Upload button */}
        <TouchableOpacity
          style={[styles.uploadBtn, uploading && { opacity: 0.7 }]}
          onPress={pickAndUpload}
          disabled={uploading}
          activeOpacity={0.85}
        >
          {uploading ? (
            <>
              <ActivityIndicator color={Colors.white} size="small" />
              <Text style={styles.uploadBtnText}>Uploading…</Text>
            </>
          ) : (
            <>
              <Feather name="upload" size={20} color={Colors.white} />
              <Text style={styles.uploadBtnText}>Upload New Banner</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>Recommended ratio 16:7 · JPEG or PNG</Text>

        {/* Grid */}
        {loading ? (
          <ActivityIndicator color={Colors.adminAccent} style={{ marginTop: 40 }} />
        ) : ads.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="image" size={36} color={Colors.textLight} />
            </View>
            <Text style={styles.emptyTitle}>No banners yet</Text>
            <Text style={styles.emptyDesc}>Upload your first banner to get started</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {ads.map((ad) => (
              <View key={ad.id} style={styles.card}>
                <Image
                  source={{ uri: ad.imageBase64 }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteAd(ad.id)}
                  disabled={deletingId === ad.id}
                >
                  {deletingId === ad.id ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Feather name="trash-2" size={14} color={Colors.white} />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: "#F0F0F0" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.adminText },
  scroll: { padding: 16, paddingBottom: 40 },
  uploadBtn: {
    backgroundColor: Colors.adminAccent,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: Colors.adminAccent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 8,
  },
  uploadBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.white },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight, textAlign: "center", marginBottom: 24 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: Colors.adminCard, justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  card: { width: CARD_WIDTH, borderRadius: 14, overflow: "hidden", backgroundColor: Colors.adminCard },
  cardImage: { width: "100%", height: CARD_WIDTH * 0.6 },
  deleteBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(231,76,60,0.85)",
    borderRadius: 20,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
});
