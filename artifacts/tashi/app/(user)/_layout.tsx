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
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.tabPill, active && styles.tabPillActive]}>
        <Feather name={icon} size={19} color={active ? "#fff" : "#ABABAB"} />
        {active && (
          <Text style={styles.tabPillLabel}>{label}</Text>
        )}
      </View>
      {!active && (
        <Text style={styles.tabLabel}>{label}</Text>
      )}
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
    <TouchableOpacity style={styles.fabWrap} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.fabInner}>
        <Feather name={icon} size={22} color="#fff" />
      </View>
      <Text style={styles.fabLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function TabBar({ children, bottomPad }: { children: React.ReactNode; bottomPad: number }) {
  return (
    <View style={[styles.tabBarOuter, { paddingBottom: bottomPad }]}>
      <View style={styles.tabBarInner}>
        {children}
      </View>
    </View>
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
    <TabBar bottomPad={bottomPad}>
      <TabItem icon="home" label="Home" active={isHome} onPress={() => router.replace("/(user)/")} />
      <TabItem icon="credit-card" label="Accounts" active={isPayments} onPress={() => router.replace("/(user)/payments")} />
      <TabItem icon="user" label="Profile" active={isProfile} onPress={() => router.replace("/(user)/profile")} />
    </TabBar>
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
    <TabBar bottomPad={bottomPad}>
      <TabItem icon="home" label="Home" active={isHome} onPress={() => router.replace("/(user)/")} />
      <TabItem icon="credit-card" label="Account" active={isPayments} onPress={() => router.replace("/(user)/payments")} />
      <TabItem icon="user" label="Profile" active={isProfile} onPress={() => router.replace("/(user)/profile")} />
    </TabBar>
  );
}

function DefaultTabBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isHome = !pathname.includes("/history") && !pathname.includes("/profile") && !pathname.includes("/scan") && !pathname.includes("/rewards") && !pathname.includes("/points");
  const isProfile = pathname.includes("/profile");
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 10 : 0);

  return (
    <TabBar bottomPad={bottomPad}>
      <TabItem icon="home" label="Home" active={isHome} onPress={() => router.replace("/(user)/")} />
      <OrderFAB icon="maximize" label="Scan QR" onPress={() => router.push("/(user)/scan")} />
      <TabItem icon="user" label="Profile" active={isProfile} onPress={() => router.replace("/(user)/profile")} />
    </TabBar>
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

  tabBarOuter: {
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tabBarInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 36,
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
  },

  tabItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 24,
  },
  tabPillActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  tabPillLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.2,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#777",
    letterSpacing: 0.2,
  },

  fabWrap: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
  },
  fabInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  fabLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
    letterSpacing: 0.3,
  },
});
