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
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.iconBubble, active && styles.iconBubbleActive]}>
        <Feather name={icon} size={20} color={active ? "#fff" : "#AAAAAA"} />
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
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.fabBubble}>
        <Feather name={icon} size={22} color="#fff" />
      </View>
      <Text style={[styles.tabLabel, styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TabBar({ children, bottomPad }: { children: React.ReactNode; bottomPad: number }) {
  return (
    <View style={styles.tabBarOuter}>
      <View style={[styles.tabBarInner, { paddingBottom: bottomPad > 0 ? bottomPad : 10 }]}>
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
  container: { flex: 1, backgroundColor: "#F5F6FA" },

  tabBarOuter: {
    backgroundColor: "#F5F6FA",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  tabBarInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -2 },
    elevation: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },

  tabItem: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    paddingBottom: 4,
  },

  iconBubble: {
    width: 48,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconBubbleActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.38,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  fabBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOpacity: 0.42,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    marginTop: -20,
    borderWidth: 3,
    borderColor: "#fff",
  },

  tabLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#BBBBBB",
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontFamily: "Inter_700Bold",
  },
});
