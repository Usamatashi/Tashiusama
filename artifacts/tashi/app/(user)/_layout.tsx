import { Slot, Redirect, usePathname, router } from "expo-router";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

function SalesmanTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isHome = !pathname.includes("/orders") && !pathname.includes("/profile") && !pathname.includes("/history") && !pathname.includes("/scan") && !pathname.includes("/rewards") && !pathname.includes("/points") && !pathname.includes("/payments");
  const isPayments = pathname.includes("/payments");
  const isProfile = pathname.includes("/profile");
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 8 : 0);

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: bottomPad }]}>
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => router.push("/(user)/")}
        activeOpacity={0.7}
      >
        <View style={[styles.tabPill, isHome && styles.tabPillActive]}>
          <Feather name="home" size={16} color={isHome ? Colors.primary : Colors.textLight} style={{ marginBottom: 2 }} />
          <Text style={[styles.tabLabel, isHome && styles.tabLabelActive]}>Home</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => router.push("/(user)/payments")}
        activeOpacity={0.7}
      >
        <View style={[styles.tabPill, isPayments && styles.tabPillActive]}>
          <Feather name="credit-card" size={16} color={isPayments ? Colors.primary : Colors.textLight} style={{ marginBottom: 2 }} />
          <Text style={[styles.tabLabel, isPayments && styles.tabLabelActive]}>Payments</Text>
        </View>
      </TouchableOpacity>

      {/* Center new-order button */}
      <View style={styles.scanBtnWrapper}>
        <TouchableOpacity style={styles.scanBtn} onPress={() => router.push("/(user)/orders")} activeOpacity={0.88}>
          <Feather name="plus" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => router.push("/(user)/profile")}
        activeOpacity={0.7}
      >
        <View style={[styles.tabPill, isProfile && styles.tabPillActive]}>
          <Feather name="user" size={16} color={isProfile ? Colors.primary : Colors.textLight} style={{ marginBottom: 2 }} />
          <Text style={[styles.tabLabel, isProfile && styles.tabLabelActive]}>Profile</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function RetailerTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isHome = !pathname.includes("/orders") && !pathname.includes("/profile") && !pathname.includes("/payments");
  const isPayments = pathname.includes("/payments");
  const isProfile = pathname.includes("/profile");
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 8 : 0);

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: bottomPad }]}>
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => router.push("/(user)/")}
        activeOpacity={0.7}
      >
        <View style={[styles.tabPill, isHome && styles.tabPillActive]}>
          <Feather name="home" size={16} color={isHome ? Colors.primary : Colors.textLight} style={{ marginBottom: 2 }} />
          <Text style={[styles.tabLabel, isHome && styles.tabLabelActive]}>Home</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => router.push("/(user)/payments")}
        activeOpacity={0.7}
      >
        <View style={[styles.tabPill, isPayments && styles.tabPillActive]}>
          <Feather name="credit-card" size={16} color={isPayments ? Colors.primary : Colors.textLight} style={{ marginBottom: 2 }} />
          <Text style={[styles.tabLabel, isPayments && styles.tabLabelActive]}>Account</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.scanBtnWrapper}>
        <TouchableOpacity style={styles.scanBtn} onPress={() => router.push("/(user)/orders")} activeOpacity={0.88}>
          <Feather name="shopping-bag" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => router.push("/(user)/profile")}
        activeOpacity={0.7}
      >
        <View style={[styles.tabPill, isProfile && styles.tabPillActive]}>
          <Feather name="user" size={16} color={isProfile ? Colors.primary : Colors.textLight} style={{ marginBottom: 2 }} />
          <Text style={[styles.tabLabel, isProfile && styles.tabLabelActive]}>Profile</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function DefaultTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isHistory = pathname.includes("/history");
  const isProfile = pathname.includes("/profile");
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 8 : 0);

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: bottomPad }]}>
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => router.push("/(user)/history")}
        activeOpacity={0.7}
      >
        <View style={[styles.tabPill, isHistory && styles.tabPillActive]}>
          <Text style={[styles.tabLabel, isHistory && styles.tabLabelActive]}>History</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.scanBtnWrapper}>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => router.push("/(user)/scan")}
          activeOpacity={0.88}
        >
          <Text style={styles.scanBtnInner}>SCAN{"\n"}QR</Text>
        </TouchableOpacity>
      </View>

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
      {user.role === "salesman" ? <SalesmanTabBar /> : user.role === "retailer" ? <RetailerTabBar /> : <DefaultTabBar />}
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
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: "center",
  },
  tabPillActive: {
    backgroundColor: `${Colors.primary}15`,
  },
  tabLabel: {
    fontSize: 12,
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
