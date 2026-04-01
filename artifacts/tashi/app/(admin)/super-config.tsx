import React, { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAdminSettings,
  type AdminSettings,
  type AdminUserEntry,
  DEFAULT_SETTINGS,
} from "@/context/AdminSettingsContext";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const SUPER_ACCENT = "#7B2FBE";

type SettingItem = {
  key: keyof AdminSettings;
  label: string;
  desc: string;
  icon: React.ComponentProps<typeof Feather>["name"];
};

const TAB_SETTINGS: SettingItem[] = [
  { key: "tab_dashboard", label: "Dashboard", desc: "Main overview and quick action cards", icon: "grid" },
  { key: "tab_products", label: "Products", desc: "Product and points management", icon: "truck" },
  { key: "tab_users", label: "Users", desc: "Account creation and management", icon: "users" },
  { key: "tab_payments", label: "Payments", desc: "Retailer balances and collections", icon: "dollar-sign" },
];

const CARD_SETTINGS: SettingItem[] = [
  { key: "card_create_qr", label: "Create QR Code", desc: "Generate and assign QR codes to vehicles", icon: "plus-square" },
  { key: "card_orders", label: "Orders", desc: "Review and manage sales orders", icon: "clipboard" },
  { key: "card_claims", label: "Claim Rewards", desc: "Review and approve reward claims", icon: "gift" },
  { key: "card_create_ads", label: "Create Ads", desc: "Create and manage advertisements", icon: "radio" },
  { key: "card_create_text", label: "Create Text", desc: "Add scrolling ticker messages for users", icon: "type" },
  { key: "card_payments", label: "Payments Card", desc: "Shortcut to the payments section", icon: "dollar-sign" },
  { key: "card_commission", label: "Commission", desc: "Track salesman commission on sales", icon: "percent" },
];

// ─── Per-Admin Access Panel ───────────────────────────────────────────────────

function PerAdminPanel() {
  const { adminUsers, isLoadingAdmins, fetchAdminUsers, updateAdminUserSettings } = useAdminSettings();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [localSettings, setLocalSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveAllLoading, setSaveAllLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchAdminUsers();
    }, [fetchAdminUsers])
  );

  const selectedAdmin = adminUsers.find((a) => a.id === selectedId) ?? null;

  const handleSelect = (admin: AdminUserEntry) => {
    setSelectedId(admin.id);
    setLocalSettings({ ...DEFAULT_SETTINGS, ...admin.settings });
    setQuery(admin.name ?? admin.phone);
    setDropdownOpen(false);
    Keyboard.dismiss();
  };

  const filteredAdmins = adminUsers.filter((a) => {
    const q = query.toLowerCase();
    return (
      (a.name ?? "").toLowerCase().includes(q) ||
      a.phone.toLowerCase().includes(q)
    );
  });

  const handleToggle = useCallback(async (key: keyof AdminSettings) => {
    if (!selectedId) return;
    const newSettings = { ...localSettings, [key]: !localSettings[key] };
    setLocalSettings(newSettings);
    setSavingKey(key);
    try {
      await updateAdminUserSettings(selectedId, newSettings);
    } catch {
      setLocalSettings(localSettings);
      Alert.alert("Error", "Failed to save. Please try again.");
    } finally {
      setSavingKey(null);
    }
  }, [selectedId, localSettings, updateAdminUserSettings]);

  const handleGrantAll = useCallback(async () => {
    if (!selectedId) return;
    const all: AdminSettings = {
      tab_dashboard: true, tab_products: true, tab_users: true, tab_payments: true,
      card_create_qr: true, card_orders: true, card_claims: true,
      card_create_ads: true, card_create_text: true, card_payments: true,
      card_commission: true,
    };
    setLocalSettings(all);
    setSaveAllLoading(true);
    try {
      await updateAdminUserSettings(selectedId, all);
    } catch {
      Alert.alert("Error", "Failed to save.");
    } finally {
      setSaveAllLoading(false);
    }
  }, [selectedId, updateAdminUserSettings]);

  const handleRevokeAll = useCallback(async () => {
    if (!selectedId) return;
    const none: AdminSettings = {
      tab_dashboard: false, tab_products: false, tab_users: false, tab_payments: false,
      card_create_qr: false, card_orders: false, card_claims: false,
      card_create_ads: false, card_create_text: false, card_payments: false,
      card_commission: false,
    };
    setLocalSettings(none);
    setSaveAllLoading(true);
    try {
      await updateAdminUserSettings(selectedId, none);
    } catch {
      Alert.alert("Error", "Failed to save.");
    } finally {
      setSaveAllLoading(false);
    }
  }, [selectedId, updateAdminUserSettings]);

  if (isLoadingAdmins) {
    return (
      <View style={perAdminStyles.loadingBox}>
        <ActivityIndicator color={SUPER_ACCENT} />
        <Text style={perAdminStyles.loadingText}>Loading admins…</Text>
      </View>
    );
  }

  if (adminUsers.length === 0) {
    return (
      <View style={perAdminStyles.emptyBox}>
        <Feather name="users" size={22} color={Colors.textSecondary} />
        <Text style={perAdminStyles.emptyText}>No admin accounts found. Create admins under the Users tab.</Text>
      </View>
    );
  }

  return (
    <View style={perAdminStyles.root}>
      {/* Search field */}
      <Text style={perAdminStyles.pickerLabel}>Select Admin</Text>
      <View style={perAdminStyles.searchWrap}>
        <Feather name="search" size={15} color={Colors.textSecondary} style={perAdminStyles.searchIcon} />
        <TextInput
          style={perAdminStyles.searchInput}
          placeholder="Search by name or phone…"
          placeholderTextColor={Colors.textSecondary}
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setDropdownOpen(true);
            if (!t) {
              setSelectedId(null);
            }
          }}
          onFocus={() => setDropdownOpen(true)}
          returnKeyType="done"
          onSubmitEditing={() => setDropdownOpen(false)}
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => { setQuery(""); setSelectedId(null); setDropdownOpen(false); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={15} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {dropdownOpen && filteredAdmins.length > 0 && (
        <View style={perAdminStyles.dropdown}>
          {filteredAdmins.map((admin, idx) => (
            <TouchableOpacity
              key={admin.id}
              onPress={() => handleSelect(admin)}
              activeOpacity={0.7}
              style={[
                perAdminStyles.dropdownItem,
                idx < filteredAdmins.length - 1 && perAdminStyles.dropdownSep,
                admin.id === selectedId && perAdminStyles.dropdownItemActive,
              ]}
            >
              <View style={[perAdminStyles.dropdownAvatar, admin.id === selectedId && { backgroundColor: SUPER_ACCENT }]}>
                <Feather name="user" size={13} color={admin.id === selectedId ? "#fff" : SUPER_ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                {admin.name ? (
                  <>
                    <Text style={perAdminStyles.dropdownName}>{admin.name}</Text>
                    <Text style={perAdminStyles.dropdownPhone}>{admin.phone}</Text>
                  </>
                ) : (
                  <Text style={perAdminStyles.dropdownName}>{admin.phone}</Text>
                )}
              </View>
              {admin.id === selectedId && (
                <Feather name="check" size={14} color={SUPER_ACCENT} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {dropdownOpen && query.length > 0 && filteredAdmins.length === 0 && (
        <View style={perAdminStyles.dropdown}>
          <View style={perAdminStyles.dropdownItem}>
            <Text style={perAdminStyles.dropdownPhone}>No admins match "{query}"</Text>
          </View>
        </View>
      )}

      {selectedAdmin ? (
        <View style={perAdminStyles.panelCard}>
          {/* Header row */}
          <View style={perAdminStyles.panelHeader}>
            <View style={perAdminStyles.panelTitleWrap}>
              <Feather name="user-check" size={16} color={SUPER_ACCENT} />
              <Text style={perAdminStyles.panelTitle}>
                {selectedAdmin.name ?? selectedAdmin.phone}
              </Text>
            </View>
            <View style={perAdminStyles.quickBtns}>
              <TouchableOpacity
                style={[perAdminStyles.quickBtn, { borderColor: "#4CAF50" }]}
                onPress={handleGrantAll}
                disabled={saveAllLoading}
              >
                <Text style={[perAdminStyles.quickBtnText, { color: "#4CAF50" }]}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[perAdminStyles.quickBtn, { borderColor: "#FF3B30" }]}
                onPress={handleRevokeAll}
                disabled={saveAllLoading}
              >
                <Text style={[perAdminStyles.quickBtnText, { color: "#FF3B30" }]}>None</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tabs sub-section */}
          <Text style={perAdminStyles.subSection}>Navigation Tabs</Text>
          {TAB_SETTINGS.map((item, idx) => (
            <View key={item.key}>
              {idx > 0 && <View style={perAdminStyles.sep} />}
              <View style={perAdminStyles.row}>
                <View style={[perAdminStyles.rowIcon, { backgroundColor: `${SUPER_ACCENT}14` }]}>
                  <Feather name={item.icon} size={15} color={SUPER_ACCENT} />
                </View>
                <Text style={perAdminStyles.rowLabel}>{item.label}</Text>
                {savingKey === item.key || saveAllLoading ? (
                  <ActivityIndicator size="small" color={SUPER_ACCENT} style={perAdminStyles.spinner} />
                ) : (
                  <Switch
                    value={localSettings[item.key]}
                    onValueChange={() => handleToggle(item.key)}
                    trackColor={{ false: Colors.border, true: `${SUPER_ACCENT}55` }}
                    thumbColor={localSettings[item.key] ? SUPER_ACCENT : "#ccc"}
                    ios_backgroundColor={Colors.border}
                  />
                )}
              </View>
            </View>
          ))}

          {/* Cards sub-section */}
          <Text style={[perAdminStyles.subSection, { marginTop: 12 }]}>Dashboard Cards</Text>
          {CARD_SETTINGS.map((item, idx) => (
            <View key={item.key}>
              {idx > 0 && <View style={perAdminStyles.sep} />}
              <View style={perAdminStyles.row}>
                <View style={[perAdminStyles.rowIcon, { backgroundColor: `${SUPER_ACCENT}14` }]}>
                  <Feather name={item.icon} size={15} color={SUPER_ACCENT} />
                </View>
                <Text style={perAdminStyles.rowLabel}>{item.label}</Text>
                {savingKey === item.key || saveAllLoading ? (
                  <ActivityIndicator size="small" color={SUPER_ACCENT} style={perAdminStyles.spinner} />
                ) : (
                  <Switch
                    value={localSettings[item.key]}
                    onValueChange={() => handleToggle(item.key)}
                    trackColor={{ false: Colors.border, true: `${SUPER_ACCENT}55` }}
                    thumbColor={localSettings[item.key] ? SUPER_ACCENT : "#ccc"}
                    ios_backgroundColor={Colors.border}
                  />
                )}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const perAdminStyles = StyleSheet.create({
  root: { gap: 10 },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  emptyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  pickerLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 45,
    gap: 8,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.adminText,
  },
  dropdown: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    marginTop: -4,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  dropdownItemActive: {
    backgroundColor: `${SUPER_ACCENT}08`,
  },
  dropdownSep: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: `${SUPER_ACCENT}14`,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dropdownName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.adminText,
  },
  dropdownPhone: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  hintBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hintText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  panelCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    padding: 16,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  panelTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  panelTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.adminText,
    flex: 1,
  },
  quickBtns: {
    flexDirection: "row",
    gap: 6,
  },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickBtnText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  subSection: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sep: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 44,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.adminText,
  },
  spinner: { width: 51, height: 31 },
});

// ─── Change Password ──────────────────────────────────────────────────────────

function ChangePasswordPanel() {
  const { token } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const closeModal = () => {
    setModalVisible(false);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setError(""); setSuccess(false);
    setShowCurrent(false); setShowNew(false); setShowConfirm(false);
  };

  const handleSubmit = async () => {
    setError("");
    if (!currentPw || !newPw || !confirmPw) { setError("All fields are required"); return; }
    if (newPw.length < 6) { setError("New password must be at least 6 characters"); return; }
    if (newPw !== confirmPw) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/users/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to change password"); return; }
      setSuccess(true);
      setTimeout(closeModal, 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity style={pwStyles.triggerBtn} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
        <View style={pwStyles.triggerIconWrap}>
          <Feather name="lock" size={18} color={SUPER_ACCENT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={pwStyles.triggerLabel}>Change Password</Text>
          <Text style={pwStyles.triggerDesc}>Update your super admin account password</Text>
        </View>
        <Feather name="chevron-right" size={18} color={Colors.textLight} />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={pwStyles.overlay}>
          <TouchableOpacity style={{ ...StyleSheet.absoluteFillObject }} activeOpacity={1} onPress={closeModal} />
          <View style={pwStyles.sheet}>
            <View style={pwStyles.handle} />
            <View style={pwStyles.sheetHeader}>
              <View style={pwStyles.sheetIconWrap}>
                <Feather name="lock" size={20} color={SUPER_ACCENT} />
              </View>
              <Text style={pwStyles.sheetTitle}>Change Password</Text>
              <TouchableOpacity onPress={closeModal} style={pwStyles.sheetClose}>
                <Feather name="x" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {success ? (
              <View style={pwStyles.successBig}>
                <Feather name="check-circle" size={40} color="#10B981" />
                <Text style={pwStyles.successBigText}>Password updated!</Text>
              </View>
            ) : (
              <>
                <Text style={pwStyles.label}>Current Password</Text>
                <View style={pwStyles.inputRow}>
                  <TextInput
                    style={pwStyles.input}
                    placeholder="Enter current password"
                    placeholderTextColor={Colors.textLight}
                    secureTextEntry={!showCurrent}
                    value={currentPw}
                    onChangeText={setCurrentPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowCurrent(v => !v)} style={pwStyles.eye}>
                    <Feather name={showCurrent ? "eye-off" : "eye"} size={18} color={Colors.textLight} />
                  </TouchableOpacity>
                </View>

                <Text style={pwStyles.label}>New Password</Text>
                <View style={pwStyles.inputRow}>
                  <TextInput
                    style={pwStyles.input}
                    placeholder="Min. 6 characters"
                    placeholderTextColor={Colors.textLight}
                    secureTextEntry={!showNew}
                    value={newPw}
                    onChangeText={setNewPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowNew(v => !v)} style={pwStyles.eye}>
                    <Feather name={showNew ? "eye-off" : "eye"} size={18} color={Colors.textLight} />
                  </TouchableOpacity>
                </View>

                <Text style={pwStyles.label}>Confirm New Password</Text>
                <View style={pwStyles.inputRow}>
                  <TextInput
                    style={pwStyles.input}
                    placeholder="Re-enter new password"
                    placeholderTextColor={Colors.textLight}
                    secureTextEntry={!showConfirm}
                    value={confirmPw}
                    onChangeText={setConfirmPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={pwStyles.eye}>
                    <Feather name={showConfirm ? "eye-off" : "eye"} size={18} color={Colors.textLight} />
                  </TouchableOpacity>
                </View>

                {error ? (
                  <View style={pwStyles.errorBox}>
                    <Feather name="alert-circle" size={13} color="#EF4444" />
                    <Text style={pwStyles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[pwStyles.btn, loading && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={pwStyles.btnText}>Update Password</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const pwStyles = StyleSheet.create({
  triggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  triggerIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: `${SUPER_ACCENT}14`,
    alignItems: "center", justifyContent: "center",
  },
  triggerLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.adminText,
  },
  triggerDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  sheetIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: `${SUPER_ACCENT}14`,
    alignItems: "center", justifyContent: "center",
  },
  sheetTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.adminText,
  },
  sheetClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.adminText,
  },
  eye: { padding: 6 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#EF4444",
  },
  btn: {
    backgroundColor: SUPER_ACCENT,
    borderRadius: 14,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  btnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  successBig: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 32,
  },
  successBigText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.adminText,
    textAlign: "center",
  },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SuperConfigScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Feather name="shield" size={22} color={SUPER_ACCENT} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Admin Control Panel</Text>
          <Text style={styles.headerSubtitle}>Manage what regular admins can see</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Change Password Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Security</Text>
          </View>
          <ChangePasswordPanel />
        </View>

        {/* Per-Admin Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Per Admin Access</Text>
            <Text style={styles.sectionSubtitle}>
              Override access settings for a specific admin account
            </Text>
          </View>
          <PerAdminPanel />
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 14,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: `${SUPER_ACCENT}14`,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.adminText,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  scroll: {
    padding: 16,
    gap: 20,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: `${SUPER_ACCENT}0D`,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: `${SUPER_ACCENT}25`,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    paddingHorizontal: 4,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.adminText,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 68,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  settingInfo: {
    flex: 1,
    gap: 3,
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.adminText,
  },
  settingDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  savingSpinner: {
    width: 51,
    height: 31,
  },
});
