import { Slot, Redirect, usePathname, router } from "expo-router";
import {
  Platform,
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

  const isHistory = pathname.includes("/history");
  const isProfile = pathname.includes("/profile");

  const bottomPad = insets.bottom + (Platform.OS === "web" ? 8 : 0);

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: bottomPad }]}>
      {/* History tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => router.push("/(user)/history")}
        activeOpacity={0.7}
      >
        <View style={[styles.tabPill, isHistory && styles.tabPillActive]}>
          <Text style={[styles.tabLabel, isHistory && styles.tabLabelActive]}>History</Text>
        </View>
      </TouchableOpacity>

      {/* Center scan button */}
      <View style={styles.scanBtnWrapper}>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => router.push("/(user)/scan")}
          activeOpacity={0.88}
        >
          <Text style={styles.scanBtnInner}>SCAN{"\n"}QR</Text>
        </TouchableOpacity>
      </View>

      {/* Profile tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => router.push("/(user)/profile")}
        activeOpacity={0.7}
      >
        <View style={[styles.tabPill, isProfile && styles.tabPillActive]}>
          <Text style={[styles.tabLabel, isProfile && styles.tabLabelActive]}>Profile</Text>
        </View>
      </TouchableOpacity>
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
    paddingTop: 10,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },

  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 4,
  },
  tabPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabPillActive: {
    backgroundColor: `${Colors.primary}15`,
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textLight,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontFamily: "Inter_700Bold",
  },

  scanBtnWrapper: {
    alignItems: "center",
    marginTop: -30,
    paddingBottom: 4,
    width: 90,
  },
  scanBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
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
  scanBtnInner: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
    textAlign: "center",
    lineHeight: 14,
  },
});
