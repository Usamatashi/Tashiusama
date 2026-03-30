import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, FontAwesome } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import TickerMarquee from "@/components/TickerMarquee";
import { BrakePadCard } from "@/components/BrakePadCard";

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

const BASE_QUICK_ACTIONS = [
  { label: "Scan History", desc: "All your scans", icon: "📋", route: "/(user)/history", accent: "#EDFBF3", iconBg: "#B8F0CE" },
  { label: "Rewards", desc: "Redeem points", icon: "🎁", route: "/(user)/rewards", accent: "#ECF5FF", iconBg: "#C2DCFF" },
];

const RETAILER_QUICK_ACTIONS = [
  { label: "Disc Pads", desc: "Browse disc pad products", icon: "circle" as const, route: "/(user)/products", accent: "#FFF4EC", iconBg: "#FFEDD5", iconColor: "#E87722" },
  { label: "Brake Shoes", desc: "Browse catalog", icon: "truck" as const, route: "/(user)/products", accent: "#EFF6FF", iconBg: "#DBEAFE", iconColor: "#2563EB" },
];

const SALESMAN_QUICK_ACTIONS = [
  { label: "Disc Pads", desc: "Browse disc pad products", icon: "circle" as const, route: "/(user)/products", accent: "#FFF4EC", iconBg: "#FFEDD5", iconColor: "#E87722" },
  { label: "Brake Shoes", desc: "Browse catalog", icon: "truck" as const, route: "/(user)/products", accent: "#EFF6FF", iconBg: "#DBEAFE", iconColor: "#2563EB" },
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
  const [salesSummary, setSalesSummary] = useState<{ totalSalesValue: number; confirmedSalesValue: number; confirmedBonus: number; totalOrders: number } | null>(null);
  const [retailStats, setRetailStats] = useState<{ confirmedCount: number; confirmedValue: number }>({ confirmedCount: 0, confirmedValue: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const fetchAdsTickers = useCallback(async () => {
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
  }, []);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getToken();
      if (user.role === "salesman") {
        const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/orders/my-bonus`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSalesSummary({ totalSalesValue: data.totalSalesValue, confirmedSalesValue: data.confirmedSalesValue, confirmedBonus: data.confirmedBonus ?? 0, totalOrders: data.totalOrders });
        }
      } else if (user.role === "retailer") {
        const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/orders/my-retail-orders`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const orders: Array<{ totalValue?: number; status: string }> = await res.json();
          const confirmed = orders.filter(o => o.status === "confirmed");
          setRetailStats({
            confirmedCount: confirmed.length,
            confirmedValue: confirmed.reduce((s, o) => s + (o.totalValue ?? 0), 0),
          });
        }
      }
    } catch {}
  }, [user?.role]);

  useEffect(() => { fetchAdsTickers(); }, [fetchAdsTickers]);
  useEffect(() => { refreshUser(); }, []);
  useEffect(() => {
    if (user?.points !== undefined) setLocalPoints(user.points);
  }, [user?.points]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshUser(), fetchAdsTickers(), fetchStats()]);
    setRefreshing(false);
  }, [refreshUser, fetchAdsTickers, fetchStats]);

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
  const firstName = user?.name?.split(" ")[0] || user?.phone || "there";
  const tickerText = tickers.map((t) => t.text).join("          •          ");

  const isRetailer = user?.role === "retailer";
  const isSalesman = user?.role === "salesman";
  const isMechanic = !isRetailer && !isSalesman;

  const quickActions = isRetailer
    ? RETAILER_QUICK_ACTIONS
    : isSalesman
    ? SALESMAN_QUICK_ACTIONS
    : BASE_QUICK_ACTIONS;

  const headerSub = isSalesman
    ? "Your sales dashboard"
    : isRetailer
    ? "Your order dashboard"
    : "Your loyalty dashboard";

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreet}>Hello, {firstName} 👋</Text>
          <Text style={styles.headerSub}>{headerSub}</Text>
        </View>
        <TouchableOpacity
          onPress={() => Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}`)}
          style={styles.waBtn}
        >
          <FontAwesome name="whatsapp" size={22} color="#25D366" />
        </TouchableOpacity>
      </View>

      {tickerText.length > 0 && <TickerMarquee text={tickerText} height={32} />}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >

        {/* ── Points Hero Card — mechanics only ─────────────── */}
        {isMechanic && (
          <View style={styles.heroWrapper}>
            <LinearGradient
              colors={["#F09135", "#E87722", "#C5611A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.decCircle1} />
              <View style={styles.decCircle2} />
              <View style={styles.decCircle3} />
              <Text style={styles.heroLabel}>Available Points</Text>
              <Text style={styles.heroValue}>{displayPoints}</Text>
              <Text style={styles.heroUnit}>points</Text>
            </LinearGradient>

            <TouchableOpacity onPress={openClaimModal} activeOpacity={0.85} style={styles.claimTabOuter}>
              <LinearGradient
                colors={["#C5611A", "#A84E14"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.claimTabInner}
              >
                <Text style={styles.claimTabIcon}>🎁</Text>
                <Text style={styles.claimTabText}>Claim{"\n"}Rewards</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Sales Financial Hero Card — salesman only ─────────────── */}
        {isSalesman && (
          <LinearGradient
            colors={["#0F4C75", "#1B6CA8", "#187CC2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.decCircle1} />
            <View style={styles.decCircle2} />
            <View style={styles.decCircle3} />
            <Text style={styles.heroLabel}>Total Sales Value</Text>
            <Text style={[styles.heroValue, { fontSize: 34 }]}>
              {salesSummary ? `Rs. ${salesSummary.totalSalesValue.toLocaleString()}` : "—"}
            </Text>
            <Text style={styles.heroUnit}>
              {salesSummary ? `${salesSummary.totalOrders} order${salesSummary.totalOrders !== 1 ? "s" : ""} placed` : "loading..."}
            </Text>
          </LinearGradient>
        )}

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
                <LinearGradient
                  key={i}
                  colors={[b.bg, "#1A1A1A"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.banner, { width: BANNER_WIDTH }]}
                >
                  <Text style={styles.bannerTitle}>{b.title}</Text>
                  <Text style={styles.bannerSubtitle}>{b.subtitle}</Text>
                </LinearGradient>
              ))}
        </ScrollView>
        {(isRetailer || isSalesman) ? (
          <View style={{ gap: 4 }}>
            <View style={styles.dots}>
              {activeBanners.map((_, i) => (
                <View key={i} style={[styles.dot, i === bannerIndex && styles.dotActive]} />
              ))}
            </View>
            <BrakePadCard
              leftAction={{ label: quickActions[0].label, desc: quickActions[0].desc, route: quickActions[0].route, icon: (quickActions[0] as any).icon, iconColor: (quickActions[0] as any).iconColor, iconBg: (quickActions[0] as any).iconBg }}
              rightAction={{ label: quickActions[1].label, desc: quickActions[1].desc, route: quickActions[1].route, icon: (quickActions[1] as any).icon, iconColor: (quickActions[1] as any).iconColor, iconBg: (quickActions[1] as any).iconBg }}
              centerRoute="/(user)/orders"
              centerLabel="ORDER"
            />
          </View>
        ) : (
          <View style={styles.dots}>
            {activeBanners.map((_, i) => (
              <View key={i} style={[styles.dot, i === bannerIndex && styles.dotActive]} />
            ))}
          </View>
        )}

        {/* ── Salesman stat cards ─────────────────────────────────────── */}
        {isSalesman && (
          <View style={styles.statRow}>
            <View style={[styles.statCard, { backgroundColor: "#0F4C75" }]}>
              <Text style={styles.statCardLabel}>Confirmed Sales</Text>
              <Text style={styles.statCardValue}>
                {salesSummary ? `Rs. ${salesSummary.confirmedSalesValue.toLocaleString()}` : "—"}
              </Text>
              <Text style={styles.statCardSub}>orders confirmed</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: "#92400E" }]}>
              <Text style={styles.statCardLabel}>Commission</Text>
              <Text style={styles.statCardValue}>
                {salesSummary ? `${salesSummary.confirmedBonus.toLocaleString()} pts` : "—"}
              </Text>
              <Text style={styles.statCardSub}>bonus points earned</Text>
            </View>
          </View>
        )}

        {/* ── Retailer stat cards ──────────────────────────────────────── */}
        {isRetailer && (
          <View style={styles.statRow}>
            <TouchableOpacity
              style={[styles.statCard, { backgroundColor: "#065F46" }]}
              onPress={() => router.push("/(user)/orders" as any)}
              activeOpacity={0.82}
            >
              <Text style={styles.statCardLabel}>Confirmed Orders</Text>
              <Text style={styles.statCardValue}>{retailStats.confirmedCount}</Text>
              <Text style={styles.statCardSub}>
                {retailStats.confirmedValue > 0 ? `Rs. ${retailStats.confirmedValue.toLocaleString()}` : "tap to view"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statCard, { backgroundColor: "#7B2FBE" }]}
              onPress={() => router.push("/(user)/rewards" as any)}
              activeOpacity={0.82}
            >
              <Text style={styles.statCardLabel}>Offers</Text>
              <Text style={styles.statCardValue}>🎁</Text>
              <Text style={styles.statCardSub}>view rewards & offers</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick actions — mechanics only */}
        {!isRetailer && !isSalesman && (
          <>
            <Text style={styles.sectionLabel}>Quick Actions</Text>
            <View style={styles.quickGrid}>
              {quickActions.map((action, i) => (
                <TouchableOpacity
                  key={action.label}
                  style={[
                    styles.gridCard,
                    { backgroundColor: action.accent },
                    i === 0 ? { borderBottomRightRadius: 36 } : { borderBottomLeftRadius: 36 },
                  ]}
                  onPress={() => router.push(action.route as any)}
                  activeOpacity={0.82}
                >
                  <View style={[styles.gridIcon, { backgroundColor: action.iconBg }]}>
                    <Text style={styles.gridIconText}>{action.icon}</Text>
                  </View>
                  <Text style={styles.gridCardTitle}>{action.label}</Text>
                  <Text style={styles.gridCardDesc}>{action.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
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
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#E8F8EF",
    justifyContent: "center", alignItems: "center",
  },
  waBtnText: { fontSize: 20 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 18, paddingBottom: 32 },

  /* ── Hero Points Card ─────────────────────────────────────────── */
  heroWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroCard: {
    flex: 1,
    aspectRatio: undefined,
    minHeight: 170,
    borderRadius: 24,
    padding: 22,
    justifyContent: "flex-end",
    overflow: "hidden",
    zIndex: 1,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  decCircle1: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -30, right: -30,
  },
  decCircle2: {
    position: "absolute", width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: 20, right: 10,
  },
  decCircle3: {
    position: "absolute", width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(0,0,0,0.08)",
    bottom: -15, left: -15,
  },
  heroLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
    lineHeight: 52,
    includeFontPadding: false,
  },
  heroUnit: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },

  /* ── Stat mini-cards ────────────────────────────────────────────── */
  statRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    justifyContent: "flex-end",
    minHeight: 110,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  statCardLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  statCardValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
    includeFontPadding: false,
  },
  statCardSub: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    marginTop: 3,
  },

  /* Claim tab — protrudes from the right edge of the hero card */
  claimTabOuter: {
    marginLeft: -2,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#8B3A0A",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 4, height: 4 },
    elevation: 6,
  },
  claimTabInner: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 6,
  },
  claimTabIcon: { fontSize: 20 },
  claimTabText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
    textAlign: "center",
    lineHeight: 16,
  },

  bannerScroll: { borderRadius: 18 },
  banner: { height: 140, borderRadius: 18, padding: 20, justifyContent: "flex-end", gap: 4 },
  bannerImage: { height: 140, borderRadius: 18 },
  bannerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.white },
  bannerSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.82)" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: -8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#D9C9BF" },
  dotActive: { backgroundColor: Colors.primary, width: 16 },

  sectionLabel: {
    fontSize: 13, fontFamily: "Inter_700Bold",
    color: Colors.textSecondary, letterSpacing: 0.5,
    textTransform: "uppercase", marginBottom: -4,
  },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridCard: {
    width: "47%",
    borderRadius: 20, padding: 16,
    gap: 8,
    alignItems: "center",
  },
  gridIcon: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
    marginBottom: 2,
  },
  gridIconText: { fontSize: 22 },
  gridCardTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  gridCardDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },


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
