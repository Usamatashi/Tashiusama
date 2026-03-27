import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

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
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [name, setName] = useState("");
  const [points, setPoints] = useState("");
  const [salesPrice, setSalesPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [confirmVehicle, setConfirmVehicle] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setVehicles(await res.json());
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const openAdd = () => {
    setEditVehicle(null);
    setErrorMsg("");
    setName(""); setPoints(""); setSalesPrice("");
    setModalVisible(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditVehicle(v);
    setErrorMsg("");
    setName(v.name);
    setPoints(String(v.points));
    setSalesPrice(String(v.salesPrice ?? 0));
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !points.trim()) {
      setErrorMsg("Name and points are required");
      return;
    }
    setErrorMsg("");
    setSaving(true);
    try {
      const url = editVehicle ? `${BASE}/vehicles/${editVehicle.id}` : `${BASE}/vehicles`;
      const method = editVehicle ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          points: Number(points),
          salesPrice: Number(salesPrice) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || "Failed to save vehicle"); return; }
      setModalVisible(false);
      fetchVehicles();
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmVehicle) return;
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}/vehicles/${confirmVehicle.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setConfirmVehicle(null);
        fetchVehicles();
      }
    } catch {
    } finally {
      setDeleting(false);
    }
  };

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const renderVehicle = ({ item }: { item: Vehicle }) => {
    const isSelected = selectedVehicleId === item.id;
    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => {
          setSelectedVehicleId(null);
          openEdit(item);
        }}
        onLongPress={() => setSelectedVehicleId(isSelected ? null : item.id)}
        delayLongPress={300}
        activeOpacity={isSelected ? 1 : 0.85}
      >
        <View style={styles.cardIconWrap}>
          <Feather name="truck" size={20} color={Colors.adminAccent} />
        </View>
        <View style={styles.cardLeft}>
          <Text style={styles.vehicleName}>{item.name}</Text>
          <View style={styles.metaChip}>
            <Feather name="star" size={11} color={Colors.adminAccent} />
            <Text style={styles.metaChipText}>{item.points} pts/unit</Text>
          </View>
        </View>
        {item.salesPrice > 0 && (
          <View style={styles.priceWrap}>
            <Text style={styles.priceCurrency}>Rs.</Text>
            <Text style={styles.priceValue}>{item.salesPrice.toLocaleString()}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        {selectedVehicle ? (
          <>
            <TouchableOpacity
              style={styles.cancelSelBtn}
              onPress={() => setSelectedVehicleId(null)}
              activeOpacity={0.7}
            >
              <Feather name="x" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitleSelected} numberOfLines={1}>
              {selectedVehicle.name}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.headerActionBtn, styles.editHeaderBtn]}
                onPress={() => { setSelectedVehicleId(null); openEdit(selectedVehicle); }}
                activeOpacity={0.8}
              >
                <Feather name="edit-2" size={16} color={Colors.adminAccent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerActionBtn, styles.deleteHeaderBtn]}
                onPress={() => { setSelectedVehicleId(null); setConfirmVehicle(selectedVehicle); }}
                activeOpacity={0.8}
              >
                <Feather name="trash-2" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.headerTitle}>Vehicles & Points</Text>
            <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
              <Feather name="plus" size={20} color={Colors.white} />
            </TouchableOpacity>
          </>
        )}
      </View>

      <FlatList
        data={vehicles}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 16 }]}
        refreshing={loading}
        onRefresh={fetchVehicles}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Feather name="truck" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No vehicles yet.{"\n"}Tap + to add one.</Text>
            </View>
          ) : null
        }
        renderItem={renderVehicle}
      />

      {/* Edit / Create Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={[styles.modal, { paddingBottom: bottomPad + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editVehicle ? "Edit Vehicle" : "Add Vehicle"}</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalFields}>
                <Text style={styles.fieldLabel}>Vehicle Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Honda 125"
                  placeholderTextColor={Colors.textLight}
                  value={name}
                  onChangeText={setName}
                  autoCorrect={false}
                />

                <Text style={styles.fieldLabel}>Points per Unit *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 100"
                  placeholderTextColor={Colors.textLight}
                  value={points}
                  onChangeText={setPoints}
                  keyboardType="numeric"
                />

                <Text style={styles.fieldLabel}>Sales Price (Rs.)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 250000"
                  placeholderTextColor={Colors.textLight}
                  value={salesPrice}
                  onChangeText={setSalesPrice}
                  keyboardType="numeric"
                />

                {errorMsg ? (
                  <View style={styles.errorBox}>
                    <Feather name="alert-circle" size={14} color="#EF4444" />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? (editVehicle ? "Saving..." : "Adding...") : (editVehicle ? "Save" : "Add")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal visible={!!confirmVehicle} transparent animationType="fade" onRequestClose={() => setConfirmVehicle(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIcon}>
              <Feather name="trash-2" size={28} color="#EF4444" />
            </View>
            <Text style={styles.confirmTitle}>Delete Vehicle</Text>
            <Text style={styles.confirmMsg}>
              Are you sure you want to delete{"\n"}
              <Text style={{ fontFamily: "Inter_600SemiBold" }}>
                {confirmVehicle?.name}
              </Text>
              ?{"\n"}This cannot be undone.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setConfirmVehicle(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDelete, deleting && { opacity: 0.6 }]}
                onPress={confirmDelete}
                disabled={deleting}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmDeleteText}>{deleting ? "Deleting..." : "Delete"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminText },
  headerTitleSelected: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.adminText,
    marginHorizontal: 10,
  },
  cancelSelBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#F2F2F7",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  headerActions: { flexDirection: "row", gap: 8, flexShrink: 0 },
  headerActionBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  editHeaderBtn: { backgroundColor: `${Colors.adminAccent}18` },
  deleteHeaderBtn: { backgroundColor: "#FEE2E2" },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.adminAccent,
    alignItems: "center", justifyContent: "center",
  },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSelected: {
    borderColor: Colors.adminAccent,
    borderWidth: 1.5,
    backgroundColor: `${Colors.adminAccent}06`,
  },
  cardIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: `${Colors.adminAccent}18`,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  cardLeft: { flex: 1, gap: 6 },
  vehicleName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaChipText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.adminAccent },
  priceWrap: { alignItems: "flex-end", justifyContent: "center", flexShrink: 0 },
  priceCurrency: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  priceValue: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    color: Colors.adminText,
    letterSpacing: -0.5,
  },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { color: Colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center" },

  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, gap: 16, maxHeight: "90%",
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: "center", marginBottom: 4,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  modalFields: { gap: 8 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginTop: 8 },
  modalInput: {
    backgroundColor: "#F7F8FA",
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text,
  },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FEF2F2", borderRadius: 10,
    padding: 12, marginTop: 8,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#EF4444", flex: 1 },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingVertical: 14, alignItems: "center",
  },
  cancelBtnText: { color: Colors.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  saveBtn: {
    flex: 1, backgroundColor: Colors.adminAccent,
    borderRadius: 12, paddingVertical: 14, alignItems: "center",
  },
  saveBtnText: { color: Colors.white, fontFamily: "Inter_600SemiBold", fontSize: 15 },

  confirmOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  confirmBox: {
    backgroundColor: Colors.white, borderRadius: 24,
    padding: 28, alignItems: "center", gap: 12, width: "100%", maxWidth: 340,
  },
  confirmIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center",
  },
  confirmTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  confirmMsg: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: Colors.textSecondary, textAlign: "center", lineHeight: 22,
  },
  confirmBtns: { flexDirection: "row", gap: 12, width: "100%", marginTop: 4 },
  confirmCancel: {
    flex: 1, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingVertical: 13, alignItems: "center",
  },
  confirmCancelText: { color: Colors.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  confirmDelete: {
    flex: 1, backgroundColor: "#EF4444",
    borderRadius: 12, paddingVertical: 13, alignItems: "center",
  },
  confirmDeleteText: { color: Colors.white, fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
