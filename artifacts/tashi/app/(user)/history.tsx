import React, { useEffect, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

interface Scan {
  id: number;
  qrNumber: string;
  vehicleName: string;
  pointsEarned: number;
  scannedAt: string;
}

export default function HistoryScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScans = async () => {
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/scans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setScans(data.reverse());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchScans(); }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan History</Text>
      </View>
      <FlatList
        data={scans}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={fetchScans}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="clock" size={48} color={Colors.border} />
            <Text style={styles.emptyText}>No scans yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.vehicle}>{item.vehicleName}</Text>
              <Text style={styles.qrNum}>QR: {item.qrNumber}</Text>
              <Text style={styles.date}>{formatDate(item.scannedAt)}</Text>
            </View>
            <View style={styles.ptsBox}>
              <Text style={styles.ptsValue}>+{item.pointsEarned}</Text>
              <Text style={styles.ptsLabel}>pts</Text>
            </View>
          </View>
        )}
      />
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
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardLeft: { flex: 1 },
  vehicle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text },
  qrNum: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  date: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight, marginTop: 4 },
  ptsBox: { alignItems: "center", minWidth: 60 },
  ptsValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.primary },
  ptsLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.textLight },
});
