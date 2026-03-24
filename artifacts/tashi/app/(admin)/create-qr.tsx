import React, { useRef, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

interface Vehicle {
  id: number;
  name: string;
  points: number;
}

export default function CreateQRScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [qrNumber, setQrNumber] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [createdQR, setCreatedQR] = useState<{ qrNumber: string; vehicleName: string; points: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const qrRef = useRef<any>(null);

  const fetchVehicles = async () => {
    if (vehicles.length > 0) return;
    setLoadingVehicles(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/vehicles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setVehicles(data);
    } catch {
      Alert.alert("Error", "Failed to load vehicles");
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleCreate = async () => {
    if (!qrNumber.trim()) {
      Alert.alert("Error", "Please enter a QR number");
      return;
    }
    if (!selectedVehicle) {
      Alert.alert("Error", "Please select a vehicle");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/qrcodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ qrNumber: qrNumber.trim(), vehicleId: selectedVehicle.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create QR code");
      setCreatedQR({ qrNumber: data.qrNumber, vehicleName: data.vehicleName, points: data.points });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!qrRef.current) return;
    qrRef.current.toDataURL((data: string) => {
      Alert.alert("QR Code", "QR code data URL generated. In production, use expo-media-library to save.", [
        { text: "OK" },
      ]);
    });
  };

  const handleReset = () => {
    setCreatedQR(null);
    setQrNumber("");
    setSelectedVehicle(null);
  };

  if (createdQR) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>QR Code Created</Text>
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
            <Text style={styles.resultLabel}>Vehicle</Text>
            <Text style={styles.resultValue}>{createdQR.vehicleName}</Text>
            <Text style={styles.resultLabel}>Points</Text>
            <Text style={[styles.resultValue, { color: Colors.adminAccent }]}>{createdQR.points} pts</Text>
          </View>
          <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload} activeOpacity={0.8}>
            <Feather name="download" size={20} color={Colors.white} />
            <Text style={styles.downloadBtnText}>Download QR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newBtn} onPress={handleReset} activeOpacity={0.8}>
            <Text style={styles.newBtnText}>Create Another QR</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create QR Code</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.inputGroup}>
          <Text style={styles.label}>QR Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter unique QR number"
            placeholderTextColor={Colors.textLight}
            value={qrNumber}
            onChangeText={setQrNumber}
            keyboardType="default"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Assign to Vehicle</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => {
              fetchVehicles();
              setShowPicker(!showPicker);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.pickerText, !selectedVehicle && { color: Colors.textLight }]}>
              {selectedVehicle ? `${selectedVehicle.name} (${selectedVehicle.points} pts)` : "Select a vehicle..."}
            </Text>
            <Feather name={showPicker ? "chevron-up" : "chevron-down"} size={20} color={Colors.textLight} />
          </TouchableOpacity>
          {showPicker && (
            <View style={styles.dropdown}>
              {loadingVehicles ? (
                <Text style={styles.dropdownLoading}>Loading vehicles...</Text>
              ) : vehicles.length === 0 ? (
                <Text style={styles.dropdownLoading}>No vehicles. Create some first.</Text>
              ) : (
                vehicles.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedVehicle(v);
                      setShowPicker(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{v.name}</Text>
                    <Text style={styles.dropdownItemPts}>{v.points} pts</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Feather name="plus-square" size={20} color={Colors.white} />
          <Text style={styles.buttonText}>{loading ? "Creating..." : "Generate QR Code"}</Text>
        </TouchableOpacity>
      </ScrollView>
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
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminText },
  scroll: { padding: 20, gap: 20 },
  resultScroll: { padding: 20, alignItems: "center", gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.adminCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.adminText,
  },
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
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Colors.white, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  qrContainer: {
    backgroundColor: Colors.white,
    padding: 24,
    borderRadius: 20,
    marginTop: 16,
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
  downloadBtn: {
    backgroundColor: Colors.adminAccent,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
  },
  downloadBtnText: { color: Colors.white, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  newBtn: {
    borderWidth: 1.5,
    borderColor: Colors.adminAccent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%",
  },
  newBtnText: { color: Colors.adminAccent, fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
