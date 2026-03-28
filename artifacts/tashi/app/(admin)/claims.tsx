import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as SMS from "expo-sms";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

interface Claim {
  id: number;
  pointsClaimed: number;
  status: "pending" | "received";
  claimedAt: string;
  userName: string;
  userPhone: string | null;
  userRole: string;
  userId: number;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    "  " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function AdminClaimsScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [marking, setMarking] = useState(false);
  const [smsTarget, setSmsTarget] = useState<Claim | null>(null);
  const [smsSending, setSmsSending] = useState(false);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/claims`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setClaims(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchClaims(); }, [fetchClaims]));

  const totalPoints = claims.reduce((sum, c) => sum + c.pointsClaimed, 0);
  const pendingCount = claims.filter(c => c.status === "pending").length;

  const handlePressClaim = (claim: Claim) => {
    if (claim.status === "received") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedClaim(claim);
  };

  const handleMarkReceived = async () => {
    if (!selectedClaim) return;
    setMarking(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/claims/${selectedClaim.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setClaims(prev => prev.map(c =>
          c.id === selectedClaim.id ? { ...c, status: "received" } : c
        ));
        const paid = selectedClaim;
        setSelectedClaim(null);
        // Offer SMS after short delay so modal closes smoothly
        setTimeout(() => setSmsTarget(paid), 300);
      }
    } catch {
      // ignore
    } finally {
      setMarking(false);
      setSelectedClaim(null);
    }
  };

  const handleSendSms = async () => {
    if (!smsTarget) return;
    const phone = smsTarget.userPhone;
    if (!phone) {
      Alert.alert("No Phone Number", "This user has no phone number on record.");
      setSmsTarget(null);
      return;
    }

    const available = await SMS.isAvailableAsync();
    if (!available) {
      Alert.alert("SMS Not Available", "SMS is not supported on this device.");
      setSmsTarget(null);
      return;
    }

    const date = new Date(smsTarget.claimedAt).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });

    const message =
      `*Tashi Payment Confirmation*\n` +
      `Name: ${smsTarget.userName}\n` +
      `Date: ${date}\n\n` +
      `Your claim of ${smsTarget.pointsClaimed} points has been processed and payment has been made to your account.\n\n` +
      `Thank you for your service!\n- Tashi Team`;

    setSmsSending(true);
    try {
      await SMS.sendSMSAsync([phone], message);
    } finally {
      setSmsSending(false);
      setSmsTarget(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Claimed Rewards</Text>
        <TouchableOpacity onPress={fetchClaims} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={20} color={Colors.adminAccent} />
        </TouchableOpacity>
      </View>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{claims.length}</Text>
          <Text style={styles.summaryLabel}>Total Claims</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalPoints}</Text>
          <Text style={styles.summaryLabel}>Total Points</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.adminAccent} />
        </View>
      ) : (
        <FlatList
          data={claims}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchClaims}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="gift" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No claims yet.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPending = item.status === "pending";
            return (
              <TouchableOpacity
                style={[styles.card, isPending && styles.cardPending]}
                onPress={() => handlePressClaim(item)}
                activeOpacity={isPending ? 0.75 : 1}
              >
                <View style={styles.cardLeft}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{item.userName?.[0]?.toUpperCase() || "?"}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardEmail} numberOfLines={1}>{item.userName || "—"}</Text>
                    <Text style={styles.cardRole}>{item.userRole?.toUpperCase()}</Text>
                    {item.userPhone && (
                      <Text style={styles.cardPhone}>{item.userPhone}</Text>
                    )}
                    <Text style={styles.cardDate}>{formatDate(item.claimedAt)}</Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <View style={styles.pointsBadge}>
                    <Text style={styles.pointsBadgeText}>{item.pointsClaimed}</Text>
                    <Text style={styles.pointsBadgeUnit}>pts</Text>
                  </View>
                  <View style={[styles.statusBadge, isPending ? styles.statusPending : styles.statusReceived]}>
                    <Text style={[styles.statusText, isPending ? styles.statusTextPending : styles.statusTextReceived]}>
                      {isPending ? "Pending" : "Received"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── Payment confirmation modal ── */}
      <Modal
        visible={!!selectedClaim}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedClaim(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.popupCard}>
            <View style={styles.popupIconCircle}>
              <Feather name="credit-card" size={32} color={Colors.adminAccent} />
            </View>
            <Text style={styles.popupTitle}>Payment Made?</Text>
            <Text style={styles.popupSub}>Confirm that payment has been processed for:</Text>
            <View style={styles.popupDetail}>
              <Text style={styles.popupName}>{selectedClaim?.userName || "—"}</Text>
              {selectedClaim?.userPhone && (
                <Text style={styles.popupPhone}>{selectedClaim.userPhone}</Text>
              )}
              <Text style={styles.popupPts}>{selectedClaim?.pointsClaimed} pts</Text>
            </View>
            <View style={styles.popupActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSelectedClaim(null)}
                disabled={marking}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.okBtn, marking && { opacity: 0.6 }]}
                onPress={handleMarkReceived}
                disabled={marking}
              >
                {marking
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Text style={styles.okBtnText}>OK, Payment Made</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── SMS confirmation modal (shown after payment is marked) ── */}
      <Modal
        visible={!!smsTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setSmsTarget(null)}
      >
        <View style={styles.smsModalOverlay}>
          <View style={styles.smsSheet}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Success icon */}
            <View style={styles.paymentSuccessIcon}>
              <Feather name="check-circle" size={36} color="#10B981" />
            </View>
            <Text style={styles.sheetTitle}>Payment Recorded</Text>
            <Text style={styles.sheetSub}>
              Would you like to send an SMS to{"\n"}
              <Text style={styles.sheetName}>{smsTarget?.userName}</Text> to notify them?
            </Text>

            {/* Mechanic details */}
            <View style={styles.sheetDetail}>
              <View style={styles.sheetDetailRow}>
                <Feather name="user" size={14} color={Colors.textSecondary} />
                <Text style={styles.sheetDetailText}>{smsTarget?.userName || "—"}</Text>
              </View>
              {smsTarget?.userPhone && (
                <View style={styles.sheetDetailRow}>
                  <Feather name="phone" size={14} color={Colors.textSecondary} />
                  <Text style={styles.sheetDetailText}>{smsTarget.userPhone}</Text>
                </View>
              )}
              <View style={styles.sheetDetailRow}>
                <Feather name="star" size={14} color={Colors.adminAccent} />
                <Text style={[styles.sheetDetailText, { color: Colors.adminAccent, fontWeight: "700" }]}>
                  {smsTarget?.pointsClaimed} points paid
                </Text>
              </View>
            </View>

            {/* SMS preview */}
            <View style={styles.smsPreviewBox}>
              <Text style={styles.smsPreviewLabel}>SMS Preview</Text>
              <Text style={styles.smsPreviewText}>
                {`Your claim of ${smsTarget?.pointsClaimed} points has been processed and payment has been made to your account. Thank you! — Tashi`}
              </Text>
            </View>

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.sendSmsBtn, smsSending && { opacity: 0.6 }]}
              onPress={handleSendSms}
              disabled={smsSending}
              activeOpacity={0.85}
            >
              {smsSending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Feather name="message-square" size={20} color="#FFF" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sendSmsBtnTitle}>Send SMS Confirmation</Text>
                    <Text style={styles.sendSmsBtnSub}>{smsTarget?.userPhone ?? "No phone number"}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.7)" />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={() => setSmsTarget(null)}>
              <Text style={styles.skipBtnText}>Skip, Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.adminBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminText },
  refreshBtn: { padding: 8 },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: Colors.adminAccent,
    margin: 16,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryValue: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.white },
  summaryLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)" },
  summaryDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.3)" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 12 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { color: Colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 15 },
  card: {
    backgroundColor: Colors.adminCard,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  cardPending: {
    borderColor: `${Colors.adminAccent}50`,
    borderWidth: 1.5,
  },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Colors.adminAccent}20`,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  cardInfo: { flex: 1, gap: 2 },
  cardEmail: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  cardRole: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textSecondary },
  cardPhone: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight },
  cardDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight, marginTop: 2 },
  cardRight: { alignItems: "flex-end", gap: 6 },
  pointsBadge: {
    backgroundColor: `${Colors.adminAccent}18`,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: "center",
  },
  pointsBadgeText: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  pointsBadgeUnit: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.adminAccent },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusPending: { backgroundColor: `${Colors.adminAccent}22` },
  statusReceived: { backgroundColor: `${Colors.success}18` },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  statusTextPending: { color: Colors.adminAccent },
  statusTextReceived: { color: Colors.success },

  // Payment confirmation modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  popupCard: {
    backgroundColor: Colors.adminCard,
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  popupIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${Colors.adminAccent}20`,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  popupTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.adminText },
  popupSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
  popupDetail: {
    backgroundColor: `${Colors.adminAccent}12`,
    borderRadius: 14,
    padding: 16,
    width: "100%",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  popupName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  popupPhone: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  popupPts: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  popupActions: { flexDirection: "row", gap: 12, width: "100%", marginTop: 8 },
  cancelBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: Colors.border,
  },
  cancelBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  okBtn: {
    flex: 2,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: Colors.adminAccent,
  },
  okBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.white },

  // SMS bottom sheet
  smsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  smsSheet: {
    backgroundColor: Colors.adminCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    gap: 14,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: 4,
  },
  paymentSuccessIcon: { marginBottom: 2 },
  sheetTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.adminText },
  sheetSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  sheetName: { fontFamily: "Inter_700Bold", color: Colors.adminText },
  sheetDetail: {
    backgroundColor: `${Colors.adminAccent}10`,
    borderRadius: 14,
    padding: 14,
    width: "100%",
    gap: 8,
  },
  sheetDetailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sheetDetailText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.adminText },
  smsPreviewBox: {
    backgroundColor: "#F7F4F1",
    borderRadius: 12,
    padding: 14,
    width: "100%",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  smsPreviewLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.textSecondary, letterSpacing: 0.6, textTransform: "uppercase" },
  smsPreviewText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.adminText, lineHeight: 18 },
  sendSmsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.adminAccent,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    width: "100%",
    shadowColor: Colors.adminAccent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  sendSmsBtnTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  sendSmsBtnSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 2 },
  skipBtn: {
    paddingVertical: 12,
    alignItems: "center",
    width: "100%",
  },
  skipBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
});
