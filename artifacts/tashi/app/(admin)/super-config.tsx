import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminSettings, type AdminSettings } from "@/context/AdminSettingsContext";
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
            Changes take effect immediately. Only Super Admins can access this screen.
          </Text>
        </View>

        {renderSection(
          "Navigation Tabs",
          "Control which tabs appear in the admin bottom bar",
          TAB_SETTINGS
        )}

        {renderSection(
          "Dashboard Cards",
          "Control which quick-action cards are shown on the admin dashboard",
          CARD_SETTINGS
        )}
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
