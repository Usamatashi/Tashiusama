import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

interface Scan {
  id: number;
  vehicleName: string;
  pointsEarned: number;
  scannedAt: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

export default function HistoryScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScans = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/scans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setScans(data.reverse());
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchScans(); }, []);

  const totalPoints = scans.reduce((sum, s) => sum + s.pointsEarned, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan History</Text>
        {scans.length > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{scans.length} scans</Text>
          </View>
        )}
      </View>

      {scans.length > 0 && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalPoints}</Text>
            <Text style={styles.summaryLabel}>total points</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{scans.length}</Text>
            <Text style={styles.summaryLabel}>total scans</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={scans}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchScans}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No Scans Yet</Text>
              <Text style={styles.emptyText}>Your scan history will appear here after your first QR scan.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const { date, time } = formatDate(item.scannedAt);
            return (
              <View style={styles.card}>
                <View style={styles.timelineCol}>
                  <View style={styles.timelineDot} />
                  {index < scans.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.cardContent}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.vehicleName}>{item.vehicleName}</Text>
                    <Text style={styles.scanDate}>{date} · {time}</Text>
                  </View>
                  <View style={styles.ptsBox}>
                    <Text style={styles.ptsValue}>+{item.pointsEarned}</Text>
                    <Text style={styles.ptsLabel}>pts</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F4F1" },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  headerBadge: {
    backgroundColor: `${Colors.primary}15`, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  headerBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary },

  summaryBar: {
    backgroundColor: Colors.white,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 12, gap: 24,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  summaryItem: { alignItems: "center", gap: 2 },
  summaryValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  summaryDivider: { width: 1, height: 28, backgroundColor: Colors.border },

  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { paddingVertical: 16, paddingHorizontal: 16, paddingBottom: 40 },

  empty: { alignItems: "center", paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.text },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },

  card: { flexDirection: "row", gap: 0, marginBottom: 0 },
  timelineCol: { alignItems: "center", width: 28 },
  timelineDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.primary, marginTop: 18,
    borderWidth: 2, borderColor: Colors.white,
  },
  timelineLine: { flex: 1, width: 2, backgroundColor: Colors.border, marginVertical: 2 },

  cardContent: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.white, borderRadius: 18,
    padding: 14, marginBottom: 10, marginLeft: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardInfo: { flex: 1 },
  vehicleName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  scanDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 3 },
  ptsBox: { alignItems: "flex-end" },
  ptsValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.primary },
  ptsLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
});
