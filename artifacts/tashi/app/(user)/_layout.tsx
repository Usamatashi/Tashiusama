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


function SalesmanTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isHome = !pathname.includes("/orders") && !pathname.includes("/profile") && !pathname.includes("/history") && !pathname.includes("/scan") && !pathname.includes("/rewards") && !pathname.includes("/points") && !pathname.includes("/payments");
  const isPayments = pathname.includes("/payments");
  const isProfile = pathname.includes("/profile");
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 10 : 0);

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: bottomPad }]}>
      <TabItem icon="home" label="Home" active={isHome} onPress={() => router.push("/(user)/")} />
      <TabItem icon="credit-card" label="Payments" active={isPayments} onPress={() => router.push("/(user)/payments")} />
      <TabItem icon="user" label="Profile" active={isProfile} onPress={() => router.push("/(user)/profile")} />
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
      <TabItem icon="home" label="Home" active={isHome} onPress={() => router.push("/(user)/")} />
      <TabItem icon="credit-card" label="Account" active={isPayments} onPress={() => router.push("/(user)/payments")} />
      <TabItem icon="user" label="Profile" active={isProfile} onPress={() => router.push("/(user)/profile")} />
    </View>
  );
}

function DefaultTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isHistory = pathname.includes("/history");
  const isProfile = pathname.includes("/profile");
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 10 : 0);

  return (
    <View style={styles.navWrapper}>
      <OrderFAB icon="maximize" label="Scan QR" onPress={() => router.push("/(user)/scan")} />
      <View style={[styles.tabBarWrapper, { paddingBottom: bottomPad }]}>
        <TabItem icon="clock" label="History" active={isHistory} onPress={() => router.push("/(user)/history")} />
        <TabItem icon="user" label="Profile" active={isProfile} onPress={() => router.push("/(user)/profile")} />
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


  tabBarWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 6,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 18,
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
