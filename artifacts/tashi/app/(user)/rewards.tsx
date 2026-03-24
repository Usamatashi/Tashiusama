import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

const REWARDS = [
  { points: 500, title: "Oil Change Voucher", desc: "Free oil change at any Tashi partner" },
  { points: 1000, title: "Tire Check", desc: "Free tire inspection & balancing" },
  { points: 2000, title: "Service Discount", desc: "20% off your next full service" },
  { points: 5000, title: "Premium Package", desc: "Full vehicle service package" },
];

export default function RewardsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rewards</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.pointsBanner}>
          <Text style={styles.bannerLabel}>Your Points</Text>
          <Text style={styles.bannerPoints}>{user?.points ?? 0} pts</Text>
        </View>

        <Text style={styles.sectionTitle}>Available Rewards</Text>
        {REWARDS.map((r) => {
          const canRedeem = (user?.points ?? 0) >= r.points;
          return (
            <View key={r.title} style={[styles.rewardCard, !canRedeem && styles.rewardCardLocked]}>
              <View style={styles.rewardIcon}>
                <Feather name="gift" size={24} color={canRedeem ? Colors.primary : Colors.textLight} />
              </View>
              <View style={styles.rewardInfo}>
                <Text style={[styles.rewardTitle, !canRedeem && styles.rewardTitleLocked]}>{r.title}</Text>
                <Text style={styles.rewardDesc}>{r.desc}</Text>
                <Text style={[styles.rewardPts, !canRedeem && styles.rewardPtsLocked]}>{r.points} pts required</Text>
              </View>
              {canRedeem && (
                <View style={styles.redeemBadge}>
                  <Text style={styles.redeemText}>Available</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  scroll: { padding: 16, gap: 16 },
  pointsBanner: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerLabel: { fontSize: 16, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.9)" },
  bannerPoints: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.white },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  rewardCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rewardCardLocked: { opacity: 0.55 },
  rewardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${Colors.primary}12`,
    justifyContent: "center",
    alignItems: "center",
  },
  rewardInfo: { flex: 1 },
  rewardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  rewardTitleLocked: { color: Colors.textSecondary },
  rewardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  rewardPts: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.primary, marginTop: 4 },
  rewardPtsLocked: { color: Colors.textLight },
  redeemBadge: {
    backgroundColor: `${Colors.success}18`,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  redeemText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.success },
});
