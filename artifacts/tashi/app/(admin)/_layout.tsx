import { Redirect, Tabs, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useCallback } from "react";
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

  const visibleTabItems = ALL_TAB_ITEMS.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (isSuperAdmin) return true;
    const settingKey = SETTINGS_KEY_MAP[item.name];
    return settingKey ? settings[settingKey] : true;
  });

  const visibleRoutes = state.routes.filter((r) =>
    visibleTabItems.some((t) => t.name === r.name)
  );

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom }]}>
      <View style={styles.tabBar}>
        {visibleRoutes.map((route) => {
          const tabItem = visibleTabItems.find((t) => t.name === route.name);
          if (!tabItem) return null;

          const isConfigTab = route.name === "super-config";
          const accent = isConfigTab ? SUPER_ACCENT : Colors.adminAccent;
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
  );
}

export default function AdminLayout() {
  const { user } = useAuth();
  const { settings, fetchSettings } = useAdminSettings();

  useFocusEffect(
    useCallback(() => {
      fetchSettings();
    }, [fetchSettings])
  );

  if (!user) return <Redirect href="/login" />;
  if (user.role !== "admin" && user.role !== "super_admin") return <Redirect href="/(user)" />;

  const isSuperAdmin = user.role === "super_admin";

  const isTabVisible = (name: string) => {
    if (isSuperAdmin) return true;
    const key = SETTINGS_KEY_MAP[name];
    return key ? settings[key] : true;
  };

  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ href: isTabVisible("index") ? undefined : null }} />
      <Tabs.Screen name="products" options={{ href: isTabVisible("products") ? undefined : null }} />
      <Tabs.Screen name="create-account" options={{ href: isTabVisible("create-account") ? undefined : null }} />
      <Tabs.Screen name="payments" options={{ href: isTabVisible("payments") ? undefined : null }} />
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
});
