import { Slot, Redirect, usePathname, router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

function CustomTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { user } = useAuth();

  const isHistory = pathname === "/(user)/history" || pathname === "/history";
  const isProfile = pathname === "/(user)/profile" || pathname === "/profile";

  const bottomPad = insets.bottom + (Platform.OS === "web" ? 8 : 0);

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: bottomPad }]}>
      {/* History tab */}
      <Pressable
        style={styles.tabItem}
        onPress={() => router.push("/(user)/history")}
        android_ripple={{ color: "transparent" }}
      >
        <View style={[styles.tabIconWrap, isHistory && styles.tabIconActive]}>
          <Feather name="clock" size={20} color={isHistory ? Colors.primary : Colors.textLight} />
        </View>
        <Text style={[styles.tabLabel, isHistory && styles.tabLabelActive]}>History</Text>
      </Pressable>

      {/* Center scan button */}
      <View style={styles.scanBtnWrapper}>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => router.push("/(user)/scan")}
          activeOpacity={0.88}
        >
          <Feather name="camera" size={28} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.scanBtnLabel}>Scan QR</Text>
      </View>

      {/* Profile tab */}
      <Pressable
        style={styles.tabItem}
        onPress={() => router.push("/(user)/profile")}
        android_ripple={{ color: "transparent" }}
      >
        <View style={[styles.tabIconWrap, isProfile && styles.tabIconActive]}>
          <Feather name="user" size={20} color={isProfile ? Colors.primary : Colors.textLight} />
        </View>
        <Text style={[styles.tabLabel, isProfile && styles.tabLabelActive]}>Profile</Text>
      </Pressable>
    </View>
  );
}

export default function UserLayout() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/login" />;
  if (user.role === "admin") return <Redirect href="/(admin)" />;

  return (
    <View style={styles.container}>
      <Slot />
      <CustomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F4F1" },

  tabBarWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },

  tabItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingBottom: 4,
  },
  tabIconWrap: {
    width: 44,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  tabIconActive: {
    backgroundColor: `${Colors.primary}14`,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textLight,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
  },

  scanBtnWrapper: {
    alignItems: "center",
    gap: 4,
    marginTop: -28,
    paddingBottom: 4,
    width: 90,
  },
  scanBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    borderWidth: 4,
    borderColor: Colors.white,
  },
  scanBtnLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
});
