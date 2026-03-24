import { Drawer } from "expo-router/drawer";
import { Redirect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DrawerContentScrollView, DrawerItemList, type DrawerContentComponentProps } from "@react-navigation/drawer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.drawerContainer, { paddingTop: insets.top }]}>
      <View style={styles.drawerHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.email?.[0]?.toUpperCase() || "U"}</Text>
        </View>
        <Text style={styles.drawerEmail}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>
      <TouchableOpacity style={[styles.logoutBtn, { marginBottom: insets.bottom + 16 }]} onPress={logout}>
        <Feather name="log-out" size={20} color={Colors.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function UserLayout() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/login" />;
  if (user.role === "admin") return <Redirect href="/(admin)" />;

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: Colors.primary,
        drawerInactiveTintColor: Colors.textSecondary,
        drawerLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 15 },
        drawerStyle: { backgroundColor: Colors.white, width: 280 },
      }}
    >
      <Drawer.Screen name="index" options={{ title: "Home", drawerIcon: ({ color }) => <Feather name="home" size={20} color={color} /> }} />
      <Drawer.Screen name="profile" options={{ title: "Profile", drawerIcon: ({ color }) => <Feather name="user" size={20} color={color} /> }} />
      <Drawer.Screen name="points" options={{ title: "My Points", drawerIcon: ({ color }) => <Feather name="star" size={20} color={color} /> }} />
      <Drawer.Screen name="history" options={{ title: "Scan History", drawerIcon: ({ color }) => <Feather name="clock" size={20} color={color} /> }} />
      <Drawer.Screen name="rewards" options={{ title: "Rewards", drawerIcon: ({ color }) => <Feather name="gift" size={20} color={color} /> }} />
      <Drawer.Screen name="scan" options={{ title: "Scan QR", drawerItemStyle: { display: "none" } }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawerContainer: { flex: 1, backgroundColor: Colors.white },
  drawerHeader: {
    padding: 20,
    paddingBottom: 24,
    backgroundColor: Colors.primary,
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  avatarText: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.white },
  drawerEmail: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.9)", textAlign: "center" },
  roleBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.white },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  logoutText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.error },
});
