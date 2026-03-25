import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import TickerMarquee from "@/components/TickerMarquee";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_WIDTH = SCREEN_WIDTH - 32;
const WHATSAPP_NUMBER = "923055198651";

interface ClaimRecord {
  id: number;
  pointsClaimed: number;
  status: "pending" | "received";
  claimedAt: string;
}

interface AdBanner {
  id: number;
  imageBase64: string;
  title: string | null;
}

interface TickerItem {
  id: number;
  text: string;
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

const FALLBACK_BANNERS = [
  { bg: Colors.primary, title: "Welcome to Tashi!", subtitle: "Earn points with every service visit" },
  { bg: "#C5611A", title: "Scan & Earn", subtitle: "Scan QR codes after every service" },
  { bg: "#1A2D2D", title: "Redeem Rewards", subtitle: "Turn your points into real benefits" },
];


// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function UserHomeScreen() {
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [bannerIndex, setBannerIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [claimModalVisible, setClaimModalVisible] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [localPoints, setLocalPoints] = useState<number | null>(null);
  const [claimHistory, setClaimHistory] = useState<ClaimRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [justClaimed, setJustClaimed] = useState<number | null>(null);
  const [adBanners, setAdBanners] = useState<AdBanner[]>([]);
  const [tickers, setTickers] = useState<TickerItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const [adRes, tickerRes] = await Promise.all([
          fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/ads`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/ticker`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (adRes.ok) setAdBanners(await adRes.json());
        if (tickerRes.ok) setTickers(await tickerRes.json());
      } catch {}
    })();
  }, []);

  useEffect(() => { refreshUser(); }, []);
  useEffect(() => {
    if (user?.points !== undefined) setLocalPoints(user.points);
  }, [user?.points]);

  const activeBanners = adBanners.length > 0 ? adBanners : FALLBACK_BANNERS;

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (bannerIndex + 1) % activeBanners.length;
      setBannerIndex(next);
      scrollRef.current?.scrollTo({ x: next * BANNER_WIDTH, animated: true });
    }, 3500);
    return () => clearInterval(interval);
  }, [bannerIndex, activeBanners.length]);

  const fetchClaimHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const token = await getToken();
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/claims`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setClaimHistory(await res.json());
    } catch {}
    finally { setLoadingHistory(false); }
  }, []);

  const openClaimModal = () => {
    setJustClaimed(null);
    setClaimModalVisible(true);
    fetchClaimHistory();
  };

  const confirmClaim = async () => {
    setClaiming(true);
    try {
      const token = await getToken();
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      const data = await res.json();
      setJustClaimed(data.pointsClaimed);
      setLocalPoints(0);
      await refreshUser();
      await fetchClaimHistory();
    } catch {}
    finally { setClaiming(false); }
  };

  const displayPoints = localPoints ?? user?.points ?? 0;
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const firstName = user?.email?.split("@")[0] || "there";
  const tickerText = tickers.map((t) => t.text).join("          •          ");

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreet}>Hello, {firstName}</Text>
          <Text style={styles.headerSub}>Your loyalty dashboard</Text>
        </View>
        <TouchableOpacity
          onPress={() => Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}`)}
          style={styles.waBtn}
        >
          <Text style={styles.waBtnText}>WA</Text>
        </TouchableOpacity>
      </View>

      {/* Ticker marquee — shown only when text exists */}
      {tickerText.length > 0 && <TickerMarquee text={tickerText} height={32} />}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Points hero — ticket style */}
        <View style={styles.ticketCard}>
          {/* Left: points info */}
          <View style={styles.ticketLeft}>
            <Text style={styles.ticketLabel}>Available Points</Text>
            <Text style={styles.ticketValue}>{displayPoints}</Text>
            <Text style={styles.ticketUnit}>pts</Text>
          </View>

          {/* Divider with punched notches */}
          <View style={styles.ticketSep}>
            <View style={styles.notchTop} />
            <View style={styles.notchLine} />
            <View style={styles.notchBottom} />
          </View>

          {/* Right: claim button inside notch area */}
          <TouchableOpacity style={styles.ticketRight} onPress={openClaimModal} activeOpacity={0.8}>
            <Text style={styles.ticketClaimText}>Claim{"\n"}Rewards</Text>
          </TouchableOpacity>
        </View>

        {/* Banner carousel */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.bannerScroll}
          onMomentumScrollEnd={(e) => {
            setBannerIndex(Math.round(e.nativeEvent.contentOffset.x / BANNER_WIDTH));
          }}
        >
          {adBanners.length > 0
            ? adBanners.map((ad) => (
                <Image key={ad.id} source={{ uri: ad.imageBase64 }}
                  style={[styles.bannerImage, { width: BANNER_WIDTH }]} resizeMode="cover" />
              ))
            : FALLBACK_BANNERS.map((b, i) => (
                <View key={i} style={[styles.banner, { backgroundColor: b.bg, width: BANNER_WIDTH }]}>
                  <Text style={styles.bannerTitle}>{b.title}</Text>
                  <Text style={styles.bannerSubtitle}>{b.subtitle}</Text>
                </View>
              ))}
        </ScrollView>
        <View style={styles.dots}>
          {activeBanners.map((_, i) => (
            <View key={i} style={[styles.dot, i === bannerIndex && styles.dotActive]} />
          ))}
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionLabel}>Explore</Text>
        <View style={styles.quickGrid}>
          <TouchableOpacity style={styles.gridCard} onPress={() => router.push("/(user)/points")} activeOpacity={0.8}>
            <Text style={styles.gridCardTitle}>My Points</Text>
            <Text style={styles.gridCardDesc}>View your balance</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridCard} onPress={() => router.push("/(user)/rewards")} activeOpacity={0.8}>
            <Text style={styles.gridCardTitle}>Rewards</Text>
            <Text style={styles.gridCardDesc}>Redeem your points</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridCard} onPress={() => router.push("/(user)/history")} activeOpacity={0.8}>
            <Text style={styles.gridCardTitle}>Scan History</Text>
            <Text style={styles.gridCardDesc}>All your scans</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridCard} onPress={() => router.push("/(user)/profile")} activeOpacity={0.8}>
            <Text style={styles.gridCardTitle}>Profile</Text>
            <Text style={styles.gridCardDesc}>Your account info</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Claim modal */}
      <Modal visible={claimModalVisible} transparent animationType="slide" onRequestClose={() => setClaimModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Claim Rewards</Text>
              <TouchableOpacity onPress={() => setClaimModalVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {justClaimed !== null ? (
              <View style={styles.successBox}>
                <View style={styles.successRing}>
                  <Text style={styles.successCheck}>✓</Text>
                </View>
                <Text style={styles.successTitle}>Claimed Successfully!</Text>
                <Text style={styles.successPts}>{justClaimed} pts</Text>
                <Text style={styles.successSub}>Your points have been submitted for payment</Text>
              </View>
            ) : (
              <View style={styles.claimSection}>
                {displayPoints > 0 ? (
                  <>
                    <View style={styles.claimPointsCard}>
                      <View style={styles.claimPointsRow}>
                        <View style={styles.claimPointsBox}>
                          <Text style={styles.claimPointsLbl}>Available</Text>
                          <Text style={styles.claimPointsNum}>{displayPoints}</Text>
                          <Text style={styles.claimPointsUnit}>pts</Text>
                        </View>
                        <Text style={styles.claimArrow}>→</Text>
                        <View style={[styles.claimPointsBox, styles.claimPointsBoxGreen]}>
                          <Text style={[styles.claimPointsLbl, { color: Colors.success }]}>To Claim</Text>
                          <Text style={[styles.claimPointsNum, { color: Colors.success }]}>{displayPoints}</Text>
                          <Text style={[styles.claimPointsUnit, { color: Colors.success }]}>pts</Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.claimBtn, claiming && { opacity: 0.6 }]}
                      onPress={confirmClaim}
                      disabled={claiming}
                      activeOpacity={0.85}
                    >
                      {claiming
                        ? <ActivityIndicator color={Colors.white} />
                        : <Text style={styles.claimBtnText}>Claim {displayPoints} Points</Text>
                      }
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.noPointsBox}>
                    <Text style={styles.noPointsTitle}>No Points Yet</Text>
                    <Text style={styles.noPointsTxt}>Scan QR codes after service visits to earn points</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Claim History</Text>
              <View style={styles.dividerLine} />
            </View>

            {loadingHistory ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
            ) : claimHistory.length === 0 ? (
              <Text style={styles.historyEmpty}>No claims yet</Text>
            ) : (
              <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                {claimHistory.map((c) => {
                  const isPending = c.status === "pending";
                  return (
                    <View key={c.id} style={styles.historyItem}>
                      <View style={[styles.historyDotWrap, { backgroundColor: isPending ? `${Colors.primary}18` : `${Colors.success}18` }]}>
                        <Text style={[styles.historyDotText, { color: isPending ? Colors.primary : Colors.success }]}>
                          {isPending ? "⏳" : "✓"}
                        </Text>
                      </View>
                      <View style={styles.historyTextWrap}>
                        <Text style={styles.historyPts}>{c.pointsClaimed} points claimed</Text>
                        <Text style={styles.historyDate}>{formatDate(c.claimedAt)}</Text>
                      </View>
                      <View style={[styles.statusBadge, isPending ? styles.statusPending : styles.statusReceived]}>
                        <Text style={[styles.statusText, { color: isPending ? Colors.primary : Colors.success }]}>
                          {isPending ? "Pending" : "Received"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F4F1" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerGreet: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  waBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#E8F8EF",
    justifyContent: "center", alignItems: "center",
  },
  waBtnText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#25D366" },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 18, paddingBottom: 24 },

  /* ── Ticket-style points card ─────────────────────────────────── */
  ticketCard: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 90,
  },

  ticketLeft: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 22,
    paddingRight: 8,
    justifyContent: "center",
  },
  ticketLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  ticketValue: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
    lineHeight: 44,
    includeFontPadding: false,
  },
  ticketUnit: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },

  /* Separator: notch circles + dashed line */
  ticketSep: {
    width: 28,
    alignItems: "center",
    justifyContent: "space-between",
  },
  notchTop: {
    width: 28,
    height: 14,
    backgroundColor: "#F7F4F1",   /* matches screen background → carves a "bite" */
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  notchLine: {
    flex: 1,
    width: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  notchBottom: {
    width: 28,
    height: 14,
    backgroundColor: "#F7F4F1",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },

  /* Right claim area */
  ticketRight: {
    width: 72,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  ticketClaimText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
    textAlign: "center",
    lineHeight: 16,
  },

  bannerScroll: { borderRadius: 18 },
  banner: { height: 136, borderRadius: 18, padding: 20, justifyContent: "flex-end", gap: 4 },
  bannerImage: { height: 136, borderRadius: 18 },
  bannerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.white },
  bannerSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.82)" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: -8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#D9C9BF" },
  dotActive: { backgroundColor: Colors.primary, width: 16 },

  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, paddingHorizontal: 2, marginBottom: -6 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridCard: {
    width: "47%",
    backgroundColor: Colors.white,
    borderRadius: 18, padding: 18,
    gap: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  gridCardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  gridCardDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modal: {
    backgroundColor: Colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingTop: 12, paddingHorizontal: 20, maxHeight: "88%",
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F0F0F0", justifyContent: "center", alignItems: "center" },
  closeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },

  successBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  successRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: Colors.success,
    justifyContent: "center", alignItems: "center",
    backgroundColor: `${Colors.success}10`, marginBottom: 8,
  },
  successCheck: { fontSize: 32, color: Colors.success },
  successTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  successPts: { fontSize: 44, fontFamily: "Inter_700Bold", color: Colors.success },
  successSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", maxWidth: 240 },

  claimSection: { marginBottom: 4 },
  claimPointsCard: { backgroundColor: "#F7F4F1", borderRadius: 16, padding: 16, marginBottom: 14 },
  claimPointsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  claimPointsBox: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 12,
    padding: 14, alignItems: "center", gap: 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  claimPointsBoxGreen: { borderColor: `${Colors.success}30`, backgroundColor: `${Colors.success}08` },
  claimArrow: { fontSize: 20, color: Colors.textLight },
  claimPointsLbl: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  claimPointsNum: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.primary },
  claimPointsUnit: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  claimBtn: {
    backgroundColor: Colors.success, borderRadius: 16, paddingVertical: 16,
    alignItems: "center", justifyContent: "center",
  },
  claimBtnText: { color: Colors.white, fontSize: 16, fontFamily: "Inter_700Bold" },
  noPointsBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  noPointsTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text },
  noPointsTxt: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", maxWidth: 240 },

  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textLight, letterSpacing: 0.5 },

  historyEmpty: { textAlign: "center", color: Colors.textLight, fontFamily: "Inter_400Regular", fontSize: 14, marginBottom: 16 },
  historyList: { maxHeight: 220 },
  historyItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  historyDotWrap: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  historyDotText: { fontSize: 14 },
  historyTextWrap: { flex: 1 },
  historyPts: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  historyDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textLight, marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusPending: { backgroundColor: `${Colors.primary}15` },
  statusReceived: { backgroundColor: `${Colors.success}15` },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
});
