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
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Colors } from "@/constants/colors";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

interface Ad {
  id: number;
  imageBase64?: string;
  mediaUrl?: string;
  mediaType: string;
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchAds = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/ads`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAds(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  const uploadImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please allow photo library access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 7],
      quality: 0.75,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const ext = asset.uri.split(".").pop()?.toLowerCase() ?? "jpeg";

    if (!asset.base64) {
      Alert.alert("Error", "Could not read image data.");
      return;
    }
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    const dataUrl = `data:${mime};base64,${asset.base64}`;

    setUploadingImage(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64: dataUrl, mediaType: "image" }),
      });

      if (res.ok) {
        const ad = await res.json();
        setAds((prev) => [...prev, ad]);
      } else {
        const errBody = await res.json().catch(() => ({}));
        Alert.alert("Upload failed", errBody.error || "Could not upload. Try a smaller file.");
      }
    } catch {
      Alert.alert("Error", "Upload failed. Check your connection and try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const deleteAd = (id: number) => {
    Alert.alert("Delete Media", "Remove this banner from users' screens?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeletingId(id);
          try {
            const token = await getToken();
            await fetch(`${BASE}/ads/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
            setAds((prev) => prev.filter((a) => a.id !== id));
          } catch {
            Alert.alert("Error", "Could not delete.");
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const imageAds = ads.filter((a) => a.mediaType !== "video");

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <BackButton color={Colors.adminAccent} fallback="/(admin)" />
        <Text style={styles.headerTitle}>Manage Banners</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Upload button */}
        <Text style={styles.sectionLabel}>ADD NEW MEDIA</Text>
        <TouchableOpacity
          style={[styles.uploadCard, uploadingImage && { opacity: 0.7 }]}
          onPress={uploadImage}
          disabled={uploadingImage}
          activeOpacity={0.82}
        >
          <LinearGradient
            colors={["#E87722", "#C5611A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.uploadCardGradient}
          >
            <View style={styles.uploadIconCircle}>
              {uploadingImage
                ? <ActivityIndicator color="#E87722" size="small" />
                : <Feather name="image" size={24} color="#E87722" />
              }
            </View>
            <Text style={styles.uploadCardTitle}>
              {uploadingImage ? "Uploading…" : "Upload Banner"}
            </Text>
            <Text style={styles.uploadCardSub}>16:7 ratio · JPG / PNG</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Banners section */}
        {loading ? (
          <ActivityIndicator color={Colors.adminAccent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Image banners */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: "#E87722" }]} />
              <Text style={styles.sectionLabel}>IMAGE BANNERS</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{imageAds.length}</Text>
              </View>
            </View>
            {imageAds.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="image" size={28} color={Colors.textLight} />
                <Text style={styles.emptyText}>No image banners yet</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {imageAds.map((ad) => (
                  <View key={ad.id} style={styles.card}>
                    {ad.imageBase64 ? <Image source={{ uri: ad.imageBase64 }} style={styles.cardImage} resizeMode="cover" /> : <View style={styles.cardImage} />}
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => deleteAd(ad.id)}
                      disabled={deletingId === ad.id}
                    >
                      {deletingId === ad.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Feather name="trash-2" size={13} color="#fff" />
                      }
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FA" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.adminText },
  scroll: { padding: 16, paddingBottom: 48, gap: 16 },

  sectionLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textLight,
    letterSpacing: 1.2,
  },

  uploadCard: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  uploadCardGradient: {
    padding: 20,
    alignItems: "center",
    gap: 10,
    minHeight: 140,
    justifyContent: "center",
  },
  uploadIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#FFF7F0",
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  uploadCardTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  uploadCardSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", textAlign: "center" },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  countPill: {
    backgroundColor: "#FFF0E6", borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  countPillText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#E87722" },

  empty: {
    alignItems: "center", paddingVertical: 24, gap: 8,
    backgroundColor: Colors.adminCard, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textLight },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  card: { width: CARD_WIDTH, borderRadius: 14, overflow: "hidden", backgroundColor: Colors.adminCard },
  cardImage: { width: "100%", height: CARD_WIDTH * 0.6 },
  deleteBtn: {
    position: "absolute", top: 6, right: 6,
    backgroundColor: "rgba(231,76,60,0.85)",
    borderRadius: 20, width: 28, height: 28,
    justifyContent: "center", alignItems: "center",
  },
});
