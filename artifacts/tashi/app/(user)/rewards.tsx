import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

interface ClaimRecord {
  id: number;
  pointsClaimed: number;
  status: "pending" | "received";
  claimedAt: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    "  " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

async function getToken(): Promise<string> {
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  return (await AsyncStorage.getItem("tashi_token")) || "";
}

const REWARDS = [
  { points: 500, title: "Oil Change Voucher", desc: "Free oil change at any Tashi partner" },
  { points: 1000, title: "Tire Check", desc: "Free tire inspection & balancing" },
  { points: 2000, title: "Service Discount", desc: "20% off your next full service" },
  { points: 5000, title: "Premium Package", desc: "Full vehicle service package" },
];

export default function RewardsScreen() {
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [claimHistory, setClaimHistory] = useState<ClaimRecord[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const userPoints = user?.points ?? 0;

  const isMechanic = user?.role !== "retailer" && user?.role !== "salesman";

  const fetchClaims = useCallback(async () => {
    if (!isMechanic) return;
    setLoadingClaims(true);
    try {
      const token = await getToken();
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/claims`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setClaimHistory(await res.json());
    } catch {}
    finally { setLoadingClaims(false); }
  }, [isMechanic]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshUser(), fetchClaims()]);
    setRefreshing(false);
  }, [refreshUser, fetchClaims]);

  const nextReward = REWARDS.find(r => userPoints < r.points);
  const progressPct = nextReward
    ? Math.min((userPoints / nextReward.points) * 100, 100)
    : 100;

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rewards</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Points card */}
        <View style={styles.pointsCard}>
          <View>
            <Text style={styles.pointsCardLabel}>Your Balance</Text>
            <Text style={styles.pointsCardValue}>{userPoints.toLocaleString()}</Text>
            <Text style={styles.pointsCardUnit}>points</Text>
          </View>
          <Text style={styles.pointsCardStar}>★</Text>
        </View>

        {/* Next milestone */}
        {nextReward && (
          <View style={styles.milestoneCard}>
            <View>
              <Text style={styles.milestoneLabel}>NEXT REWARD</Text>
              <Text style={styles.milestoneTitle}>{nextReward.title}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <View style={styles.progressMeta}>
              <Text style={styles.progressCurrent}>{userPoints} pts</Text>
              <Text style={styles.progressTarget}>{nextReward.points} pts needed</Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionLabel}>All Rewards</Text>

        {REWARDS.map((r) => {
          const canRedeem = userPoints >= r.points;
          const pct = Math.min((userPoints / r.points) * 100, 100);
          return (
            <View key={r.title} style={[styles.rewardCard, canRedeem && styles.rewardCardUnlocked]}>
              {canRedeem && (
                <View style={styles.unlockedBanner}>
                  <Text style={styles.unlockedBannerText}>Unlocked</Text>
                </View>
              )}
              <View style={styles.rewardTop}>
                <View style={styles.rewardLeft}>
                  <Text style={[styles.rewardTitle, !canRedeem && styles.rewardTitleLocked]}>{r.title}</Text>
                  <Text style={styles.rewardDesc}>{r.desc}</Text>
                </View>
                <Text style={[styles.rewardPts, !canRedeem && styles.rewardPtsLocked]}>{r.points} pts</Text>
              </View>
              {!canRedeem && (
                <View style={styles.rewardProgressRow}>
                  <View style={styles.rewardProgressTrack}>
                    <View style={[styles.rewardProgressFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.rewardProgressPct}>{Math.round(pct)}%</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* ── Claimed Rewards — mechanics only ─────────────── */}
        {isMechanic && (
          <>
            <View style={styles.claimedDivider}>
              <View style={styles.claimedDividerLine} />
              <Text style={styles.claimedDividerText}>Claimed Rewards</Text>
              <View style={styles.claimedDividerLine} />
            </View>

            {loadingClaims ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
            ) : claimHistory.length === 0 ? (
              <View style={styles.claimedEmpty}>
                <Text style={styles.claimedEmptyIcon}>🏷️</Text>
                <Text style={styles.claimedEmptyTitle}>No claims yet</Text>
                <Text style={styles.claimedEmptyText}>When you claim points they will appear here</Text>
              </View>
            ) : (
              claimHistory.map((c) => {
                const isPending = c.status === "pending";
                return (
                  <View key={c.id} style={styles.claimItem}>
                    <View style={[styles.claimIconWrap, { backgroundColor: isPending ? `${Colors.primary}15` : `${Colors.success}15` }]}>
                      <Text style={styles.claimIcon}>{isPending ? "⏳" : "✅"}</Text>
                    </View>
                    <View style={styles.claimInfo}>
                      <Text style={styles.claimPts}>{c.pointsClaimed} points claimed</Text>
                      <Text style={styles.claimDate}>{formatDate(c.claimedAt)}</Text>
                    </View>
                    <View style={[styles.claimBadge, isPending ? styles.claimBadgePending : styles.claimBadgeReceived]}>
                      <Text style={[styles.claimBadgeText, { color: isPending ? Colors.primary : Colors.success }]}>
                        {isPending ? "Pending" : "Received"}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F4F1" },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },

  pointsCard: {
    backgroundColor: Colors.primary, borderRadius: 24, padding: 24,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  pointsCardLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },
  pointsCardValue: { fontSize: 48, fontFamily: "Inter_700Bold", color: Colors.white, lineHeight: 56 },
  pointsCardUnit: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },
  pointsCardStar: { fontSize: 60, color: "rgba(255,255,255,0.12)" },

  milestoneCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 18,
    gap: 10, borderWidth: 1, borderColor: Colors.border,
  },
  milestoneLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.textSecondary,
    letterSpacing: 0.8, marginBottom: 2,
  },
  milestoneTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text },
  progressTrack: { height: 8, backgroundColor: "#F0EDE9", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: Colors.primary, borderRadius: 4 },
  progressMeta: { flexDirection: "row", justifyContent: "space-between" },
  progressCurrent: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  progressTarget: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },

  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, paddingHorizontal: 2 },
  rewardCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 18,
    gap: 12, borderWidth: 1, borderColor: Colors.border,
    opacity: 0.65,
  },
  rewardCardUnlocked: { opacity: 1, borderColor: `${Colors.success}30` },
  unlockedBanner: {
    alignSelf: "flex-start",
    backgroundColor: `${Colors.success}12`, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  unlockedBannerText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.success },
  rewardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  rewardLeft: { flex: 1 },
  rewardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  rewardTitleLocked: { color: Colors.textSecondary },
  rewardDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 3 },
  rewardPts: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.primary },
  rewardPtsLocked: { color: Colors.textLight },
  rewardProgressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  rewardProgressTrack: { flex: 1, height: 5, backgroundColor: "#F0EDE9", borderRadius: 3, overflow: "hidden" },
  rewardProgressFill: { height: "100%", backgroundColor: Colors.primary, borderRadius: 3 },
  rewardProgressPct: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, minWidth: 30, textAlign: "right" },

  claimedDivider: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  claimedDividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  claimedDividerText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textSecondary, letterSpacing: 0.5, textTransform: "uppercase" },

  claimedEmpty: { alignItems: "center", gap: 6, paddingVertical: 24 },
  claimedEmptyIcon: { fontSize: 32 },
  claimedEmptyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  claimedEmptyText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", maxWidth: 220 },

  claimItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.white, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  claimIconWrap: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  claimIcon: { fontSize: 18 },
  claimInfo: { flex: 1 },
  claimPts: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  claimDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  claimBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  claimBadgePending: { backgroundColor: `${Colors.primary}15` },
  claimBadgeReceived: { backgroundColor: `${Colors.success}15` },
  claimBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
});
