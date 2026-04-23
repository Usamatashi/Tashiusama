import React, { useRef, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import { BackButton } from "@/components/BackButton";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

type MatchResult = {
  matchedProductId: number | null;
  confidence: "high" | "medium" | "low";
  reason: string;
  product: {
    id: number;
    name: string;
    points: number;
    salesPrice: number;
    category: string;
    productNumber: string | null;
    vehicleManufacturer: string | null;
    imageUrl: string | null;
    diagramUrl: string | null;
  } | null;
};

const CONFIDENCE_COLORS = {
  high: "#16A34A",
  medium: "#D97706",
  low: "#EF4444",
};

const CONFIDENCE_LABELS = {
  high: "High Confidence",
  medium: "Medium Confidence",
  low: "Low Confidence",
};

export default function IdentifyPadScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });
      if (photo?.uri) {
        setCapturedPhoto(photo.uri);
        identifyPad(photo.base64 ?? "");
      }
    } catch {
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Photo library access is needed.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.7,
      base64: true,
    });
    if (!picked.canceled && picked.assets[0]) {
      setCapturedPhoto(picked.assets[0].uri);
      identifyPad(picked.assets[0].base64 ?? "");
    }
  };

  const identifyPad = async (base64: string) => {
    if (!base64) return;
    setIdentifying(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}/products/identify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ photoBase64: base64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data.error || "Failed to identify pad");
        return;
      }
      setResult(data);
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIdentifying(false);
    }
  };

  const reset = () => {
    setCapturedPhoto(null);
    setResult(null);
    setIdentifying(false);
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>Identify Pad</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Feather name="camera-off" size={48} color={Colors.textLight} />
          <Text style={styles.noticeText}>Camera scanning is available on the mobile app only.</Text>
          <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery} activeOpacity={0.8}>
            <Feather name="image" size={18} color="#fff" />
            <Text style={styles.galleryBtnText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>
        {(identifying || result) && (
          <ScrollView style={styles.resultScroll} contentContainerStyle={{ padding: 20 }}>
            {identifying && (
              <View style={styles.analyzingBox}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.analyzingText}>Analyzing pad shape with AI...</Text>
              </View>
            )}
            {result && <ResultCard result={result} onReset={reset} />}
          </ScrollView>
        )}
      </View>
    );
  }

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>Identify Pad</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Feather name="camera" size={48} color={Colors.primary} />
          <Text style={styles.noticeText}>Camera access is needed to photograph the worn pad</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.8}>
            <Text style={styles.permBtnText}>Grant Camera Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (capturedPhoto) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={reset} style={styles.backBtn} activeOpacity={0.7}>
            <Feather name="x" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Identify Pad</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          <Image source={{ uri: capturedPhoto }} style={styles.capturedImage} resizeMode="contain" />
          {identifying && (
            <View style={styles.analyzingBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.analyzingText}>Analyzing pad shape with AI...</Text>
            </View>
          )}
          {result && <ResultCard result={result} onReset={reset} />}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.fullContainer}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <View style={styles.cameraHeader}>
          <BackButton dark />
          <Text style={styles.cameraHeaderTitle}>Identify Pad</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.cameraHintBox}>
          <Text style={styles.cameraHint}>Place worn pad flat and photograph from above</Text>
        </View>

        <View style={styles.cameraFrame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        <View style={[styles.cameraBottom, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity onPress={pickFromGallery} style={styles.galleryRound} activeOpacity={0.8}>
            <Feather name="image" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={takePhoto} style={styles.captureBtn} activeOpacity={0.85}>
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>
          <View style={{ width: 52 }} />
        </View>
      </View>
    </View>
  );
}

function ResultCard({ result, onReset }: { result: MatchResult; onReset: () => void }) {
  const insets = useSafeAreaInsets();

  if (!result.product) {
    return (
      <View style={styles.resultCard}>
        <View style={styles.noMatchIcon}>
          <Feather name="alert-circle" size={40} color="#EF4444" />
        </View>
        <Text style={styles.noMatchTitle}>No Match Found</Text>
        <Text style={styles.noMatchSub}>
          {result.reason || "Could not identify this pad. Make sure the product has a diagram uploaded."}
        </Text>
        <TouchableOpacity style={styles.tryAgainBtn} onPress={onReset} activeOpacity={0.8}>
          <Feather name="refresh-cw" size={16} color="#fff" />
          <Text style={styles.tryAgainText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const p = result.product;
  const confColor = CONFIDENCE_COLORS[result.confidence];

  return (
    <View style={styles.resultCard}>
      <View style={[styles.confBadge, { backgroundColor: `${confColor}18` }]}>
        <View style={[styles.confDot, { backgroundColor: confColor }]} />
        <Text style={[styles.confText, { color: confColor }]}>{CONFIDENCE_LABELS[result.confidence]}</Text>
      </View>

      <Text style={styles.matchTitle}>Match Found</Text>

      {p.imageUrl ? (
        <Image source={{ uri: p.imageUrl }} style={styles.matchImage} resizeMode="contain" />
      ) : (
        <View style={styles.matchImagePlaceholder}>
          <Feather name="circle" size={40} color={Colors.textLight} />
        </View>
      )}

      <Text style={styles.matchName}>{p.name}</Text>
      {p.productNumber ? (
        <Text style={styles.matchNumber}>#{p.productNumber}</Text>
      ) : null}
      {p.vehicleManufacturer ? (
        <Text style={styles.matchMfr}>{p.vehicleManufacturer}</Text>
      ) : null}

      {p.salesPrice > 0 && (
        <View style={styles.matchPriceRow}>
          <Text style={styles.matchPriceLabel}>Price</Text>
          <Text style={styles.matchPrice}>Rs. {p.salesPrice.toLocaleString()}</Text>
        </View>
      )}

      {result.reason ? (
        <View style={styles.reasonBox}>
          <Feather name="info" size={13} color={Colors.textSecondary} />
          <Text style={styles.reasonText}>{result.reason}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.tryAgainBtn} onPress={onReset} activeOpacity={0.8}>
        <Feather name="refresh-cw" size={16} color="#fff" />
        <Text style={styles.tryAgainText}>Scan Another</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  fullContainer: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  noticeText: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
  permBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  permBtnText: { color: Colors.white, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  galleryBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 24,
  },
  galleryBtnText: { color: Colors.white, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  overlay: { flex: 1 },
  cameraHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  cameraHeaderTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#fff" },
  cameraHintBox: {
    alignItems: "center", paddingVertical: 10,
  },
  cameraHint: {
    color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium",
    backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 16,
    paddingVertical: 8, borderRadius: 20, textAlign: "center",
  },
  cameraFrame: {
    flex: 1, alignSelf: "center", width: 260, height: 200,
    position: "relative", marginTop: 40,
  },
  corner: {
    position: "absolute", width: 36, height: 36, borderColor: Colors.primary,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  cameraBottom: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 40, paddingTop: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  galleryRound: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  captureBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#fff",
  },
  captureBtnInner: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: "#fff",
  },
  capturedImage: { width: "100%", height: 260, backgroundColor: "#000" },
  resultScroll: { flex: 1 },
  analyzingBox: {
    alignItems: "center", gap: 14, padding: 32,
    backgroundColor: "#F7F8FA", margin: 16, borderRadius: 20,
  },
  analyzingText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textAlign: "center" },
  resultCard: {
    margin: 16, padding: 24, backgroundColor: Colors.white,
    borderRadius: 20, gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: "center",
  },
  confBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: "center",
  },
  confDot: { width: 8, height: 8, borderRadius: 4 },
  confText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  matchTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  matchImage: { width: 120, height: 90, borderRadius: 12 },
  matchImagePlaceholder: {
    width: 120, height: 90, borderRadius: 12,
    backgroundColor: "#F7F8FA", alignItems: "center", justifyContent: "center",
  },
  matchName: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  matchNumber: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.primary, textAlign: "center" },
  matchMfr: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
  matchPriceRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    width: "100%", backgroundColor: "#F7F8FA", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
  },
  matchPriceLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  matchPrice: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.primary },
  reasonBox: {
    flexDirection: "row", gap: 8, backgroundColor: "#F7F8FA",
    borderRadius: 12, padding: 12, alignItems: "flex-start", width: "100%",
  },
  reasonText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 18 },
  noMatchIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center",
  },
  noMatchTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  noMatchSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 21 },
  tryAgainBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 28, marginTop: 8,
  },
  tryAgainText: { color: Colors.white, fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
