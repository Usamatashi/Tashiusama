import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const ACTIONS = [
  {
    icon: "plus-square" as const,
    label: "Create QR Code",
    desc: "Generate and assign QR codes to vehicles",
    route: "/(admin)/create-qr" as const,
    gradient: ["#E87722", "#F5A54A"] as [string, string],
    decoration: "#F5A54A",
    countEndpoint: null as string | null,
    countLabel: null as string | null,
  },
  {
    icon: "gift" as const,
    label: "Claim Rewards",
    desc: "Review and approve reward claims",
    route: "/(admin)/claims" as const,
    gradient: ["#7B2FBE", "#A855F7"] as [string, string],
    decoration: "#A855F7",
    countEndpoint: null as string | null,
    countLabel: null as string | null,
  },
  {
    icon: "radio" as const,
    label: "Create Ads",
    desc: "Create and manage advertisements",
    route: "/(admin)/create-ads" as const,
    gradient: ["#0D9488", "#2DD4BF"] as [string, string],
    decoration: "#2DD4BF",
    countEndpoint: "/ads" as string | null,
    countLabel: "ads" as string | null,
  },
  {
    icon: "type" as const,
    label: "Create Text",
    desc: "Add scrolling ticker messages for users",
    route: "/(admin)/create-text" as const,
    gradient: ["#D97706", "#FBBF24"] as [string, string],
    decoration: "#FBBF24",
    countEndpoint: "/ticker" as string | null,
    countLabel: "texts" as string | null,
  },
];

export default function AdminDashboard() {
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(true);

  const fetchCounts = useCallback(async () => {
    try {
      const token = (await AsyncStorage.getItem("tashi_token")) || "";
      const headers = { Authorization: `Bearer ${token}` };
      const endpoints = ACTIONS.filter((a) => a.countEndpoint).map((a) => a.countEndpoint!);

      const results = await Promise.all(
        endpoints.map((ep) =>
          fetch(`${BASE}${ep}`, { headers })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => [])
        )
      );

      const newCounts: Record<string, number> = {};
      endpoints.forEach((ep, i) => {
        newCounts[ep] = Array.isArray(results[i]) ? results[i].length : 0;
      });
      setCounts(newCounts);
    } catch {
      // ignore
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) },
      ]}
    >
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/tashi-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <TouchableOpacity onPress={logout} style={styles.headerBtn}>
          <Feather name="log-out" size={16} color={Colors.adminAccent} />
          <Text style={styles.headerBtnText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.greeting}>Welcome back 👋</Text>
        <Text style={styles.subtitle}>What would you like to do today?</Text>

        <View style={styles.cards}>
          {ACTIONS.map((action) => {
            const hasCount = action.countEndpoint !== null;
            const count = hasCount ? (counts[action.countEndpoint!] ?? 0) : null;

            return (
              <TouchableOpacity
                key={action.label}
                onPress={() => router.push(action.route)}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={action.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.card}
                >
                  <View
                    style={[styles.decCircleLarge, { backgroundColor: action.decoration }]}
                  />
                  <View
                    style={[styles.decCircleSmall, { backgroundColor: action.decoration }]}
                  />

                  <View style={styles.cardContent}>
                    <View style={styles.iconWrap}>
                      <Feather name={action.icon} size={26} color="#fff" />
                    </View>

                    <View style={styles.textWrap}>
                      <Text style={styles.cardTitle}>{action.label}</Text>
                      <Text style={styles.cardDesc}>{action.desc}</Text>
                    </View>

                    {hasCount ? (
                      <View style={styles.countBadge}>
                        {loadingCounts ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Text style={styles.countNumber}>{count}</Text>
                            <Text style={styles.countLabel}>{action.countLabel}</Text>
                          </>
                        )}
                      </View>
                    ) : (
                      <View style={styles.arrow}>
                        <Feather name="arrow-right" size={18} color="rgba(255,255,255,0.8)" />
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  logo: {
    width: 130,
    height: 56,
  },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(232,119,34,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(232,119,34,0.25)",
  },
  headerBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.adminAccent,
  },
  scroll: {
    padding: 20,
    paddingBottom: 48,
  },
  greeting: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.adminText,
    marginBottom: 4,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 28,
  },
  cards: {
    gap: 16,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  decCircleLarge: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    top: -40,
    right: -30,
    opacity: 0.3,
  },
  decCircleSmall: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    bottom: -30,
    right: 60,
    opacity: 0.2,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  textWrap: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
  },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  countBadge: {
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  countNumber: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    lineHeight: 26,
  },
  countLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
