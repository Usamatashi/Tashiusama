import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

interface Claim {
  id: number;
  pointsClaimed: number;
  status: "pending" | "received";
  claimedAt: string;
  userEmail: string;
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
      }
    } catch {
      // ignore
    } finally {
      setMarking(false);
      setSelectedClaim(null);
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
                    <Text style={styles.avatarText}>{item.userEmail?.[0]?.toUpperCase() || "?"}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardEmail} numberOfLines={1}>{item.userEmail}</Text>
                    <Text style={styles.cardRole}>{item.userRole?.toUpperCase()}</Text>
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

      {/* Payment confirmation popup */}
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
              <Text style={styles.popupEmail}>{selectedClaim?.userEmail}</Text>
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

  // Modal / popup
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
  popupEmail: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
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
});
