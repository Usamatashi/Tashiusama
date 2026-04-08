import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";

interface Product {
  id: number;
  name: string;
  points: number;
}

function generateQRNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `TQ-${ts}-${rand}`;
}

export default function CreateQRScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [qrNumber, setQrNumber] = useState(() => generateQRNumber());
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [createdQR, setCreatedQR] = useState<{ qrNumber: string; productName: string; points: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanned, setScanned] = useState(false);
  const qrRef = useRef<any>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => { fetchProducts(); }, []);

  const handleRegenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQrNumber(generateQRNumber());
  };

  const handleOpenScanner = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert("Permission Required", "Camera access is needed to scan QR codes.");
        return;
      }
    }
    setScanned(false);
    setScannerOpen(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setScannerOpen(false);
    setQrNumber(data);
  };

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setProducts(data);
    } catch {
      Alert.alert("Error", "Failed to load products");
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedProduct) {
      Alert.alert("Select Product", "Please choose a product before saving.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/qrcodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ qrNumber, productId: selectedProduct.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create QR code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCreatedQR({ qrNumber: data.qrNumber, productName: data.productName, points: data.points });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCreatedQR(null);
    setQrNumber(generateQRNumber());
    setSelectedProduct(null);
  };

  // ── Success screen ──
  if (createdQR) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
        <LinearGradient colors={["#E87722", "#C5611A"]} style={styles.successHeader}>
          <View style={styles.successHeaderContent}>
            <View style={styles.successIconRing}>
              <Feather name="check" size={28} color="#E87722" />
            </View>
            <Text style={styles.successTitle}>QR Code Saved!</Text>
            <Text style={styles.successSub}>Ready to assign to a mechanic</Text>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.resultQrCard}>
            <QRCode
              value={createdQR.qrNumber}
              size={200}
              color="#1A1A1A"
              backgroundColor="#FFFFFF"
              getRef={(ref) => (qrRef.current = ref)}
            />
          </View>

          <View style={styles.resultInfoCard}>
            <View style={styles.resultRow}>
              <View style={styles.resultIconWrap}>
                <Feather name="hash" size={16} color={Colors.adminAccent} />
              </View>
              <View style={styles.resultTextBlock}>
                <Text style={styles.resultRowLabel}>QR Number</Text>
                <Text style={styles.resultRowValue}>{createdQR.qrNumber}</Text>
              </View>
            </View>
            <View style={styles.resultDivider} />
            <View style={styles.resultRow}>
              <View style={styles.resultIconWrap}>
                <Feather name="box" size={16} color={Colors.adminAccent} />
              </View>
              <View style={styles.resultTextBlock}>
                <Text style={styles.resultRowLabel}>Product</Text>
                <Text style={styles.resultRowValue}>{createdQR.productName}</Text>
              </View>
            </View>
            <View style={styles.resultDivider} />
            <View style={styles.resultRow}>
              <View style={styles.resultIconWrap}>
                <Feather name="star" size={16} color={Colors.adminAccent} />
              </View>
              <View style={styles.resultTextBlock}>
                <Text style={styles.resultRowLabel}>Points Value</Text>
                <Text style={[styles.resultRowValue, { color: Colors.adminAccent }]}>{createdQR.points} pts</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.newBtn} onPress={handleReset} activeOpacity={0.8}>
            <Feather name="plus-circle" size={18} color={Colors.white} />
            <Text style={styles.newBtnText}>Generate Another</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Create screen ──
  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Gradient header */}
      <LinearGradient colors={["#E87722", "#C5611A"]} style={styles.gradientHeader}>
        <View style={styles.gradientHeaderTop}>
          <BackButton color="#FFFFFF" fallback="/(admin)" />
          <Text style={styles.gradientHeaderTitle}>Create QR Code</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* QR preview inside gradient */}
        <View style={styles.qrHeroWrap}>
          <View style={styles.qrHeroCard}>
            <QRCode
              value={qrNumber}
              size={150}
              color="#1A1A1A"
              backgroundColor="#FFFFFF"
            />
          </View>
          <Text style={styles.qrHeroNumber} numberOfLines={1}>{qrNumber}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ID actions */}
        <View style={styles.idActionsRow}>
          <TouchableOpacity style={styles.idActionBtn} onPress={handleRegenerate} activeOpacity={0.8}>
            <Feather name="refresh-cw" size={15} color={Colors.adminAccent} />
            <Text style={styles.idActionText}>New ID</Text>
          </TouchableOpacity>
          <View style={styles.idActionDivider} />
          <TouchableOpacity style={styles.idActionBtn} onPress={handleOpenScanner} activeOpacity={0.8}>
            <Feather name="camera" size={15} color={Colors.adminAccent} />
            <Text style={styles.idActionText}>Scan Existing</Text>
          </TouchableOpacity>
        </View>

        {/* Product section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ASSIGN TO PRODUCT</Text>

          {loadingProducts ? (
            <View style={styles.pickerSkeleton}>
              <Text style={styles.pickerSkeletonText}>Loading products…</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.pickerBtn, selectedProduct && styles.pickerBtnSelected]}
                onPress={() => setShowPicker(!showPicker)}
                activeOpacity={0.8}
              >
                <View style={styles.pickerLeft}>
                  <View style={[styles.pickerDot, selectedProduct && styles.pickerDotSelected]} />
                  <Text style={[styles.pickerBtnText, !selectedProduct && styles.pickerPlaceholder]}>
                    {selectedProduct ? selectedProduct.name : "Select a product…"}
                  </Text>
                </View>
                <View style={styles.pickerRight}>
                  {selectedProduct && (
                    <View style={styles.ptsPill}>
                      <Text style={styles.ptsPillText}>{selectedProduct.points} pts</Text>
                    </View>
                  )}
                  <Feather
                    name={showPicker ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={selectedProduct ? Colors.adminAccent : Colors.textLight}
                  />
                </View>
              </TouchableOpacity>

              {showPicker && (
                <View style={styles.dropdown}>
                  {products.length === 0 ? (
                    <Text style={styles.dropdownEmpty}>No products yet. Create some first.</Text>
                  ) : (
                    products.map((p, i) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.dropdownItem, i < products.length - 1 && styles.dropdownItemBorder]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedProduct(p);
                          setShowPicker(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.dropdownItemText}>{p.name}</Text>
                        <View style={styles.dropdownPtsPill}>
                          <Text style={styles.dropdownPtsText}>{p.points} pts</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </>
          )}
        </View>

        {/* Save button */}
        <TouchableOpacity
          onPress={handleCreate}
          disabled={!selectedProduct || loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={(!selectedProduct || loading) ? ["#ccc", "#bbb"] : ["#E87722", "#C5611A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtn}
          >
            <Feather name={loading ? "loader" : "save"} size={20} color="#fff" />
            <Text style={styles.saveBtnText}>{loading ? "Saving…" : "Save QR Code"}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Scanner modal */}
      <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
          </View>
          <View style={[styles.scannerHeader, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity style={styles.scannerClose} onPress={() => setScannerOpen(false)}>
              <Feather name="x" size={24} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Scan QR Code</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.scannerHint}>
            <Text style={styles.scannerHintText}>Point the camera at any QR code</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FA" },

  // ── Gradient header ──
  gradientHeader: {
    paddingBottom: 28,
  },
  gradientHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  gradientHeaderTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  qrHeroWrap: {
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
  },
  qrHeroCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  qrHeroNumber: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 1,
  },

  // ── Scroll body ──
  scroll: { padding: 20, paddingTop: 16, gap: 20, paddingBottom: 40 },

  idActionsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  idActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  idActionDivider: { width: 1, backgroundColor: "#EBEBEB" },
  idActionText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.adminAccent },

  section: { gap: 10 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textLight,
    letterSpacing: 1.2,
    paddingLeft: 2,
  },

  pickerSkeleton: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: "center",
  },
  pickerSkeletonText: { color: Colors.textLight, fontFamily: "Inter_400Regular", fontSize: 15 },

  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#EBEBEB",
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  pickerBtnSelected: {
    borderColor: Colors.adminAccent,
    backgroundColor: "#FFF7F2",
  },
  pickerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  pickerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  pickerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#DDD",
  },
  pickerDotSelected: { backgroundColor: Colors.adminAccent },
  pickerBtnText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.adminText, flex: 1 },
  pickerPlaceholder: { color: Colors.textLight },
  ptsPill: {
    backgroundColor: Colors.adminAccent,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ptsPillText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },

  dropdown: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  dropdownEmpty: { padding: 18, color: Colors.textLight, fontFamily: "Inter_400Regular", textAlign: "center" },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  dropdownItemText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.adminText },
  dropdownPtsPill: {
    backgroundColor: "#FFF0E6",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dropdownPtsText: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.adminAccent },

  saveBtn: {
    borderRadius: 14,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#E87722",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },

  // ── Success screen ──
  successHeader: { paddingBottom: 32, paddingTop: 12 },
  successHeaderContent: { alignItems: "center", gap: 10, paddingTop: 20 },
  successIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff" },
  successSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },

  resultScroll: { padding: 24, alignItems: "center", gap: 20 },
  resultQrCard: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  resultInfoCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBEBEB",
    width: "100%",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 16 },
  resultDivider: { height: 1, backgroundColor: "#F0F0F0", marginHorizontal: 18 },
  resultIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#FFF0E6",
    alignItems: "center", justifyContent: "center",
  },
  resultTextBlock: { flex: 1 },
  resultRowLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textLight, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  resultRowValue: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.adminText },

  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.adminAccent,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 32,
    shadowColor: "#E87722",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    width: "100%",
    justifyContent: "center",
  },
  newBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },

  // ── Scanner ──
  scannerContainer: { flex: 1, backgroundColor: "#000" },
  scannerHeader: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  scannerTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#fff" },
  scannerClose: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },
  scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  scannerFrame: {
    width: 240, height: 240,
    borderWidth: 2, borderColor: "#fff",
    borderRadius: 16, backgroundColor: "transparent",
  },
  scannerHint: { position: "absolute", bottom: 80, left: 0, right: 0, alignItems: "center" },
  scannerHintText: {
    color: "#fff", fontSize: 15, fontFamily: "Inter_400Regular",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20,
  },
});
