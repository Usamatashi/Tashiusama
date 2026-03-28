import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
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
import { Colors } from "@/constants/colors";

const SUPER_ACCENT = "#7B2FBE";

type SettingItem = {
  key: keyof AdminSettings;
  label: string;
  desc: string;
  icon: React.ComponentProps<typeof Feather>["name"];
};

const TAB_SETTINGS: SettingItem[] = [
  { key: "tab_dashboard", label: "Dashboard", desc: "Main overview and quick action cards", icon: "grid" },
  { key: "tab_vehicles", label: "Vehicles", desc: "Vehicle and points management", icon: "truck" },
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
];

const ALL_SETTINGS = [...TAB_SETTINGS, ...CARD_SETTINGS];

type RoleDefinition = {
  role: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  color: string;
  bg: string;
  description: string;
  staticAccess: string[];
  dynamic?: true;
};

const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: "super_admin",
    label: "Super Admin",
    icon: "shield",
    color: SUPER_ACCENT,
    bg: `${SUPER_ACCENT}14`,
    description: "Unrestricted access to everything including this Config panel.",
    staticAccess: ["Dashboard", "Vehicles", "Users", "Payments", "Config Tab", "All Dashboard Cards"],
  },
  {
    role: "admin",
    label: "Admin",
    icon: "user-check",
    color: "#E87722",
    bg: "#E8772214",
    description: "Access is controlled by the global toggles above and/or per-admin overrides below.",
    staticAccess: [],
    dynamic: true,
  },
  {
    role: "salesman",
    label: "Salesman",
    icon: "briefcase",
    color: "#2196F3",
    bg: "#2196F314",
    description: "Can place orders and view their own performance.",
    staticAccess: ["Home", "My Points", "Orders", "Scan History", "Rewards", "Profile"],
  },
  {
    role: "mechanic",
    label: "Mechanic",
    icon: "tool",
    color: "#4CAF50",
    bg: "#4CAF5014",
    description: "Can scan vehicle QR codes to assign or redeem points.",
    staticAccess: ["Home", "QR Scanner", "My Points", "Scan History", "Profile"],
  },
  {
    role: "retailer",
    label: "Retailer",
    icon: "shopping-bag",
    color: "#FF5722",
    bg: "#FF572214",
    description: "Can track their points balance, rewards and payment history.",
    staticAccess: ["Home", "My Points", "Rewards", "Payments", "Profile"],
  },
];

function AccessBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[badgeStyles.badge, { backgroundColor: `${color}14`, borderColor: `${color}30` }]}>
      <Text style={[badgeStyles.text, { color }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  text: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});

function RoleCard({ def, settings }: { def: RoleDefinition; settings: AdminSettings }) {
  const dynamicAccess: string[] = [];
  if (def.dynamic) {
    if (settings.tab_dashboard) dynamicAccess.push("Dashboard");
    if (settings.tab_vehicles) dynamicAccess.push("Vehicles");
    if (settings.tab_users) dynamicAccess.push("Users");
    if (settings.tab_payments) dynamicAccess.push("Payments");
    if (settings.card_create_qr) dynamicAccess.push("Create QR");
    if (settings.card_orders) dynamicAccess.push("Orders Card");
    if (settings.card_claims) dynamicAccess.push("Claims Card");
    if (settings.card_create_ads) dynamicAccess.push("Ads Card");
    if (settings.card_create_text) dynamicAccess.push("Text Card");
    if (settings.card_payments) dynamicAccess.push("Payments Card");
  }

  const accessList = def.dynamic ? dynamicAccess : def.staticAccess;
  const isEmpty = accessList.length === 0;

  return (
    <View style={[roleStyles.card, { borderLeftColor: def.color, borderLeftWidth: 3 }]}>
      <View style={roleStyles.cardHeader}>
        <View style={[roleStyles.iconWrap, { backgroundColor: def.bg }]}>
          <Feather name={def.icon} size={16} color={def.color} />
        </View>
        <View style={roleStyles.headerText}>
          <Text style={[roleStyles.roleLabel, { color: def.color }]}>{def.label}</Text>
          <Text style={roleStyles.roleDesc}>{def.description}</Text>
        </View>
      </View>
      <View style={roleStyles.badgeWrap}>
        {isEmpty ? (
          <Text style={roleStyles.noAccess}>No access currently enabled</Text>
        ) : (
          accessList.map((a) => (
            <AccessBadge key={a} label={a} color={def.color} />
          ))
        )}
      </View>
    </View>
  );
}

const roleStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  roleLabel: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  roleDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  noAccess: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
});

// ─── Per-Admin Access Panel ───────────────────────────────────────────────────

function PerAdminPanel() {
  const { adminUsers, isLoadingAdmins, fetchAdminUsers, updateAdminUserSettings } = useAdminSettings();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [localSettings, setLocalSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveAllLoading, setSaveAllLoading] = useState(false);

  useEffect(() => {
    fetchAdminUsers();
  }, [fetchAdminUsers]);

  const selectedAdmin = adminUsers.find((a) => a.id === selectedId) ?? null;

  const handleSelect = (admin: AdminUserEntry) => {
    setSelectedId(admin.id);
    setLocalSettings({ ...DEFAULT_SETTINGS, ...admin.settings });
  };

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
      tab_dashboard: true, tab_vehicles: true, tab_users: true, tab_payments: true,
      card_create_qr: true, card_orders: true, card_claims: true,
      card_create_ads: true, card_create_text: true, card_payments: true,
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
      tab_dashboard: false, tab_vehicles: false, tab_users: false, tab_payments: false,
      card_create_qr: false, card_orders: false, card_claims: false,
      card_create_ads: false, card_create_text: false, card_payments: false,
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
      {/* Admin selector */}
      <Text style={perAdminStyles.pickerLabel}>Select Admin</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={perAdminStyles.chipScroll} contentContainerStyle={perAdminStyles.chipRow}>
        {adminUsers.map((admin) => {
          const isActive = admin.id === selectedId;
          return (
            <TouchableOpacity
              key={admin.id}
              onPress={() => handleSelect(admin)}
              activeOpacity={0.8}
              style={[
                perAdminStyles.chip,
                isActive && { backgroundColor: SUPER_ACCENT, borderColor: SUPER_ACCENT },
              ]}
            >
              <Feather name="user" size={13} color={isActive ? "#fff" : Colors.textSecondary} />
              <Text style={[perAdminStyles.chipText, isActive && { color: "#fff" }]}>
                {admin.name ?? admin.phone}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
      ) : (
        <View style={perAdminStyles.hintBox}>
          <Feather name="arrow-up" size={14} color={Colors.textSecondary} />
          <Text style={perAdminStyles.hintText}>Select an admin above to configure their access</Text>
        </View>
      )}
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
  chipScroll: { flexGrow: 0 },
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.adminText,
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

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SuperConfigScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useAdminSettings();
  const [localSettings, setLocalSettings] = useState<AdminSettings>(settings);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const toggle = useCallback(async (key: keyof AdminSettings) => {
    const prevSettings = localSettings;
    const newSettings = { ...localSettings, [key]: !localSettings[key] };
    setLocalSettings(newSettings);
    setSavingKey(key);
    try {
      await updateSettings(newSettings);
    } catch {
      setLocalSettings(prevSettings);
      Alert.alert("Error", "Failed to save setting. Please try again.");
    } finally {
      setSavingKey(null);
    }
  }, [localSettings, updateSettings]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const renderSection = (title: string, subtitle: string, items: SettingItem[]) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.sectionCard}>
        {items.map((item, idx) => (
          <View key={item.key}>
            {idx > 0 && <View style={styles.separator} />}
            <View style={styles.settingRow}>
              <View style={[styles.iconWrap, { backgroundColor: `${SUPER_ACCENT}14` }]}>
                <Feather name={item.icon} size={18} color={SUPER_ACCENT} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{item.label}</Text>
                <Text style={styles.settingDesc}>{item.desc}</Text>
              </View>
              {savingKey === item.key ? (
                <ActivityIndicator size="small" color={SUPER_ACCENT} style={styles.savingSpinner} />
              ) : (
                <Switch
                  value={localSettings[item.key]}
                  onValueChange={() => toggle(item.key)}
                  trackColor={{ false: Colors.border, true: `${SUPER_ACCENT}55` }}
                  thumbColor={localSettings[item.key] ? SUPER_ACCENT : "#ccc"}
                  ios_backgroundColor={Colors.border}
                />
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );

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
        <View style={styles.infoBox}>
          <Feather name="info" size={14} color={SUPER_ACCENT} />
          <Text style={styles.infoText}>
            Global defaults apply to all admins. Use "Per Admin Access" below to override for individual admins.
          </Text>
        </View>

        {renderSection(
          "Global Defaults — Navigation Tabs",
          "Default tab visibility for all admins (overridden per admin below)",
          TAB_SETTINGS
        )}

        {renderSection(
          "Global Defaults — Dashboard Cards",
          "Default card visibility for all admins (overridden per admin below)",
          CARD_SETTINGS
        )}

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

        {/* Role Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Role Access Overview</Text>
            <Text style={styles.sectionSubtitle}>
              What each user role can access in the app
            </Text>
          </View>
          {ROLE_DEFINITIONS.map((def) => (
            <RoleCard key={def.role} def={def} settings={localSettings} />
          ))}
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
