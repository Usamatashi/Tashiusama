import React, { useCallback, useEffect, useState } from "react";
import {
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

const TIPS = [
  { step: "01", title: "Scan QR Codes", desc: "Scan after every vehicle service visit to earn points." },
  { step: "02", title: "Vehicle Points", desc: "Each vehicle model carries a different point value." },
  { step: "03", title: "Points Stack", desc: "All your scans accumulate into your total balance." },
  { step: "04", title: "Redeem Anytime", desc: "Claim your points to unlock exclusive rewards." },
];

export default function PointsScreen() {
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { refreshUser(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  }, [refreshUser]);

  const pts = user?.points ?? 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Points</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroEyebrow}>Total Balance</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>
          <Text style={styles.heroValue}>{pts.toLocaleString()}</Text>
          <Text style={styles.heroUnit}>points</Text>
          <View style={styles.heroDivider} />
          <Text style={styles.heroMetaText}>Accumulated from all your scans</Text>
        </View>

        {/* How to earn */}
        <Text style={styles.sectionLabel}>How to Earn Points</Text>
        <View style={styles.tipsList}>
          {TIPS.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={styles.tipStep}>
                <Text style={styles.tipStepText}>{tip.step}</Text>
              </View>
              <View style={styles.tipBody}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDesc}>{tip.desc}</Text>
              </View>
            </View>
          ))}
        </View>
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
  scroll: { padding: 16, gap: 20, paddingBottom: 40 },

  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: 28, padding: 28,
    overflow: "hidden",
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  heroEyebrow: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },
  liveIndicator: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4AFF91" },
  liveText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.white },
  heroValue: { fontSize: 68, fontFamily: "Inter_700Bold", color: Colors.white, lineHeight: 76 },
  heroUnit: { fontSize: 16, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)", marginTop: -4 },
  heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.2)", marginVertical: 18 },
  heroMetaText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)" },

  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, paddingHorizontal: 2 },
  tipsList: { gap: 10 },
  tipRow: {
    backgroundColor: Colors.white, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
    flexDirection: "row", alignItems: "center", gap: 16, padding: 16,
  },
  tipStep: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "#FFF0E6",
    justifyContent: "center", alignItems: "center",
  },
  tipStepText: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.primary },
  tipBody: { flex: 1 },
  tipTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  tipDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 17, marginTop: 2 },
});
