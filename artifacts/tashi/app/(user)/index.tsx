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
  { bg: Colors.primary, title: "Welcome!", subtitle: "Earn points by scanning QR codes" },
  { bg: "#C5611A", title: "Earn Points", subtitle: "Scan QR codes after every service" },
  { bg: "#2D2D2D", title: "Redeem Rewards", subtitle: "Use your points for exclusive benefits" },
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
      } catch {
        // fall back to static banners
      }
    })();
  }, []);

  useEffect(() => { refreshUser(); }, []);

  useEffect(() => {
    if (user?.points !== undefined) setLocalPoints(user.points);
  }, [user?.points]);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (bannerIndex + 1) % BANNERS.length;
      setBannerIndex(next);
      scrollRef.current?.scrollTo({ x: next * BANNER_WIDTH, animated: true });
    }, 3000);
    return () => clearInterval(interval);
  }, [bannerIndex, BANNERS.length]);

  const fetchClaimHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const token = await getToken();
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/claims`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClaimHistory(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to claim");
      }
      const data = await res.json();
      setJustClaimed(data.pointsClaimed);
      setLocalPoints(0);
      await refreshUser();
      await fetchClaimHistory();
    } catch (err: any) {
      // show inline error
    } finally {
      setClaiming(false);
    }
  };

  const displayPoints = localPoints ?? user?.points ?? 0;
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.menuBtn}>
          <Feather name="menu" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Image source={require("../../assets/images/tashi-logo.png")} style={styles.logo} resizeMode="contain" />
        <TouchableOpacity onPress={() => Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}`)} style={styles.waBtn}>
          <Feather name="message-circle" size={24} color="#25D366" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banners */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.bannerScroll}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / BANNER_WIDTH);
            setBannerIndex(idx);
          }}
        >
          {adBanners.length > 0
            ? adBanners.map((ad) => (
                <Image
                  key={ad.id}
                  source={{ uri: ad.imageBase64 }}
                  style={[styles.bannerImage, { width: BANNER_WIDTH }]}
                  resizeMode="cover"
                />
              ))
            : FALLBACK_BANNERS.map((b, i) => (
                <View key={i} style={[styles.banner, { backgroundColor: b.bg, width: BANNER_WIDTH }]}>
                  <Text style={styles.bannerTitle}>{b.title}</Text>
                  <Text style={styles.bannerSubtitle}>{b.subtitle}</Text>
                </View>
              ))}
        </ScrollView>

        <View style={styles.dots}>
          {(adBanners.length > 0 ? adBanners : FALLBACK_BANNERS).map((_, i) => (
            <View key={i} style={[styles.dot, i === bannerIndex && styles.dotActive]} />
          ))}
        </View>

        {/* Points card */}
        <View style={styles.pointsCard}>
          <Text style={styles.pointsLabel}>Total Points</Text>
          <Text style={styles.pointsValue}>{displayPoints}</Text>
          <Text style={styles.pointsUnit}>pts</Text>
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(user)/history")} activeOpacity={0.8}>
            <View style={styles.actionIcon}>
              <Feather name="clock" size={26} color={Colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Scan History</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={openClaimModal} activeOpacity={0.8}>
            <View style={[styles.actionIcon, { backgroundColor: `${Colors.success}18` }]}>
              <Feather name="gift" size={26} color={Colors.success} />
            </View>
            <Text style={styles.actionLabel}>Claim Rewards</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {user?.role === "mechanic" && (
        <View style={[styles.scanBarWrapper, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8) }]}>
          <TouchableOpacity style={styles.scanBar} onPress={() => router.push("/(user)/scan")} activeOpacity={0.85}>
            <Feather name="camera" size={22} color={Colors.white} />
            <Text style={styles.scanBarText}>Scan QR Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Claim modal */}
      <Modal visible={claimModalVisible} transparent animationType="slide" onRequestClose={() => setClaimModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + 24 }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Claim Rewards</Text>
              <TouchableOpacity onPress={() => setClaimModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Success state */}
            {justClaimed !== null ? (
              <View style={styles.successBox}>
                <View style={styles.successIcon}>
                  <Feather name="check-circle" size={40} color={Colors.success} />
                </View>
                <Text style={styles.successTitle}>Claimed!</Text>
                <Text style={styles.successPts}>{justClaimed} pts</Text>
                <Text style={styles.successSub}>successfully redeemed</Text>
              </View>
            ) : (
              /* Claim section */
              <View style={styles.claimSection}>
                {displayPoints > 0 ? (
                  <>
                    <View style={styles.claimPointsRow}>
                      <View style={styles.claimPointsBox}>
                        <Text style={styles.claimPointsNum}>{displayPoints}</Text>
                        <Text style={styles.claimPointsLbl}>available pts</Text>
                      </View>
                      <Feather name="arrow-right" size={20} color={Colors.textLight} />
                      <View style={[styles.claimPointsBox, { backgroundColor: `${Colors.success}15` }]}>
                        <Text style={[styles.claimPointsNum, { color: Colors.success }]}>{displayPoints}</Text>
                        <Text style={[styles.claimPointsLbl, { color: Colors.success }]}>to claim</Text>
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
                    <Feather name="inbox" size={32} color={Colors.textLight} />
                    <Text style={styles.noPointsTxt}>No points available to claim</Text>
                  </View>
                )}
              </View>
            )}

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Claim History</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* History list */}
            {loadingHistory ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
            ) : claimHistory.length === 0 ? (
              <Text style={styles.historyEmpty}>No claims yet</Text>
            ) : (
              <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                {claimHistory.map((c) => (
                  <View key={c.id} style={styles.historyItem}>
                    <View style={styles.historyLeft}>
                      <View style={styles.historyDot} />
                      <View>
                        <Text style={styles.historyPts}>{c.pointsClaimed} points claimed</Text>
                        <Text style={styles.historyDate}>{formatDate(c.claimedAt)}</Text>
                      </View>
                    </View>
                    <View style={styles.historyBadge}>
                      <Text style={styles.historyBadgeText}>+{c.pointsClaimed}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  menuBtn: { padding: 4 },
  logo: { width: 100, height: 44 },
  waBtn: { padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 32 },
  bannerScroll: { borderRadius: 16 },
  banner: { height: 160, borderRadius: 16, padding: 24, justifyContent: "flex-end" },
  bannerImage: { height: 160, borderRadius: 16 },
  bannerTag: {
    alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8,
  },
  bannerTagText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.white },
  bannerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.white },
  bannerSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)", marginTop: 4 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: -4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary, width: 18 },
  pointsCard: { backgroundColor: Colors.primary, borderRadius: 20, padding: 28, alignItems: "center" },
  pointsLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)", marginBottom: 4 },
  pointsValue: { fontSize: 56, fontFamily: "Inter_700Bold", color: Colors.white, lineHeight: 64 },
  pointsUnit: { fontSize: 16, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)", marginTop: -4 },
  quickActions: { flexDirection: "row", gap: 12 },
  actionBtn: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 16, padding: 20,
    alignItems: "center", gap: 10, borderWidth: 1, borderColor: Colors.border,
  },
  actionIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: `${Colors.primary}18`, justifyContent: "center", alignItems: "center",
  },
  actionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text, textAlign: "center" },
  scanBarWrapper: {
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  scanBar: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
  },
  scanBarText: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.white },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: {
    backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 24, paddingHorizontal: 20, maxHeight: "85%",
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  closeBtn: { padding: 4 },

  // Success
  successBox: { alignItems: "center", paddingVertical: 20, gap: 6 },
  successIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: `${Colors.success}15`, justifyContent: "center", alignItems: "center", marginBottom: 8,
  },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  successPts: { fontSize: 40, fontFamily: "Inter_700Bold", color: Colors.success },
  successSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },

  // Claim section
  claimSection: { marginBottom: 8 },
  claimPointsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16 },
  claimPointsBox: {
    flex: 1, backgroundColor: `${Colors.primary}12`, borderRadius: 14,
    padding: 16, alignItems: "center", gap: 4,
  },
  claimPointsNum: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.primary },
  claimPointsLbl: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  claimBtn: {
    backgroundColor: Colors.success, borderRadius: 14, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  claimBtnText: { color: Colors.white, fontSize: 16, fontFamily: "Inter_700Bold" },
  noPointsBox: { alignItems: "center", paddingVertical: 20, gap: 10 },
  noPointsTxt: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },

  // Divider
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textLight },

  // History
  historyEmpty: { textAlign: "center", color: Colors.textLight, fontFamily: "Inter_400Regular", fontSize: 14, marginBottom: 16 },
  historyList: { maxHeight: 200 },
  historyItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  historyLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  historyPts: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  historyDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight, marginTop: 2 },
  historyBadge: { backgroundColor: `${Colors.success}15`, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  historyBadgeText: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.success },
});
