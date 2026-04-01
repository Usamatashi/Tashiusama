import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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

const ACTIONS = [
  {
    icon: "plus-square" as const,
    label: "Create QR Code",
    desc: "Generate and assign QR codes to products",
    route: "/(admin)/create-qr" as const,
    gradient: ["#E87722", "#F5A54A"] as [string, string],
    decoration: "#F5A54A",
    countEndpoint: null as string | null,
    countLabel: null as string | null,
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
    gradient: ["#065F46", "#059669"] as [string, string],
    decoration: "#34D399",
    countEndpoint: null as string | null,
    countLabel: null as string | null,
    showPendingDot: false,
    showOrdersPending: false,
    superAdminOnly: false,
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
  const { logout, user } = useAuth();
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

  const [showPwModal, setShowPwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const closePwModal = () => {
    setShowPwModal(false);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setPwError(""); setPwSuccess(false);
    setShowCurrent(false); setShowNew(false); setShowConfirm(false);
  };

  const handleChangePassword = async () => {
    setPwError("");
    if (!currentPw || !newPw || !confirmPw) { setPwError("All fields are required."); return; }
    if (newPw.length < 6) { setPwError("New password must be at least 6 characters."); return; }
    if (newPw !== confirmPw) { setPwError("New passwords do not match."); return; }
    setPwSaving(true);
    try {
      const token = (await AsyncStorage.getItem("tashi_token")) || "";
      const res = await fetch(`${BASE}/users/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setPwError(data.error || "Incorrect current password."); return; }
      setPwSuccess(true);
      setTimeout(closePwModal, 1500);
    } catch {
      setPwError("Network error. Please try again.");
    } finally {
      setPwSaving(false);
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
        <TouchableOpacity onPress={logout} style={styles.headerBtn}>
          <Feather name="log-out" size={16} color={Colors.adminAccent} />
          <Text style={styles.headerBtnText}>Log out</Text>
        </TouchableOpacity>
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
                      <Text style={styles.cardDesc}>{action.desc}</Text>
                    </View>

                    {hasCount ? (
                      <View style={styles.countBadge}>
                        {loadingCounts ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.countNumber}>{count}</Text>
                        )}
                      </View>
                    ) : action.label === "Payments" ? (
                      <View style={{ alignItems: "flex-end", gap: 6 }}>
                        <View style={styles.outstandingBadge}>
                          {loadingCounts ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Text style={styles.outstandingLabel}>Due</Text>
                              <Text style={styles.outstandingAmount}>
                                Rs.{totalOutstanding !== null ? totalOutstanding.toLocaleString() : "—"}
                              </Text>
                            </>
                          )}
                        </View>
                        {!loadingCounts && pendingPayments > 0 && (
                          <View style={styles.pendingPayBadge}>
                            <Text style={styles.pendingPayText}>{pendingPayments} to verify</Text>
                          </View>
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

                  {action.label === "Config" && (
                    <>
                      <View style={styles.cardDivider} />
                      <TouchableOpacity
                        style={styles.changePwBtn}
                        onPress={(e) => { e.stopPropagation(); setShowPwModal(true); }}
                        activeOpacity={0.75}
                      >
                        <Feather name="lock" size={14} color="rgba(255,255,255,0.9)" />
                        <Text style={styles.changePwBtnText}>Change Password</Text>
                        <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.6)" />
                      </TouchableOpacity>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={showPwModal} transparent animationType="slide" onRequestClose={closePwModal}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closePwModal} />
          <View style={styles.pwSheet}>
            <View style={styles.pwSheetHandle} />
            <View style={styles.pwSheetHeader}>
              <View style={styles.pwSheetIconWrap}>
                <Feather name="lock" size={20} color="#7B2FBE" />
              </View>
              <Text style={styles.pwSheetTitle}>Change Password</Text>
              <TouchableOpacity onPress={closePwModal} style={styles.pwSheetClose}>
                <Feather name="x" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {pwSuccess ? (
              <View style={styles.pwSuccessBox}>
                <Feather name="check-circle" size={36} color="#10B981" />
                <Text style={styles.pwSuccessText}>Password updated successfully!</Text>
              </View>
            ) : (
              <>
                {/* Current Password */}
                <Text style={styles.pwLabel}>Current Password</Text>
                <View style={styles.pwInputRow}>
                  <TextInput
                    style={styles.pwInput}
                    placeholder="Enter current password"
                    placeholderTextColor={Colors.textLight}
                    secureTextEntry={!showCurrent}
                    value={currentPw}
                    onChangeText={setCurrentPw}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowCurrent(v => !v)} style={styles.pwEye}>
                    <Feather name={showCurrent ? "eye-off" : "eye"} size={18} color={Colors.textLight} />
                  </TouchableOpacity>
                </View>

                {/* New Password */}
                <Text style={styles.pwLabel}>New Password</Text>
                <View style={styles.pwInputRow}>
                  <TextInput
                    style={styles.pwInput}
                    placeholder="Enter new password"
                    placeholderTextColor={Colors.textLight}
                    secureTextEntry={!showNew}
                    value={newPw}
                    onChangeText={setNewPw}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.pwEye}>
                    <Feather name={showNew ? "eye-off" : "eye"} size={18} color={Colors.textLight} />
                  </TouchableOpacity>
                </View>

                {/* Confirm Password */}
                <Text style={styles.pwLabel}>Confirm New Password</Text>
                <View style={styles.pwInputRow}>
                  <TextInput
                    style={styles.pwInput}
                    placeholder="Re-enter new password"
                    placeholderTextColor={Colors.textLight}
                    secureTextEntry={!showConfirm}
                    value={confirmPw}
                    onChangeText={setConfirmPw}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.pwEye}>
                    <Feather name={showConfirm ? "eye-off" : "eye"} size={18} color={Colors.textLight} />
                  </TouchableOpacity>
                </View>

                {pwError ? (
                  <View style={styles.pwErrorBox}>
                    <Feather name="alert-circle" size={14} color="#DC2626" />
                    <Text style={styles.pwErrorText}>{pwError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.pwSaveBtn, pwSaving && { opacity: 0.7 }]}
                  onPress={handleChangePassword}
                  disabled={pwSaving}
                  activeOpacity={0.85}
                >
                  {pwSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.pwSaveBtnText}>Update Password</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
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
    paddingHorizontal: 10,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  countNumber: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#FF3B30",
    lineHeight: 24,
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
  cardDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginTop: 16,
    marginHorizontal: -4,
  },
  changePwBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 4,
  },
  changePwBtnText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.9)",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  pwSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 0,
  },
  pwSheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 20,
  },
  pwSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  pwSheetIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#7B2FBE14",
    alignItems: "center", justifyContent: "center",
  },
  pwSheetTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.adminText,
  },
  pwSheetClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  pwLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
  },
  pwInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 14,
  },
  pwInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.adminText,
  },
  pwEye: {
    padding: 6,
  },
  pwErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  pwErrorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#DC2626",
  },
  pwSaveBtn: {
    backgroundColor: "#7B2FBE",
    borderRadius: 14,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  pwSaveBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  pwSuccessBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 32,
  },
  pwSuccessText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.adminText,
    textAlign: "center",
  },
});
