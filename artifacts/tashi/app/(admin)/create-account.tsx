import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { Redirect, router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useAdminSettings } from "@/context/AdminSettingsContext";
import { Colors } from "@/constants/colors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const DEFAULT_ACCESS = {
  tab_dashboard: true,
  tab_products: true,
  tab_users: true,
  tab_payments: true,
  card_create_qr: true,
  card_orders: true,
  card_claims: true,
  card_create_ads: true,
  card_create_text: true,
  card_payments: true,
};
type AccessKey = keyof typeof DEFAULT_ACCESS;

const ACCESS_TABS: { key: AccessKey; label: string }[] = [
  { key: "tab_dashboard", label: "Dashboard" },
  { key: "tab_products", label: "Products" },
  { key: "tab_users", label: "Accounts" },
  { key: "tab_payments", label: "Payments" },
];
const ACCESS_CARDS: { key: AccessKey; label: string }[] = [
  { key: "card_create_qr", label: "Create QR" },
  { key: "card_orders", label: "Orders" },
  { key: "card_claims", label: "Claims" },
  { key: "card_create_ads", label: "Create Ads" },
  { key: "card_create_text", label: "Create Text" },
  { key: "card_payments", label: "Payments" },
];

const ALL_ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "salesman", label: "Salesman" },
  { value: "mechanic", label: "Mechanic" },
  { value: "retailer", label: "Retailer" },
] as const;

type Role = typeof ALL_ROLES[number]["value"];

const ROLE_COLORS: Record<Role, string> = {
  super_admin: "#7B2FBE",
  admin: "#E87722",
  salesman: "#0D9488",
  mechanic: "#9333EA",
  retailer: "#2563EB",
};

const ADMIN_ROLE_FILTERS = [
  { value: "mechanic" as Role, label: "Mechanic", icon: "tool" as const, color: "#9333EA", bg: "#F5F0FF" },
  { value: "salesman" as Role, label: "Salesman", icon: "briefcase" as const, color: "#0D9488", bg: "#F0FDFA" },
  { value: "retailer" as Role, label: "Retailer", icon: "shopping-bag" as const, color: "#2563EB", bg: "#EFF6FF" },
];

const SUPER_ADMIN_ROLE_FILTERS = [
  { value: "admin" as Role, label: "Admin", icon: "shield" as const, color: "#E87722", bg: "#FFF4EC" },
  { value: "mechanic" as Role, label: "Mechanic", icon: "tool" as const, color: "#9333EA", bg: "#F5F0FF" },
  { value: "salesman" as Role, label: "Salesman", icon: "briefcase" as const, color: "#0D9488", bg: "#F0FDFA" },
  { value: "retailer" as Role, label: "Retailer", icon: "shopping-bag" as const, color: "#2563EB", bg: "#EFF6FF" },
];

interface Region { id: number; name: string; }

interface User {
  id: number;
  phone: string;
  role: Role;
  name: string | null;
  city: string | null;
  regionId: number | null;
  points: number;
  createdAt: string;
}

export default function CreateAccountScreen() {
  const { token, user: currentUser } = useAuth();
  const { settings } = useAdminSettings();
  const insets = useSafeAreaInsets();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const ROLES = ALL_ROLES.filter((r) => {
    if (r.value === "super_admin") return false;
    if (r.value === "admin") return isSuperAdmin;
    return true;
  });
  const ROLE_FILTERS = isSuperAdmin ? SUPER_ADMIN_ROLE_FILTERS : ADMIN_ROLE_FILTERS;
  const [activeFilter, setActiveFilter] = useState<Role | "all">(ROLE_FILTERS[0].value);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const lastTapRef = useRef<Record<number, number>>({});
  const tapTimerRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const handleCardPress = (item: User) => {
    const now = Date.now();
    const last = lastTapRef.current[item.id] ?? 0;
    lastTapRef.current[item.id] = now;

    if (now - last < 350) {
      clearTimeout(tapTimerRef.current[item.id]);
      setSelectedUserId((prev) => (prev === item.id ? null : item.id));
      return;
    }

    tapTimerRef.current[item.id] = setTimeout(() => {
      setSelectedUserId(null);
      openEdit(item);
    }, 350);
  };

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("retailer");
  const [access, setAccess] = useState({ ...DEFAULT_ACCESS });
  const [regionId, setRegionId] = useState<number | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setUsers(await res.json());
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchRegions = useCallback(async () => {
    setRegionsLoading(true);
    try {
      const res = await fetch(`${BASE}/regions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setRegions(await res.json());
    } catch {} finally { setRegionsLoading(false); }
  }, [token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openAdd = () => {
    setEditingUser(null);
    setErrorMsg("");
    setName(""); setPhone(""); setCity(""); setPassword("");
    setRole(activeFilter !== "all" ? activeFilter : "retailer");
    setAccess({ ...DEFAULT_ACCESS });
    setRegionId(null);
    fetchRegions();
    setModalVisible(true);
  };

  const openEdit = async (user: User) => {
    setEditingUser(user);
    setErrorMsg("");
    setName(user.name || "");
    setPhone(user.phone);
    setCity(user.city || "");
    setPassword("");
    setRole(user.role);
    setAccess({ ...DEFAULT_ACCESS });
    setRegionId(user.regionId ?? null);
    fetchRegions();
    if (user.role === "admin" && currentUser?.role === "super_admin") {
      try {
        const res = await fetch(`${BASE}/admin-user-settings/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAccess({ ...DEFAULT_ACCESS, ...data });
        }
      } catch {}
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!phone.trim()) { setErrorMsg("Phone number is required"); return; }
    if (!editingUser && (!password.trim() || password.length < 6)) {
      setErrorMsg("Password must be at least 6 characters"); return;
    }
    setErrorMsg("");
    setSaving(true);
    try {
      const body: Record<string, any> = {
        name: name.trim(), phone: phone.trim(), city: city.trim(), role,
        regionId: regionId ?? null,
      };
      if (password.trim()) body.password = password;

      const url = editingUser ? `${BASE}/users/${editingUser.id}` : `${BASE}/users`;
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || "Failed to save account"); return; }

      if (role === "admin" && currentUser?.role === "super_admin") {
        const userId = editingUser ? editingUser.id : data.id;
        if (userId) {
          await fetch(`${BASE}/admin-user-settings/${userId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(access),
          });
        }
      }

      setModalVisible(false);
      fetchUsers();
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmUser) return;
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}/users/${confirmUser.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setConfirmUser(null);
        fetchUsers();
      }
    } catch {
    } finally {
      setDeleting(false);
    }
  };

  const renderUser = ({ item }: { item: User }) => {
    const isSelected = selectedUserId === item.id;
    return (
      <TouchableOpacity
        style={[styles.userCard, isSelected && styles.userCardSelected]}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>
              {(item.name || item.phone).charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.name || item.phone}
            </Text>
          </View>
          <Text style={styles.userPhoneRight} numberOfLines={1}>{item.phone}</Text>
        </View>
        <View style={styles.cardDivider} />
        <View style={styles.cardBottom}>
          <View style={styles.metaChip}>
            <Feather name="map-pin" size={11} color={item.city ? Colors.adminAccent : Colors.textLight} />
            <Text style={[styles.metaChipText, !item.city && { color: Colors.textLight }]}>
              {item.city || "No city"}
            </Text>
          </View>
          <View style={[styles.rolePill, { backgroundColor: `${ROLE_COLORS[item.role]}12` }]}>
            <View style={[styles.roleDot, { backgroundColor: ROLE_COLORS[item.role] }]} />
            <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] }]}>{item.role}</Text>
          </View>
          {isSelected && (
            <TouchableOpacity
              style={styles.deleteInlineBtn}
              onPress={() => { setSelectedUserId(null); setConfirmUser(item); }}
              activeOpacity={0.8}
            >
              <Feather name="trash-2" size={13} color="#fff" />
              <Text style={styles.deleteInlineText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;

  const filteredUsers = users.filter((u) => {
    if (u.role === "super_admin") return false;
    if (activeFilter !== "all" && u.role !== activeFilter) return false;
    return true;
  });

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  if (currentUser?.role !== "super_admin" && !settings.tab_users) return <Redirect href="/(admin)" />;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        {selectedUser ? (
          <>
            <TouchableOpacity
              style={styles.cancelSelBtn}
              onPress={() => setSelectedUserId(null)}
              activeOpacity={0.7}
            >
              <Feather name="x" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitleSelected} numberOfLines={1}>
              {selectedUser.name || selectedUser.phone}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.headerActionBtn, styles.editHeaderBtn]}
                onPress={() => { setSelectedUserId(null); openEdit(selectedUser); }}
                activeOpacity={0.8}
              >
                <Feather name="edit-2" size={16} color={Colors.adminAccent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerActionBtn, styles.deleteHeaderBtn]}
                onPress={() => { setSelectedUserId(null); setConfirmUser(selectedUser); }}
                activeOpacity={0.8}
              >
                <Feather name="trash-2" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <Feather name="arrow-left" size={20} color={Colors.adminAccent} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Accounts</Text>
            <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
              <Feather name="plus" size={20} color={Colors.white} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Role filter buttons */}
      <View style={styles.filterRow}>
        {ROLE_FILTERS.map((rf) => {
          const isActive = activeFilter === rf.value;
          const count = users.filter((u) => u.role === rf.value).length;
          return (
            <TouchableOpacity
              key={rf.value}
              style={[
                styles.filterBtn,
                isActive && { backgroundColor: rf.color, borderColor: rf.color },
                !isActive && { borderColor: rf.color + "55" },
              ]}
              onPress={() => setActiveFilter(isActive ? "all" : rf.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterCountText, { color: isActive ? "#fff" : rf.color }]}>{count}</Text>
              <View style={styles.filterBtnBottom}>
                <Feather name={rf.icon} size={12} color={isActive ? "#fff" : rf.color} />
                <Text
                  style={[styles.filterBtnText, { color: isActive ? "#fff" : rf.color }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {rf.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredUsers}
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

      {/* Edit / Create Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={[styles.modal, { paddingBottom: bottomPad + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editingUser ? "Edit Account" : "New Account"}</Text>

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

                <Text style={styles.fieldLabel}>Phone Number *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 03001234567"
                  placeholderTextColor={Colors.textLight}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />

                <Text style={styles.fieldLabel}>Full Name</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Ahmed Khan"
                  placeholderTextColor={Colors.textLight}
                  value={name}
                  onChangeText={setName}
                  autoCorrect={false}
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

                {(role === "retailer" || role === "salesman") && (
                  <>
                    <Text style={styles.fieldLabel}>Region</Text>
                    {regionsLoading ? (
                      <View style={caStyles.regionLoadWrap}>
                        <ActivityIndicator size="small" color={Colors.adminAccent} />
                        <Text style={caStyles.regionLoadText}>Loading regions…</Text>
                      </View>
                    ) : regions.length === 0 ? (
                      <View style={caStyles.regionLoadWrap}>
                        <Text style={caStyles.regionLoadText}>No regions defined yet (create in Config tab)</Text>
                      </View>
                    ) : (
                      <View style={caStyles.regionList}>
                        <TouchableOpacity
                          style={[caStyles.regionChip, regionId === null && caStyles.regionChipActive]}
                          onPress={() => setRegionId(null)}
                          activeOpacity={0.8}
                        >
                          <Text style={[caStyles.regionChipText, regionId === null && caStyles.regionChipTextActive]}>
                            None
                          </Text>
                        </TouchableOpacity>
                        {regions.map((r) => (
                          <TouchableOpacity
                            key={r.id}
                            style={[caStyles.regionChip, regionId === r.id && caStyles.regionChipActive]}
                            onPress={() => setRegionId(r.id)}
                            activeOpacity={0.8}
                          >
                            <Text style={[caStyles.regionChipText, regionId === r.id && caStyles.regionChipTextActive]}>
                              {r.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}

                {(!editingUser || editingUser.role !== "super_admin" || isSuperAdmin) && (
                  <>
                    <Text style={styles.fieldLabel}>
                      {editingUser ? "New Password (leave blank to keep)" : "Password *"}
                    </Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder={editingUser ? "Leave blank to keep current" : "Min. 6 characters"}
                      placeholderTextColor={Colors.textLight}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </>
                )}

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
                  {saving ? (editingUser ? "Saving..." : "Creating...") : (editingUser ? "Save" : "Create")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal visible={!!confirmUser} transparent animationType="fade" onRequestClose={() => setConfirmUser(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIcon}>
              <Feather name="trash-2" size={28} color="#EF4444" />
            </View>
            <Text style={styles.confirmTitle}>Delete Account</Text>
            <Text style={styles.confirmMsg}>
              Are you sure you want to delete{"\n"}
              <Text style={{ fontFamily: "Inter_600SemiBold" }}>
                {confirmUser?.name || confirmUser?.phone}
              </Text>
              ?{"\n"}This cannot be undone.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setConfirmUser(null)}
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
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminText, flex: 1, textAlign: "center" },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${Colors.adminAccent}18`, justifyContent: "center", alignItems: "center" },
  headerTitleSelected: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.adminText,
    marginHorizontal: 10,
  },
  cancelSelBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.background,
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
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterBtn: {
    flex: 1,
    height: 60,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  filterBtnBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  filterBtnText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  filterCountText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    lineHeight: 19,
  },
  list: { padding: 16, gap: 10 },
  userCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardDivider: { height: 1, backgroundColor: Colors.border, marginTop: 8, marginHorizontal: -2 },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  avatarWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: `${Colors.adminAccent}18`,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  userNameMuted: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textLight, fontStyle: "italic" },
  userPhone: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  userPhoneRight: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    flexShrink: 1,
    textAlign: "right" as const,
  },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaChipText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  userCardSelected: {
    borderColor: Colors.adminAccent,
    borderWidth: 2,
    backgroundColor: "#FFF3E6",
  },
  actions: { flexDirection: "row", gap: 6, flexShrink: 0 },
  actionBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  editBtn: { backgroundColor: `${Colors.adminAccent}15` },
  deleteBtn: { backgroundColor: "#FEE2E2" },
  deleteInlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginLeft: "auto" as const,
  },
  deleteInlineText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
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
  roleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleBtn: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: "transparent",
  },
  roleBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  roleBtnTextActive: { color: Colors.white },
  modalInput: {
    backgroundColor: Colors.background,
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

  accessSectionHead: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textLight,
    textTransform: "uppercase", letterSpacing: 0.5, marginTop: 10, marginBottom: 6,
  },
  accessGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  accessChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: "#F7F8FA",
  },
  accessChipOn: { borderColor: Colors.adminAccent, backgroundColor: `${Colors.adminAccent}12` },
  accessChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textLight },
  accessChipTextOn: { color: Colors.adminAccent, fontFamily: "Inter_600SemiBold" },
});

const caStyles = StyleSheet.create({
  regionLoadWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  regionLoadText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textLight,
  },
  regionList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  regionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: "#F7F8FA",
  },
  regionChipActive: {
    borderColor: Colors.adminAccent,
    backgroundColor: `${Colors.adminAccent}14`,
  },
  regionChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textLight,
  },
  regionChipTextActive: {
    color: Colors.adminAccent,
    fontFamily: "Inter_600SemiBold",
  },
});
