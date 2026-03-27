import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "salesman", label: "Salesman" },
  { value: "mechanic", label: "Mechanic" },
  { value: "retailer", label: "Retailer" },
] as const;

type Role = typeof ROLES[number]["value"];

const ROLE_COLORS: Record<Role, string> = {
  admin: "#E87722",
  salesman: "#0D9488",
  mechanic: "#7B2FBE",
  retailer: "#2563EB",
};

interface User {
  id: number;
  email: string;
  role: Role;
  name: string | null;
  phone: string | null;
  city: string | null;
  points: number;
  createdAt: string;
}

export default function CreateAccountScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("retailer");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setUsers(await res.json());
    } catch {
      Alert.alert("Error", "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openAdd = () => {
    setName(""); setPhone(""); setCity("");
    setEmail(""); setPassword(""); setRole("retailer");
    setModalVisible(true);
  };

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert("Error", "Name is required"); return; }
    if (!email.trim()) { Alert.alert("Error", "Email is required"); return; }
    if (!password.trim() || password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters"); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(), phone: phone.trim(), city: city.trim(),
          email: email.trim(), password, role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create account");
      setModalVisible(false);
      fetchUsers();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.userCard}>
      <View style={styles.avatarWrap}>
        <Text style={styles.avatarText}>
          {(item.name || item.email).charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {item.name || item.email}
        </Text>
        {item.phone ? (
          <Text style={styles.userPhone}>{item.phone}</Text>
        ) : (
          <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
        )}
      </View>
      <View style={styles.userRight}>
        {item.city ? (
          <Text style={styles.userCity} numberOfLines={1}>{item.city}</Text>
        ) : null}
        <View style={[styles.rolePill, { backgroundColor: `${ROLE_COLORS[item.role]}18` }]}>
          <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] }]}>
            {item.role}
          </Text>
        </View>
      </View>
    </View>
  );

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Accounts</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
          <Feather name="plus" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 16 }]}
        refreshing={loading}
        onRefresh={fetchUsers}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Feather name="users" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No accounts yet.{"\n"}Tap + to create one.</Text>
            </View>
          ) : null
        }
        renderItem={renderUser}
      />

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={[styles.modal, { paddingBottom: bottomPad + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Account</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalFields}>
                <Text style={styles.fieldLabel}>Role</Text>
                <View style={styles.roleGrid}>
                  {ROLES.map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      style={[styles.roleBtn, role === r.value && { backgroundColor: ROLE_COLORS[r.value], borderColor: ROLE_COLORS[r.value] }]}
                      onPress={() => setRole(r.value)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.roleBtnText, role === r.value && styles.roleBtnTextActive]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Full Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Ahmed Khan"
                  placeholderTextColor={Colors.textLight}
                  value={name}
                  onChangeText={setName}
                  autoCorrect={false}
                />

                <Text style={styles.fieldLabel}>Phone</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. +92 300 1234567"
                  placeholderTextColor={Colors.textLight}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />

                <Text style={styles.fieldLabel}>City</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Karachi"
                  placeholderTextColor={Colors.textLight}
                  value={city}
                  onChangeText={setCity}
                  autoCorrect={false}
                />

                <Text style={styles.fieldLabel}>Email *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="email@example.com"
                  placeholderTextColor={Colors.textLight}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={styles.fieldLabel}>Password *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={Colors.textLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </ScrollView>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>{saving ? "Creating..." : "Create"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.adminAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { padding: 16, gap: 10 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Colors.adminAccent}18`,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.adminAccent,
  },
  userInfo: { flex: 1, gap: 3 },
  userName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.adminText,
  },
  userPhone: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  userEmail: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  userRight: { alignItems: "flex-end", gap: 5 },
  userCity: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.adminText,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: {
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
  },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 16,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  modalFields: { gap: 8 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginTop: 8,
  },
  roleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  roleBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  roleBtnTextActive: { color: Colors.white },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: { color: Colors.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.adminAccent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { color: Colors.white, fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
