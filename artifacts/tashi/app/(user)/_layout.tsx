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

type TabItemProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
};

function TabItem({ icon, label, active, onPress }: TabItemProps) {
  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.tabIconWrap}>
        <Feather name={icon} size={20} color={active ? Colors.primary : "#B0B0B0"} />
        {active && <View style={styles.activeDot} />}
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

type FABProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
};

function OrderFAB({ icon, label, onPress }: FABProps) {
  return (
    <TouchableOpacity style={styles.fab} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.fabInner}>
        <Feather name={icon} size={22} color={Colors.white} />
      </View>
      <Text style={styles.fabLabel}>{label}</Text>
    </TouchableOpacity>
  );
}


function SalesmanTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isHome = !pathname.includes("/orders") && !pathname.includes("/profile") && !pathname.includes("/history") && !pathname.includes("/scan") && !pathname.includes("/rewards") && !pathname.includes("/points") && !pathname.includes("/payments");
  const isPayments = pathname.includes("/payments");
  const isProfile = pathname.includes("/profile");
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 10 : 0);

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: bottomPad }]}>
      <TabItem icon="home" label="Home" active={isHome} onPress={() => router.replace("/(user)/")} />
      <TabItem icon="credit-card" label="Accounts" active={isPayments} onPress={() => router.replace("/(user)/payments")} />
      <TabItem icon="user" label="Profile" active={isProfile} onPress={() => router.replace("/(user)/profile")} />
    </View>
  );
}

function RetailerTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isHome = !pathname.includes("/orders") && !pathname.includes("/profile") && !pathname.includes("/payments");
  const isPayments = pathname.includes("/payments");
  const isProfile = pathname.includes("/profile");
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 10 : 0);

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: bottomPad }]}>
      <TabItem icon="home" label="Home" active={isHome} onPress={() => router.replace("/(user)/")} />
      <TabItem icon="credit-card" label="Account" active={isPayments} onPress={() => router.replace("/(user)/payments")} />
      <TabItem icon="user" label="Profile" active={isProfile} onPress={() => router.replace("/(user)/profile")} />
    </View>
  );
}

function DefaultTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isHome = !pathname.includes("/history") && !pathname.includes("/profile") && !pathname.includes("/scan") && !pathname.includes("/rewards") && !pathname.includes("/points");
  const isProfile = pathname.includes("/profile");
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 10 : 0);

  return (
    <View style={styles.navWrapper}>
      <View style={[styles.tabBarWrapper, { paddingBottom: bottomPad }]}>
        <TabItem icon="home" label="Home" active={isHome} onPress={() => router.replace("/(user)/")} />
        <OrderFAB icon="maximize" label="Scan QR" onPress={() => router.push("/(user)/scan")} />
        <TabItem icon="user" label="Profile" active={isProfile} onPress={() => router.replace("/(user)/profile")} />
      </View>
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
      {user.role === "salesman"
        ? <SalesmanTabBar />
        : user.role === "retailer"
        ? <RetailerTabBar />
        : <DefaultTabBar />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F4F1" },

  navWrapper: {
    alignItems: "center",
  },

  fab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 6,
  },
  fabInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    borderWidth: 3,
    borderColor: Colors.white,
    marginBottom: 2,
  },
  fabLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
    letterSpacing: 0.3,
  },


  tabBarWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 2.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopColor: Colors.primary,
    borderLeftColor: `${Colors.primary}30`,
    borderRightColor: `${Colors.primary}30`,
    paddingTop: 8,
    paddingHorizontal: 12,
    shadowColor: Colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },

  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  tabIconWrap: {
    alignItems: "center",
    marginBottom: 3,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginTop: 3,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#B0B0B0",
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontFamily: "Inter_700Bold",
  },
});
