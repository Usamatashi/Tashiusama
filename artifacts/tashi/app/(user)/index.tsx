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
import { Feather } from "@expo/vector-icons";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

const { width } = Dimensions.get("window");
const BANNER_WIDTH = width - 32;
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
  { bg: Colors.primary, icon: "zap" as const, title: "Welcome to Tashi!", subtitle: "Earn points with every service visit" },
  { bg: "#C5611A", icon: "award" as const, title: "Scan & Earn", subtitle: "Scan QR codes after every service" },
  { bg: "#1A2D2D", icon: "gift" as const, title: "Redeem Rewards", subtitle: "Turn your points into real benefits" },
];

export default function UserHomeScreen() {
  const { user, refreshUser } = useAuth();
  const navigation = useNavigation();
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

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/ads`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setAdBanners(await res.json());
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

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.menuBtn}>
          <Feather name="menu" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Image source={require("../../assets/images/tashi-logo.png")} style={styles.logo} resizeMode="contain" />
        <TouchableOpacity onPress={() => Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}`)} style={styles.waBtn}>
          <Feather name="message-circle" size={22} color="#25D366" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={styles.greetHi}>Hello, {firstName}</Text>
          <Text style={styles.greetSub}>Your loyalty points summary</Text>
        </View>

        {/* Points hero */}
        <View style={styles.pointsHero}>
          <View style={styles.pointsHeroInner}>
            <Text style={styles.pointsHeroLabel}>Available Points</Text>
            <Text style={styles.pointsHeroValue}>{displayPoints}</Text>
            <Text style={styles.pointsHeroUnit}>pts</Text>
          </View>
          <View style={styles.pointsHeroDeco}>
            <Feather name="star" size={80} color="rgba(255,255,255,0.08)" />
          </View>
          <TouchableOpacity style={styles.claimHeroBtn} onPress={openClaimModal} activeOpacity={0.85}>
            <Feather name="gift" size={15} color={Colors.white} />
            <Text style={styles.claimHeroBtnText}>Claim Rewards</Text>
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
                  <View style={styles.bannerIconBox}>
                    <Feather name={b.icon} size={22} color="rgba(255,255,255,0.9)" />
                  </View>
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
        <Text style={styles.sectionLabel}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/(user)/history")} activeOpacity={0.8}>
            <View style={[styles.actionIconWrap, { backgroundColor: "#FFF0E6" }]}>
              <Feather name="clock" size={22} color={Colors.primary} />
            </View>
            <Text style={styles.actionCardLabel}>Scan History</Text>
            <Feather name="chevron-right" size={16} color={Colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/(user)/points")} activeOpacity={0.8}>
            <View style={[styles.actionIconWrap, { backgroundColor: "#E8F5E9" }]}>
              <Feather name="star" size={22} color={Colors.success} />
            </View>
            <Text style={styles.actionCardLabel}>My Points</Text>
            <Feather name="chevron-right" size={16} color={Colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push("/(user)/rewards")} activeOpacity={0.8}>
            <View style={[styles.actionIconWrap, { backgroundColor: "#FFF3E0" }]}>
              <Feather name="award" size={22} color="#F39C12" />
            </View>
            <Text style={styles.actionCardLabel}>Rewards</Text>
            <Feather name="chevron-right" size={16} color={Colors.textLight} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {user?.role === "mechanic" && (
        <View style={[styles.scanBarWrapper, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8) }]}>
          <TouchableOpacity style={styles.scanBar} onPress={() => router.push("/(user)/scan")} activeOpacity={0.85}>
            <View style={styles.scanIconCircle}>
              <Feather name="camera" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.scanBarText}>Scan QR Code</Text>
            <Feather name="arrow-right" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
      )}

      {/* Claim modal */}
      <Modal visible={claimModalVisible} transparent animationType="slide" onRequestClose={() => setClaimModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Claim Rewards</Text>
              <TouchableOpacity onPress={() => setClaimModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {justClaimed !== null ? (
              <View style={styles.successBox}>
                <View style={styles.successRing}>
                  <Feather name="check" size={36} color={Colors.success} />
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
                        <View style={styles.claimArrow}>
                          <Feather name="arrow-right" size={18} color={Colors.textLight} />
                        </View>
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
                        : <><Feather name="gift" size={18} color={Colors.white} /><Text style={styles.claimBtnText}>Claim {displayPoints} Points</Text></>
                      }
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.noPointsBox}>
                    <View style={styles.noPointsIcon}>
                      <Feather name="inbox" size={28} color={Colors.textLight} />
                    </View>
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
                        <Feather name={isPending ? "clock" : "check"} size={14} color={isPending ? Colors.primary : Colors.success} />
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
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  menuBtn: { padding: 6 },
  logo: { width: 90, height: 40 },
  waBtn: { padding: 6 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 18, paddingBottom: 36 },

  greeting: { paddingHorizontal: 4 },
  greetHi: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  greetSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },

  pointsHero: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    padding: 24,
    overflow: "hidden",
    position: "relative",
  },
  pointsHeroInner: { zIndex: 1 },
  pointsHeroLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)", marginBottom: 4 },
  pointsHeroValue: { fontSize: 60, fontFamily: "Inter_700Bold", color: Colors.white, lineHeight: 68 },
  pointsHeroUnit: { fontSize: 16, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)", marginTop: -2, marginBottom: 16 },
  pointsHeroDeco: { position: "absolute", right: -8, top: -8, zIndex: 0 },
  claimHeroBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start",
  },
  claimHeroBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.white },

  bannerScroll: { borderRadius: 18 },
  banner: { height: 140, borderRadius: 18, padding: 20, justifyContent: "flex-end", gap: 4 },
  bannerImage: { height: 140, borderRadius: 18 },
  bannerIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
    marginBottom: 6,
  },
  bannerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.white },
  bannerSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.82)" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: -8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#D9C9BF" },
  dotActive: { backgroundColor: Colors.primary, width: 16 },

  sectionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, paddingHorizontal: 4, marginBottom: -6 },
  quickActions: { gap: 10 },
  actionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  actionIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  actionCardLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },

  scanBarWrapper: {
    paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  scanBar: {
    backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  scanIconCircle: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.white, justifyContent: "center", alignItems: "center",
  },
  scanBarText: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.white },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modal: {
    backgroundColor: Colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingTop: 12, paddingHorizontal: 20, maxHeight: "88%",
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F0F0F0", justifyContent: "center", alignItems: "center" },

  successBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  successRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: Colors.success,
    justifyContent: "center", alignItems: "center",
    backgroundColor: `${Colors.success}10`, marginBottom: 8,
  },
  successTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  successPts: { fontSize: 44, fontFamily: "Inter_700Bold", color: Colors.success },
  successSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", maxWidth: 240 },

  claimSection: { marginBottom: 4 },
  claimPointsCard: {
    backgroundColor: "#F7F4F1", borderRadius: 16, padding: 16, marginBottom: 14,
  },
  claimPointsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  claimPointsBox: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 12,
    padding: 14, alignItems: "center", gap: 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  claimPointsBoxGreen: { borderColor: `${Colors.success}30`, backgroundColor: `${Colors.success}08` },
  claimArrow: { alignItems: "center", justifyContent: "center" },
  claimPointsLbl: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  claimPointsNum: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.primary },
  claimPointsUnit: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  claimBtn: {
    backgroundColor: Colors.success, borderRadius: 16, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  claimBtnText: { color: Colors.white, fontSize: 16, fontFamily: "Inter_700Bold" },
  noPointsBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  noPointsIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#F0F0F0", justifyContent: "center", alignItems: "center", marginBottom: 4,
  },
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
  historyTextWrap: { flex: 1 },
  historyPts: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  historyDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textLight, marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusPending: { backgroundColor: `${Colors.primary}15` },
  statusReceived: { backgroundColor: `${Colors.success}15` },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
});
