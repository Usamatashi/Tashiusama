import { Drawer } from "expo-router/drawer";
import { Redirect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DrawerContentScrollView, DrawerItemList, type DrawerContentComponentProps } from "@react-navigation/drawer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

const ROLE_COLORS: Record<string, string> = {
  admin: "#8B5CF6",
  salesman: "#3B82F6",
  mechanic: "#F59E0B",
  retailer: Colors.primary,
};

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const roleColor = ROLE_COLORS[user?.role || ""] || Colors.primary;
  const initial = user?.email?.[0]?.toUpperCase() || "U";
  const roleLabel = (user?.role || "").charAt(0).toUpperCase() + (user?.role || "").slice(1);

  return (
    <View style={[styles.drawerContainer, { paddingTop: insets.top }]}>
      <View style={styles.drawerHeader}>
        <View style={styles.drawerHeaderBg} />
        <View style={[styles.avatarOuter, { borderColor: `${roleColor}60` }]}>
          <View style={[styles.avatarInner, { backgroundColor: roleColor }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        </View>
        <Text style={styles.drawerEmail} numberOfLines={1}>{user?.email}</Text>
        <View style={[styles.roleBadge, { backgroundColor: `${roleColor}22` }]}>
          <View style={[styles.roleDot, { backgroundColor: roleColor }]} />
          <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
        </View>
        <View style={styles.pointsRow}>
          <Feather name="star" size={13} color={Colors.primary} />
          <Text style={styles.pointsText}>{user?.points ?? 0} points</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerItems}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <View style={styles.drawerFooter}>
        <TouchableOpacity style={[styles.logoutBtn, { marginBottom: insets.bottom + 8 }]} onPress={logout} activeOpacity={0.8}>
          <View style={styles.logoutIcon}>
            <Feather name="log-out" size={16} color={Colors.error} />
          </View>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
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
        drawerLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 15, marginLeft: -8 },
        drawerStyle: { backgroundColor: Colors.white, width: 285 },
        drawerItemStyle: { borderRadius: 12, marginHorizontal: 8 },
      }}
    >
      <Drawer.Screen name="index" options={{ title: "Home", drawerIcon: ({ color, size }) => <Feather name="home" size={size} color={color} /> }} />
      <Drawer.Screen name="profile" options={{ title: "Profile", drawerIcon: ({ color, size }) => <Feather name="user" size={size} color={color} /> }} />
      <Drawer.Screen name="points" options={{ title: "My Points", drawerIcon: ({ color, size }) => <Feather name="star" size={size} color={color} /> }} />
      <Drawer.Screen name="history" options={{ title: "Scan History", drawerIcon: ({ color, size }) => <Feather name="clock" size={size} color={color} /> }} />
      <Drawer.Screen name="rewards" options={{ title: "Rewards", drawerIcon: ({ color, size }) => <Feather name="gift" size={size} color={color} /> }} />
      <Drawer.Screen name="scan" options={{ title: "Scan QR", drawerItemStyle: { display: "none" } }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawerContainer: { flex: 1, backgroundColor: Colors.white },
  drawerHeader: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
    alignItems: "center", gap: 8, position: "relative",
  },
  drawerHeaderBg: {
    position: "absolute", top: 0, left: 0, right: 0, height: 120,
    backgroundColor: "#FFF8F4",
  },
  avatarOuter: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 3, justifyContent: "center", alignItems: "center",
    backgroundColor: Colors.white, marginBottom: 2,
  },
  avatarInner: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.white },
  drawerEmail: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary, maxWidth: 220 },
  roleBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  roleText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  pointsRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: `${Colors.primary}12`, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  pointsText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary },

  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 20 },
  drawerItems: { paddingTop: 8 },

  drawerFooter: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 16, paddingTop: 8,
  },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12,
  },
  logoutIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: `${Colors.error}12`,
    justifyContent: "center", alignItems: "center",
  },
  logoutText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.error },
});
