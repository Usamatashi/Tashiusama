import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Linking,
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

const BANNERS = [
  { id: 1, bg: Colors.primary, title: "Earn Points", subtitle: "Scan QR codes after every service" },
  { id: 2, bg: "#C5611A", title: "Redeem Rewards", subtitle: "Use your points for exclusive benefits" },
  { id: 3, bg: "#1A1A1A", title: "Track History", subtitle: "View all your scan activity" },
];

const WHATSAPP_NUMBER = "601234567890";

export default function UserHomeScreen() {
  const { user, refreshUser } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [bannerIndex, setBannerIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (bannerIndex + 1) % BANNERS.length;
      setBannerIndex(next);
      scrollRef.current?.scrollTo({ x: next * BANNER_WIDTH, animated: true });
    }, 3000);
    return () => clearInterval(interval);
  }, [bannerIndex]);

  const openWhatsApp = () => {
    Linking.openURL(`whatsapp://send?phone=${WHATSAPP_NUMBER}`);
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

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

        <View style={styles.pointsCard}>
          <Text style={styles.pointsLabel}>Total Points</Text>
          <Text style={styles.pointsValue}>{user?.points ?? 0}</Text>
          <Text style={styles.pointsUnit}>pts</Text>
        </View>

        <View style={styles.welcomeBox}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.welcomeEmail}>{user?.email}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
          </View>
        </View>
      </ScrollView>

      {user?.role === "mechanic" && (
        <View style={[styles.scanBarWrapper, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) }]}>
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
    </View>
  );
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
  bannerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.white },
  bannerSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)", marginTop: 4 },
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
  welcomeBox: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    gap: 4,
  },
  welcomeText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  welcomeEmail: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text },
  rolePill: {
    alignSelf: "flex-start",
    backgroundColor: `${Colors.primary}18`,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 4,
  },
  roleText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.primary },
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
});
