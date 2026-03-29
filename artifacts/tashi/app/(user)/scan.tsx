import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

export default function ScanScreen() {
  const { token, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/qrcodes/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ qrNumber: data }),
      });
      const result = await res.json();
      if (!res.ok) {
        Alert.alert("Error", result.error || "Failed to scan QR", [
          { text: "Try Again", onPress: () => setScanned(false) },
          { text: "Go Back", onPress: () => router.back() },
        ]);
      } else {
        await refreshUser();
        Alert.alert(
          "Points Earned!",
          `+${result.pointsEarned} points\nProduct: ${result.productName}\nTotal Points: ${result.totalPoints}`,
          [
            { text: "Scan Another", onPress: () => setScanned(false) },
            { text: "Done", onPress: () => router.back() },
          ]
        );
      }
    } catch {
      Alert.alert("Error", "Failed to process QR code", [
        { text: "Try Again", onPress: () => setScanned(false) },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 67 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.webNotice}>
          <Feather name="camera-off" size={48} color={Colors.textLight} />
          <Text style={styles.webNoticeText}>Camera scanning is available on the mobile app only.</Text>
        </View>
      </View>
    );
  }

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Camera Permission</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.permissionBox}>
          <Feather name="camera" size={48} color={Colors.primary} />
          <Text style={styles.permissionText}>Camera access is needed to scan QR codes</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.8}>
            <Text style={styles.permBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullContainer}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <View style={styles.scanHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtnDark}>
            <Feather name="arrow-left" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.scanHeaderTitle}>Scan QR Code</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.scanArea}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.scanHint}>
            {processing ? "Processing..." : scanned ? "Processed" : "Point camera at QR code"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  fullContainer: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  backBtn: { padding: 4 },
  backBtnDark: { padding: 4 },
  webNotice: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  webNoticeText: { fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
  permissionBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 32 },
  permissionText: { fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
  permBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  permBtnText: { color: Colors.white, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  overlay: { flex: 1, backgroundColor: "transparent" },
  scanHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  scanHeaderTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.white },
  scanArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  scanFrame: {
    width: 240,
    height: 240,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 36,
    height: 36,
    borderColor: Colors.primary,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanHint: {
    backgroundColor: "rgba(0,0,0,0.6)",
    color: Colors.white,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
});
