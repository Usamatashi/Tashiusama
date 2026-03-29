import { Redirect, Tabs, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useCallback, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAdminSettings } from "@/context/AdminSettingsContext";
import { Colors } from "@/constants/colors";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const SUPER_ACCENT = "#7B2FBE";

type TabItem = {
  name: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  superAdminOnly?: boolean;
};

const ALL_TAB_ITEMS: TabItem[] = [
  { name: "index", label: "Dashboard", icon: "grid" },
  { name: "products", label: "Products", icon: "truck" },
  { name: "create-account", label: "Users", icon: "users" },
  { name: "payments", label: "Payments", icon: "dollar-sign" },
];

export const SETTINGS_KEY_MAP: Record<string, keyof ReturnType<typeof useAdminSettings>["settings"]> = {
  index: "tab_dashboard",
  products: "tab_products",
  "create-account": "tab_users",
  payments: "tab_payments",
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const paddingBottom = Platform.OS === "web" ? 34 : insets.bottom;

  const { user } = useAuth();
  const { settings } = useAdminSettings();
  const isSuperAdmin = user?.role === "super_admin";

  const [restrictedModalVisible, setRestrictedModalVisible] = useState(false);

  const isTabRestricted = (name: string): boolean => {
    if (isSuperAdmin) return false;
    const settingKey = SETTINGS_KEY_MAP[name];
    if (!settingKey) return false;
    return !settings[settingKey];
  };

  const visibleRoutes = state.routes.filter((r) =>
    ALL_TAB_ITEMS.some((t) => t.name === r.name)
  );

  return (
    <>
      <View style={[styles.tabBarWrapper, { paddingBottom }]}>
        <View style={styles.tabBar}>
          {visibleRoutes.map((route) => {
            const tabItem = ALL_TAB_ITEMS.find((t) => t.name === route.name);
            if (!tabItem) return null;

            const restricted = isTabRestricted(route.name);
            const isConfigTab = route.name === "super-config";
            const accent = isConfigTab ? SUPER_ACCENT : Colors.adminAccent;
            const isFocused = state.index === state.routes.indexOf(route);

            const onPress = () => {
              if (restricted) {
                setRestrictedModalVisible(true);
                return;
              }
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.85}
                style={styles.tabItem}
              >
                <View
                  style={[
                    styles.tabPill,
                    isFocused && {
                      ...styles.tabPillActive,
                      backgroundColor: accent,
                      shadowColor: accent,
                    },
                  ]}
                >
                  <Feather
                    name={tabItem.icon}
                    size={20}
                    color={isFocused ? Colors.white : Colors.textLight}
                  />
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    isFocused && { color: accent, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {tabItem.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Modal
        visible={restrictedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRestrictedModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setRestrictedModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <View style={styles.modalIconWrap}>
                  <Feather name="lock" size={28} color="#E87722" />
                </View>
                <Text style={styles.modalTitle}>Access Restricted</Text>
                <Text style={styles.modalMessage}>
                  Please contact Super Admin.
                </Text>
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => setRestrictedModalVisible(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalBtnText}>OK</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

export default function AdminLayout() {
  const { user } = useAuth();
  const { fetchSettings } = useAdminSettings();

  useFocusEffect(
    useCallback(() => {
      fetchSettings();
    }, [fetchSettings])
  );

  if (!user) return <Redirect href="/login" />;
  if (user.role !== "admin" && user.role !== "super_admin") return <Redirect href="/(user)" />;

  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="products" />
      <Tabs.Screen name="create-account" />
      <Tabs.Screen name="payments" />
      <Tabs.Screen name="super-config" options={{ href: null }} />
      <Tabs.Screen name="create-qr" options={{ href: null }} />
      <Tabs.Screen name="claims" options={{ href: null }} />
      <Tabs.Screen name="create-ads" options={{ href: null }} />
      <Tabs.Screen name="create-text" options={{ href: null }} />
      <Tabs.Screen name="orders" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    gap: 5,
  },
  tabPill: {
    width: 48,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  tabPillActive: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(232,119,34,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#1A1A2E",
    marginBottom: 8,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#666",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 22,
  },
  modalBtn: {
    backgroundColor: Colors.adminAccent,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 48,
    width: "100%",
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
