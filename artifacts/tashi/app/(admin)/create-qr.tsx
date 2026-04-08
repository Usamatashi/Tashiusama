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

  useEffect(() => {
    fetchProducts();
  }, []);

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
      Alert.alert("Select Product", "Please choose a product before generating.");
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

  if (createdQR) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>QR Code Ready</Text>
          <TouchableOpacity onPress={handleReset}>
            <Feather name="x" size={24} color={Colors.adminText} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.resultScroll}>
          <View style={styles.qrContainer}>
            <QRCode
              value={createdQR.qrNumber}
              size={220}
              color={Colors.black}
              backgroundColor={Colors.white}
              getRef={(ref) => (qrRef.current = ref)}
            />
          </View>
          <View style={styles.resultInfo}>
            <Text style={styles.resultLabel}>QR Number</Text>
            <Text style={styles.resultValue}>{createdQR.qrNumber}</Text>
            <Text style={styles.resultLabel}>Product</Text>
            <Text style={styles.resultValue}>{createdQR.productName}</Text>
            <Text style={styles.resultLabel}>Points</Text>
            <Text style={[styles.resultValue, { color: Colors.adminAccent }]}>{createdQR.points} pts</Text>
          </View>
          <TouchableOpacity style={styles.newBtn} onPress={handleReset} activeOpacity={0.8}>
            <Feather name="plus" size={18} color={Colors.adminAccent} />
            <Text style={styles.newBtnText}>Generate Another</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <BackButton color={Colors.adminAccent} fallback="/(admin)" />
        <Text style={styles.headerTitle}>Create QR Code</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Auto-generated QR preview */}
        <View style={styles.previewCard}>
          <View style={styles.qrPreviewBox}>
            <QRCode
              value={qrNumber}
              size={160}
              color={Colors.black}
              backgroundColor={Colors.white}
            />
          </View>
          <View style={styles.qrMeta}>
            <Text style={styles.qrMetaLabel}>QR Number</Text>
            <Text style={styles.qrMetaValue} numberOfLines={1}>{qrNumber}</Text>
            <View style={styles.qrActions}>
              <TouchableOpacity style={styles.regenBtn} onPress={handleRegenerate} activeOpacity={0.8}>
                <Feather name="refresh-cw" size={14} color={Colors.adminAccent} />
                <Text style={styles.regenBtnText}>New ID</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.scanSmallBtn} onPress={handleOpenScanner} activeOpacity={0.8}>
                <Feather name="camera" size={14} color={Colors.white} />
                <Text style={styles.scanSmallBtnText}>Scan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Product picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Assign to Product</Text>
          {loadingProducts ? (
            <View style={styles.picker}>
              <Text style={[styles.pickerText, { color: Colors.textLight }]}>Loading products...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowPicker(!showPicker)}
              activeOpacity={0.8}
            >
              <Text style={[styles.pickerText, !selectedProduct && { color: Colors.textLight }]}>
                {selectedProduct ? `${selectedProduct.name} — ${selectedProduct.points} pts` : "Select a product..."}
              </Text>
              <Feather name={showPicker ? "chevron-up" : "chevron-down"} size={20} color={Colors.textLight} />
            </TouchableOpacity>
          )}
          {showPicker && (
            <View style={styles.dropdown}>
              {products.length === 0 ? (
                <Text style={styles.dropdownLoading}>No products. Create some first.</Text>
              ) : (
                products.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedProduct(p);
                      setShowPicker(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{p.name}</Text>
                    <Text style={styles.dropdownItemPts}>{p.points} pts</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, (!selectedProduct || loading) && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={!selectedProduct || loading}
          activeOpacity={0.8}
        >
          <Feather name="check-circle" size={20} color={Colors.white} />
          <Text style={styles.buttonText}>{loading ? "Saving..." : "Save QR Code"}</Text>
        </TouchableOpacity>
      </ScrollView>

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
  container: { flex: 1, backgroundColor: Colors.adminBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminText, flex: 1, textAlign: "center" },
  scroll: { padding: 20, gap: 20 },
  resultScroll: { padding: 20, alignItems: "center", gap: 20 },

  previewCard: {
    backgroundColor: Colors.adminCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  qrPreviewBox: {
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  qrMeta: { flex: 1, gap: 4 },
  qrMetaLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  qrMetaValue: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.adminText },
  qrActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  regenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1.5,
    borderColor: Colors.adminAccent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  regenBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.adminAccent },
  scanSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.adminAccent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scanSmallBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.white },

  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  picker: {
    backgroundColor: Colors.adminCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerText: { fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.adminText },
  dropdown: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    marginTop: 4,
  },
  dropdownLoading: { padding: 16, color: Colors.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center" },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemText: { fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.adminText },
  dropdownItemPts: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.adminAccent },

  button: {
    backgroundColor: Colors.adminAccent,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: Colors.white, fontSize: 16, fontFamily: "Inter_600SemiBold" },

  qrContainer: {
    backgroundColor: Colors.white,
    padding: 24,
    borderRadius: 20,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  resultInfo: {
    backgroundColor: Colors.adminCard,
    borderRadius: 16,
    padding: 20,
    gap: 6,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textTransform: "uppercase" },
  resultValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.adminText, marginBottom: 8 },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.adminAccent,
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: "center",
    width: "100%",
  },
  newBtnText: { color: Colors.adminAccent, fontSize: 16, fontFamily: "Inter_600SemiBold" },

  scannerContainer: { flex: 1, backgroundColor: Colors.black },
  scannerHeader: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  scannerTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.white },
  scannerClose: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },
  scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  scannerFrame: {
    width: 240, height: 240,
    borderWidth: 2, borderColor: Colors.white,
    borderRadius: 16, backgroundColor: "transparent",
  },
  scannerHint: { position: "absolute", bottom: 80, left: 0, right: 0, alignItems: "center" },
  scannerHintText: {
    color: Colors.white, fontSize: 15, fontFamily: "Inter_400Regular",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20,
  },
});
