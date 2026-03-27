import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

interface Vehicle {
  id: number;
  name: string;
  points: number;
  salesPrice: number;
  createdAt: string;
}

export default function VehiclesScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [name, setName] = useState("");
  const [points, setPoints] = useState("");
  const [salesPrice, setSalesPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchVehicles = async () => {
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/vehicles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setVehicles(data);
    } catch {
      Alert.alert("Error", "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVehicles(); }, []);

  const openAdd = () => {
    setEditVehicle(null);
    setName("");
    setPoints("");
    setSalesPrice("");
    setModalVisible(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditVehicle(v);
    setName(v.name);
    setPoints(String(v.points));
    setSalesPrice(String(v.salesPrice ?? 0));
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !points.trim()) {
      Alert.alert("Error", "Name and points are required");
      return;
    }
    setSaving(true);
    try {
      const url = editVehicle
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/vehicles/${editVehicle.id}`
        : `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/vehicles`;
      const res = await fetch(url, {
        method: editVehicle ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), points: Number(points), salesPrice: Number(salesPrice) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setModalVisible(false);
      fetchVehicles();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (v: Vehicle) => {
    Alert.alert("Delete Vehicle", `Delete "${v.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/vehicles/${v.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            fetchVehicles();
          } catch {
            Alert.alert("Error", "Failed to delete vehicle");
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vehicles & Points</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
          <Feather name="plus" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={vehicles}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={fetchVehicles}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="truck" size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>No vehicles yet. Tap + to add one.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.vehicleName}>{item.name}</Text>
              <Text style={styles.vehiclePts}>{item.points} pts/unit</Text>
              {item.salesPrice > 0 && (
                <Text style={styles.vehiclePrice}>Rs. {item.salesPrice.toLocaleString()} sale price</Text>
              )}
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                <Feather name="edit-2" size={18} color={Colors.adminAccent} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                <Feather name="trash-2" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editVehicle ? "Edit Vehicle" : "Add Vehicle"}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Vehicle name"
              placeholderTextColor={Colors.textLight}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Points value"
              placeholderTextColor={Colors.textLight}
              value={points}
              onChangeText={setPoints}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Sales price (Rs.)"
              placeholderTextColor={Colors.textLight}
              value={salesPrice}
              onChangeText={setSalesPrice}
              keyboardType="numeric"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
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
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminText },
  addBtn: {
    backgroundColor: Colors.adminAccent,
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.adminCard,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardLeft: { flex: 1 },
  vehicleName: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  vehiclePts: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.adminAccent, marginTop: 4 },
  vehiclePrice: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: "row", gap: 12 },
  iconBtn: { padding: 8 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: { color: Colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    gap: 14,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 4 },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: { color: Colors.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 16 },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.adminAccent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { color: Colors.white, fontFamily: "Inter_600SemiBold", fontSize: 16 },
});
