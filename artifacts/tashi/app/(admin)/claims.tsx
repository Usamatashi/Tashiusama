import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

interface Claim {
  id: number;
  pointsClaimed: number;
  claimedAt: string;
  userEmail: string;
  userRole: string;
  userId: number;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    "  " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function AdminClaimsScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/claims`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setClaims(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchClaims(); }, [fetchClaims]));

  const totalPoints = claims.reduce((sum, c) => sum + c.pointsClaimed, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Claimed Rewards</Text>
        <TouchableOpacity onPress={fetchClaims} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={20} color={Colors.adminAccent} />
        </TouchableOpacity>
      </View>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{claims.length}</Text>
          <Text style={styles.summaryLabel}>Total Claims</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalPoints}</Text>
          <Text style={styles.summaryLabel}>Points Claimed</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.adminAccent} />
        </View>
      ) : (
        <FlatList
          data={claims}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchClaims}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="gift" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No claims yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{item.userEmail?.[0]?.toUpperCase() || "?"}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardEmail} numberOfLines={1}>{item.userEmail}</Text>
                  <Text style={styles.cardRole}>{item.userRole?.toUpperCase()}</Text>
                  <Text style={styles.cardDate}>{formatDate(item.claimedAt)}</Text>
                </View>
              </View>
              <View style={styles.pointsBadge}>
                <Text style={styles.pointsBadgeText}>{item.pointsClaimed}</Text>
                <Text style={styles.pointsBadgeUnit}>pts</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.adminBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminText },
  refreshBtn: { padding: 8 },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: Colors.adminAccent,
    margin: 16,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryValue: { fontSize: 32, fontFamily: "Inter_700Bold", color: Colors.white },
  summaryLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)" },
  summaryDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.3)" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 12 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { color: Colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 15 },
  card: {
    backgroundColor: Colors.adminCard,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Colors.adminAccent}20`,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  cardInfo: { flex: 1, gap: 2 },
  cardEmail: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  cardRole: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textSecondary },
  cardDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight, marginTop: 2 },
  pointsBadge: {
    backgroundColor: `${Colors.adminAccent}18`,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  pointsBadgeText: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  pointsBadgeUnit: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.adminAccent },
});
