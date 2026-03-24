import React from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

const ACTIONS = [
  {
    icon: "plus-square" as const,
    label: "Create QR Code",
    desc: "Generate and assign QR codes",
    route: "/(admin)/create-qr" as const,
  },
  {
    icon: "gift" as const,
    label: "Claim Rewards",
    desc: "Review and approve reward claims",
    route: "/(admin)/claims" as const,
  },
  {
    icon: "radio" as const,
    label: "Create Ads",
    desc: "Create and manage advertisements",
    route: "/(admin)/create-qr" as const,
  },
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/tashi-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <TouchableOpacity onPress={logout} style={styles.headerBtn}>
          <Feather name="log-out" size={22} color={Colors.adminAccent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.greeting}>Admin Dashboard</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.cards}>
          {ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.card}
              onPress={() => router.push(action.route)}
              activeOpacity={0.8}
            >
              <View style={styles.iconBox}>
                <Feather name={action.icon} size={28} color={Colors.adminAccent} />
              </View>
              <Text style={styles.cardTitle}>{action.label}</Text>
              <Text style={styles.cardDesc}>{action.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.adminBg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  logo: {
    width: 100,
    height: 50,
  },
  headerBtn: {
    padding: 8,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  greeting: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.adminText,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#888",
    marginBottom: 32,
  },
  cards: {
    gap: 16,
  },
  card: {
    backgroundColor: Colors.adminCard,
    borderRadius: 16,
    padding: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "rgba(232,119,34,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.adminText,
  },
  cardDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#888",
  },
});
