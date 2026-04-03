import { Redirect, Tabs, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAdminSettings, type AdminSettings } from "@/context/AdminSettingsContext";
import { Colors } from "@/constants/colors";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const SUPER_ACCENT = "#7B2FBE";

type TabItem = {
  name: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  customIconText?: string;
};

const ALL_TAB_ITEMS: TabItem[] = [
  { name: "index", label: "Dashboard", icon: "grid" },
  { name: "products", label: "Products", icon: "truck" },
  { name: "create-account", label: "Users", icon: "users" },
  { name: "payments", label: "Payments", icon: "dollar-sign", customIconText: "Rs" },
];

export const SETTINGS_KEY_MAP: Record<string, keyof AdminSettings> = {
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

  const visibleRoutes = state.routes.filter((r) => {
    if (!ALL_TAB_ITEMS.some((t) => t.name === r.name)) return false;
    if (!isSuperAdmin) {
      const settingKey = SETTINGS_KEY_MAP[r.name];
      if (settingKey && !settings[settingKey]) return false;
    }
    return true;
  });

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom }]}>
      <View style={styles.tabBar}>
        {visibleRoutes.map((route) => {
          const tabItem = ALL_TAB_ITEMS.find((t) => t.name === route.name);
          if (!tabItem) return null;

          const accent = Colors.adminAccent;
          const isFocused = state.index === state.routes.indexOf(route);

          const onPress = () => {
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
                {tabItem.customIconText ? (
                  <Text style={[styles.customIconText, { color: isFocused ? Colors.white : Colors.textLight }]}>
                    {tabItem.customIconText}
                  </Text>
                ) : (
                  <Feather
                    name={tabItem.icon}
                    size={20}
                    color={isFocused ? Colors.white : Colors.textLight}
                  />
                )}
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
  );
}

export default function AdminLayout() {
  const { user } = useAuth();
  const { fetchSettings, settingsLoaded, settings } = useAdminSettings();
  const isSuperAdmin = user?.role === "super_admin";

  useFocusEffect(
    useCallback(() => {
      fetchSettings();
    }, [fetchSettings])
  );

  if (!user) return <Redirect href="/login" />;
  if (user.role !== "admin" && user.role !== "super_admin") return <Redirect href="/(user)" />;

  if (!settingsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.adminAccent} />
      </View>
    );
  }

  const tabHref = (key: keyof AdminSettings): null | undefined =>
    isSuperAdmin || settings[key] ? undefined : null;

  // Force Tabs to fully re-mount when permissions change so Expo Router
  // re-registers routes. Without this, href:null changes are ignored on
  // an already-mounted navigator.
  const tabsKey = isSuperAdmin
    ? "super"
    : `${+settings.tab_dashboard}${+settings.tab_products}${+settings.tab_users}${+settings.tab_payments}`;

  return (
    <Tabs key={tabsKey} tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ href: tabHref("tab_dashboard") }} />
      <Tabs.Screen name="products" options={{ href: tabHref("tab_products") }} />
      <Tabs.Screen name="create-account" options={{ href: tabHref("tab_users") }} />
      <Tabs.Screen name="payments" options={{ href: tabHref("tab_payments") }} />
      <Tabs.Screen name="super-config" options={{ href: null }} />
      <Tabs.Screen name="create-qr" options={{ href: null }} />
      <Tabs.Screen name="claims" options={{ href: null }} />
      <Tabs.Screen name="create-ads" options={{ href: null }} />
      <Tabs.Screen name="create-text" options={{ href: null }} />
      <Tabs.Screen name="orders" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="commission" options={{ href: null }} />
      <Tabs.Screen name="salesman-detail" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
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
  customIconText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});
