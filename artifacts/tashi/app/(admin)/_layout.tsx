import { Redirect } from "expo-router";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const TAB_ITEMS = [
  { name: "index", label: "Dashboard", icon: "grid" as const },
  { name: "vehicles", label: "Vehicles", icon: "truck" as const },
  { name: "create-account", label: "Users", icon: "users" as const },
  { name: "payments", label: "Payments", icon: "dollar-sign" as const },
];

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const paddingBottom = Platform.OS === "web" ? 34 : insets.bottom;

  const visibleRoutes = state.routes.filter((r) =>
    TAB_ITEMS.some((t) => t.name === r.name)
  );

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom }]}>
      <View style={styles.tabBar}>
        {visibleRoutes.map((route) => {
          const tabItem = TAB_ITEMS.find((t) => t.name === route.name);
          if (!tabItem) return null;

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
              <View style={[styles.tabPill, isFocused && styles.tabPillActive]}>
                <Feather
                  name={tabItem.icon}
                  size={20}
                  color={isFocused ? Colors.white : Colors.textLight}
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isFocused && styles.tabLabelActive,
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

  if (!user) return <Redirect href="/login" />;
  if (user.role !== "admin") return <Redirect href="/(user)" />;

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="vehicles" />
      <Tabs.Screen name="create-account" />
      <Tabs.Screen name="payments" />
      <Tabs.Screen name="create-qr" options={{ href: null }} />
      <Tabs.Screen name="claims" options={{ href: null }} />
      <Tabs.Screen name="create-ads" options={{ href: null }} />
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
    backgroundColor: Colors.adminAccent,
    shadowColor: Colors.adminAccent,
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
  tabLabelActive: {
    color: Colors.adminAccent,
    fontFamily: "Inter_600SemiBold",
  },
});
