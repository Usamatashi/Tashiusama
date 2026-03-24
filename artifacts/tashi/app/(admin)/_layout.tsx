import { Redirect } from "expo-router";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

export default function AdminLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  if (!user) return <Redirect href="/login" />;
  if (user.role !== "admin") return <Redirect href="/(user)" />;

  const tabBarHeight = Platform.OS === "web" ? 84 : 56 + insets.bottom;
  const tabBarPaddingBottom = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.adminAccent,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create-qr"
        options={{
          title: "Create QR",
          tabBarIcon: ({ color }) => <Feather name="plus-square" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{
          title: "Vehicles",
          tabBarIcon: ({ color }) => <Feather name="truck" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create-account"
        options={{
          title: "Add User",
          tabBarIcon: ({ color }) => <Feather name="user-plus" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
