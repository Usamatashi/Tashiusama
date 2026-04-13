import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { useAdminSettings, type AdminSettings } from "@/context/AdminSettingsContext";
import { Colors } from "@/constants/colors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const ACTIONS = [
  {
    icon: "plus-square" as const,
    label: "Create QR Code",
    desc: "Generate and assign QR codes to products",
    route: "/(admin)/create-qr" as const,
    gradient: ["#E87722", "#F5A54A"] as [string, string],
    decoration: "#F5A54A",
    countEndpoint: "/qrcodes" as string | null,
    countLabel: "QR codes" as string | null,
    showPendingDot: false,
    showOrdersPending: false,
    superAdminOnly: false,
  },
  {
    icon: "clipboard" as const,
    label: "Orders",
    desc: "Review and manage sales orders",
    route: "/(admin)/orders" as const,
    gradient: ["#2563EB", "#60A5FA"] as [string, string],
    decoration: "#60A5FA",
    countEndpoint: null as string | null,
    countLabel: null as string | null,
    showPendingDot: false,
    showOrdersPending: true,
    superAdminOnly: false,
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
    showPendingDot: true,
    showOrdersPending: false,
    superAdminOnly: false,
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
    showPendingDot: false,
    showOrdersPending: false,
    superAdminOnly: false,
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
    showPendingDot: false,
    showOrdersPending: false,
    superAdminOnly: false,
  },
  {
    icon: "dollar-sign" as const,
    label: "Payments",
    desc: "Track retailer balances and cash collections",
    route: "/(admin)/payments" as const,
    gradient: ["#047857", "#10B981"] as [string, string],
    decoration: "#10B981",
    countEndpoint: null as string | null,
    countLabel: null as string | null,
    showPendingDot: false,
    showOrdersPending: false,
    superAdminOnly: false,
  },
  {
    icon: "percent" as const,
    label: "Commission",
    desc: "Track salesman commission on sales",
    route: "/(admin)/commission" as const,
    gradient: ["#C0392B", "#E57373"] as [string, string],
    decoration: "#E57373",
    countEndpoint: null as string | null,
    countLabel: null as string | null,
    showPendingDot: false,
    showOrdersPending: false,
    superAdminOnly: false,
  },
  {
    icon: "message-circle" as const,
    label: "WhatsApp",
    desc: "Manage WhatsApp numbers per account type",
    route: "/(admin)/whatsapp-contacts" as const,
    gradient: ["#075E54", "#25D366"] as [string, string],
    decoration: "#25D366",
    countEndpoint: null as string | null,
    countLabel: null as string | null,
    showPendingDot: false,
    showOrdersPending: false,
    superAdminOnly: true,
  },
  {
    icon: "sliders" as const,
    label: "Config",
    desc: "Manage admin access and app settings",
    route: "/(admin)/super-config" as const,
    gradient: ["#4B0082", "#7B2FBE"] as [string, string],
    decoration: "#9B59B6",
    countEndpoint: null as string | null,
    countLabel: null as string | null,
    showPendingDot: false,
    showOrdersPending: false,
    superAdminOnly: true,
  },
];

const CARD_KEY_MAP: Record<string, keyof AdminSettings> = {
  "Create QR Code": "card_create_qr",
  "Orders": "card_orders",
  "Claim Rewards": "card_claims",
  "Create Ads": "card_create_ads",
  "Create Text": "card_create_text",
  "Payments": "card_payments",
  "Commission": "card_commission",
};

export default function AdminDashboard() {
  const { logout, user, changePassword } = useAuth();
  const { settings, fetchSettings } = useAdminSettings();
  const insets = useSafeAreaInsets();
  const isSuperAdmin = user?.role === "super_admin";
  const visibleActions = ACTIONS.filter((a) => {
    if (isSuperAdmin) return true;
    if (a.superAdminOnly) return false;
    const key = CARD_KEY_MAP[a.label];
    return key ? settings[key] : true;
  });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pendingClaims, setPendingClaims] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState<number | null>(null);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const closeChangePw = () => {
    setShowChangePw(false);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setShowCurrentPw(false); setShowNewPw(false); setShowConfirmPw(false);
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    if (newPw.length < 6) {
      Alert.alert("Too short", "New password must be at least 6 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert("Mismatch", "New passwords do not match.");
      return;
    }
    setChangingPw(true);
    try {
      await changePassword(currentPw, newPw);
      closeChangePw();
      Alert.alert("Success", "Your password has been updated.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to change password.");
    } finally {
      setChangingPw(false);
    }
  };

  const fetchCounts = useCallback(async () => {
    try {
      const token = (await AsyncStorage.getItem("tashi_token")) || "";
      const headers = { Authorization: `Bearer ${token}` };
      const endpoints = ACTIONS.filter((a) => a.countEndpoint).map((a) => a.countEndpoint!);

      const [claimsRes, ordersRes, balancesRes, pendingPayRes, ...countResults] = await Promise.all([
        fetch(`${BASE}/claims`, { headers })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch(`${BASE}/orders`, { headers })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch(`${BASE}/payments/retailer-balances`, { headers })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch(`${BASE}/payments/pending-count`, { headers })
          .then((r) => (r.ok ? r.json() : { count: 0 }))
          .catch(() => ({ count: 0 })),
        ...endpoints.map((ep) =>
          fetch(`${BASE}${ep}`, { headers })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => [])
        ),
      ]);

      const pending = Array.isArray(claimsRes)
        ? claimsRes.filter((c: { status: string }) => c.status === "pending").length
        : 0;
      setPendingClaims(pending);

      const pendingOrd = Array.isArray(ordersRes)
        ? ordersRes.filter((o: { status: string }) => o.status === "pending").length
        : 0;
      setPendingOrders(pendingOrd);

      if (Array.isArray(balancesRes)) {
        const outstanding = balancesRes.reduce((s: number, b: { outstanding: number }) => s + Math.max(0, b.outstanding), 0);
        setTotalOutstanding(outstanding);
      }

      setPendingPayments(pendingPayRes?.count ?? 0);

      const newCounts: Record<string, number> = {};
      endpoints.forEach((ep, i) => {
        newCounts[ep] = Array.isArray(countResults[i]) ? countResults[i].length : 0;
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchCounts(), fetchSettings()]);
    setRefreshing(false);
  }, [fetchCounts, fetchSettings]);

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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity onPress={() => setShowChangePw(true)} style={styles.iconBtn}>
            <Feather name="lock" size={18} color={Colors.adminAccent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.headerBtn}>
            <Feather name="log-out" size={16} color={Colors.adminAccent} />
            <Text style={styles.headerBtnText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.adminAccent} />
        }
      >
        <Text style={styles.greeting}>Welcome back 👋</Text>
        <Text style={styles.subtitle}>What would you like to do today?</Text>

        <View style={styles.cards}>
          {visibleActions.map((action) => {
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
                      {action.label === "Payments" ? (
                        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                          {loadingCounts ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <View style={styles.outstandingBadge}>
                                <Text style={styles.outstandingLabel}>Due</Text>
                                <Text style={styles.outstandingAmount}>
                                  Rs.{totalOutstanding !== null ? totalOutstanding.toLocaleString() : "—"}
                                </Text>
                              </View>
                              {pendingPayments > 0 && (
                                <View style={styles.pendingPayBadge}>
                                  <Text style={styles.pendingPayText}>{pendingPayments} to verify</Text>
                                </View>
                              )}
                            </>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.cardDesc}>{action.desc}</Text>
                      )}
                    </View>

                    {hasCount ? (
                      <View style={styles.countBadge}>
                        {loadingCounts ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.countNumber}>{fmtCount(count ?? 0)}</Text>
                        )}
                      </View>
                    ) : (
                      <View>
                        <View style={styles.arrow}>
                          <Feather name="arrow-right" size={18} color="rgba(255,255,255,0.8)" />
                        </View>
                        {action.showPendingDot && !loadingCounts && pendingClaims > 0 && (
                          <View style={styles.pendingDot} />
                        )}
                        {action.showOrdersPending && !loadingCounts && pendingOrders > 0 && (
                          <View style={styles.pendingDot} />
                        )}
                      </View>
                    )}
                  </View>

                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={showChangePw} transparent animationType="slide" onRequestClose={closeChangePw}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeChangePw} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Change Password</Text>
            <Text style={styles.modalSubtitle}>Enter your current password then choose a new one</Text>

            {/* Current Password */}
            <View style={styles.pwFieldWrap}>
              <Text style={styles.pwFieldLabel}>Current Password</Text>
              <View style={styles.pwInputRow}>
                <TextInput style={styles.pwInput} value={currentPw} onChangeText={setCurrentPw}
                  secureTextEntry={!showCurrentPw} placeholder="••••••••" placeholderTextColor={Colors.textSecondary} autoCapitalize="none" />
                <TouchableOpacity onPress={() => setShowCurrentPw((v) => !v)} style={styles.pwEyeBtn}>
                  <Feather name={showCurrentPw ? "eye-off" : "eye"} size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* New Password */}
            <View style={styles.pwFieldWrap}>
              <Text style={styles.pwFieldLabel}>New Password</Text>
              <View style={styles.pwInputRow}>
                <TextInput style={styles.pwInput} value={newPw} onChangeText={setNewPw}
                  secureTextEntry={!showNewPw} placeholder="••••••••" placeholderTextColor={Colors.textSecondary} autoCapitalize="none" />
                <TouchableOpacity onPress={() => setShowNewPw((v) => !v)} style={styles.pwEyeBtn}>
                  <Feather name={showNewPw ? "eye-off" : "eye"} size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm New Password */}
            <View style={styles.pwFieldWrap}>
              <Text style={styles.pwFieldLabel}>Confirm New Password</Text>
              <View style={styles.pwInputRow}>
                <TextInput style={styles.pwInput} value={confirmPw} onChangeText={setConfirmPw}
                  secureTextEntry={!showConfirmPw} placeholder="••••••••" placeholderTextColor={Colors.textSecondary} autoCapitalize="none" />
                <TouchableOpacity onPress={() => setShowConfirmPw((v) => !v)} style={styles.pwEyeBtn}>
                  <Feather name={showConfirmPw ? "eye-off" : "eye"} size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={[styles.submitBtn, changingPw && { opacity: 0.7 }]}
              onPress={handleChangePassword} disabled={changingPw} activeOpacity={0.82}>
              {changingPw ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Update Password</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={closeChangePw} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
    minWidth: 44,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  countNumber: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#FF3B30",
    lineHeight: 20,
  },
  pendingDot: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF3B30",
    borderWidth: 2,
    borderColor: "#fff",
  },
  outstandingBadge: {
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
  },
  outstandingLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  outstandingAmount: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.2,
  },
  pendingPayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#FDE68A",
    alignItems: "center",
  },
  pendingPayText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#92400E",
    letterSpacing: 0.3,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(232,119,34,0.1)", borderWidth: 1, borderColor: "rgba(232,119,34,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16,
    elevation: 20,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: "center", marginBottom: 20,
  },
  modalTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 6 },
  modalSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginBottom: 24 },
  pwFieldWrap: { marginBottom: 16 },
  pwFieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  pwInputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    backgroundColor: "#F9F9F9",
  },
  pwInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.text,
  },
  pwEyeBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  submitBtn: {
    backgroundColor: Colors.adminAccent, borderRadius: 14,
    paddingVertical: 16, alignItems: "center", marginTop: 8, marginBottom: 12,
  },
  submitBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  cancelBtn: { alignItems: "center", paddingVertical: 8 },
  cancelBtnText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
});
