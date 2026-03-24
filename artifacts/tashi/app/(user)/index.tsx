import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
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

export default function UserHomeScreen() {
  const { user, refreshUser } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [bannerIndex, setBannerIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [claimModalVisible, setClaimModalVisible] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [localPoints, setLocalPoints] = useState<number | null>(null);

  const BANNERS = [
    {
      id: 0,
      bg: Colors.primary,
      title: `Welcome back!`,
      subtitle: user?.email || "",
      tag: user?.role?.toUpperCase() || "",
    },
    { id: 1, bg: "#C5611A", title: "Earn Points", subtitle: "Scan QR codes after every service", tag: "" },
    { id: 2, bg: "#2D2D2D", title: "Redeem Rewards", subtitle: "Use your points for exclusive benefits", tag: "" },
    { id: 3, bg: "#1A5276", title: "Track History", subtitle: "View all your scan activity", tag: "" },
  ];

  useEffect(() => {
    refreshUser();
  }, []);

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

  const openWhatsApp = () => {
    Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}`);
  };

  const handleClaimRewards = async () => {
    const pts = localPoints ?? user?.points ?? 0;
    if (pts <= 0) {
      Alert.alert("No Points", "You don't have any points to claim.");
      return;
    }
    setClaimModalVisible(true);
  };

  const confirmClaim = async () => {
    setClaiming(true);
    try {
      const token = await getToken();
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/claims`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to claim");
      }
      const data = await res.json();
      setLocalPoints(0);
      setClaimModalVisible(false);
      Alert.alert("Claimed!", `${data.pointsClaimed} points have been claimed successfully.`);
      await refreshUser();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setClaiming(false);
    }
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const displayPoints = localPoints ?? user?.points ?? 0;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.menuBtn}>
          <Feather name="menu" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Image
          source={require("../../assets/images/tashi-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <TouchableOpacity onPress={openWhatsApp} style={styles.waBtn}>
          <Feather name="message-circle" size={24} color="#25D366" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Sliding banners */}
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
          {BANNERS.map((b) => (
            <View key={b.id} style={[styles.banner, { backgroundColor: b.bg, width: BANNER_WIDTH }]}>
              {b.tag ? (
                <View style={styles.bannerTag}>
                  <Text style={styles.bannerTagText}>{b.tag}</Text>
                </View>
              ) : null}
              <Text style={styles.bannerTitle}>{b.title}</Text>
              <Text style={styles.bannerSubtitle}>{b.subtitle}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {BANNERS.map((_, i) => (
            <View key={i} style={[styles.dot, i === bannerIndex && styles.dotActive]} />
          ))}
        </View>

        {/* Points card */}
        <View style={styles.pointsCard}>
          <Text style={styles.pointsLabel}>Total Points</Text>
          <Text style={styles.pointsValue}>{displayPoints}</Text>
          <Text style={styles.pointsUnit}>pts</Text>
        </View>

        {/* Quick action icons */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(user)/history")} activeOpacity={0.8}>
            <View style={styles.actionIcon}>
              <Feather name="clock" size={26} color={Colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Scan History</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleClaimRewards} activeOpacity={0.8}>
            <View style={[styles.actionIcon, { backgroundColor: `${Colors.success}18` }]}>
              <Feather name="gift" size={26} color={Colors.success} />
            </View>
            <Text style={styles.actionLabel}>Claim Rewards</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {user?.role === "mechanic" && (
        <View style={[styles.scanBarWrapper, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8) }]}>
          <TouchableOpacity
            style={styles.scanBar}
            onPress={() => router.push("/(user)/scan")}
            activeOpacity={0.85}
          >
            <Feather name="camera" size={22} color={Colors.white} />
            <Text style={styles.scanBarText}>Scan QR Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Claim confirmation modal */}
      <Modal visible={claimModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalIconBox}>
              <Feather name="gift" size={36} color={Colors.success} />
            </View>
            <Text style={styles.modalTitle}>Claim Rewards</Text>
            <Text style={styles.modalDesc}>
              You are about to claim{" "}
              <Text style={{ fontFamily: "Inter_700Bold", color: Colors.primary }}>{displayPoints} points</Text>.
              {"\n"}Your points balance will reset to 0.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setClaimModalVisible(false)} disabled={claiming}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, claiming && { opacity: 0.6 }]} onPress={confirmClaim} disabled={claiming}>
                <Text style={styles.confirmBtnText}>{claiming ? "Claiming..." : "Confirm"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Helper to get token from AsyncStorage
async function getToken(): Promise<string> {
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  return (await AsyncStorage.getItem("tashi_token")) || "";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuBtn: { padding: 4 },
  logo: { width: 100, height: 44 },
  waBtn: { padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 32 },
  bannerScroll: { borderRadius: 16 },
  banner: {
    height: 160,
    borderRadius: 16,
    padding: 24,
    justifyContent: "flex-end",
    marginRight: 0,
  },
  bannerTag: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  bannerTagText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.white },
  bannerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.white },
  bannerSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)", marginTop: 4 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: -4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary, width: 18 },
  pointsCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
  },
  pointsLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)", marginBottom: 4 },
  pointsValue: { fontSize: 56, fontFamily: "Inter_700Bold", color: Colors.white, lineHeight: 64 },
  pointsUnit: { fontSize: 16, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)", marginTop: -4 },
  quickActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: `${Colors.primary}18`,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text, textAlign: "center" },
  scanBarWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  scanBar: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  scanBarText: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.white },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    gap: 16,
    alignItems: "center",
  },
  modalIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${Colors.success}15`,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  modalTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  modalDesc: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  modalBtns: { flexDirection: "row", gap: 12, width: "100%", marginTop: 4 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: { color: Colors.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  confirmBtn: {
    flex: 1,
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmBtnText: { color: Colors.white, fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
