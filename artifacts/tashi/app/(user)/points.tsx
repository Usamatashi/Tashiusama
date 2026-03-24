import React, { useEffect } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

export default function PointsScreen() {
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => { refreshUser(); }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Points</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.pointsHero}>
          <Text style={styles.heroLabel}>Total Points Earned</Text>
          <Text style={styles.heroValue}>{user?.points ?? 0}</Text>
          <Text style={styles.heroUnit}>points</Text>
        </View>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>How to earn more points</Text>
          {[
            "Scan QR codes after every vehicle service",
            "Each vehicle has a fixed point value",
            "Points accumulate across all scans",
            "Redeem points for rewards",
          ].map((tip, i) => (
            <View key={i} style={styles.tip}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
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
  scroll: { padding: 20, gap: 20 },
  pointsHero: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    padding: 40,
    alignItems: "center",
  },
  heroLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)", marginBottom: 8 },
  heroValue: { fontSize: 72, fontFamily: "Inter_700Bold", color: Colors.white, lineHeight: 80 },
  heroUnit: { fontSize: 16, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)" },
  tipsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tipsTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 4 },
  tip: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 7 },
  tipText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 20 },
});
