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

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => { refreshUser(); }, []);

  const ROLE_LABELS: Record<string, string> = {
    admin: "Admin",
    salesman: "Salesman",
    mechanic: "Mechanic",
    retailer: "Retailer",
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.email?.[0]?.toUpperCase() || "U"}</Text>
          </View>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{ROLE_LABELS[user?.role || ""] || user?.role}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Row label="Email" value={user?.email || "-"} />
          <Row label="Role" value={ROLE_LABELS[user?.role || ""] || user?.role || "-"} />
          <Row label="Total Points" value={String(user?.points ?? 0)} highlight />
          <Row label="Member Since" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "-"} last />
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, highlight, last }: { label: string; value: string; highlight?: boolean; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>{value}</Text>
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
  avatarSection: { alignItems: "center", gap: 10, paddingVertical: 16 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 32, fontFamily: "Inter_700Bold", color: Colors.white },
  email: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.text },
  rolePill: {
    backgroundColor: `${Colors.primary}18`,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  rolePillText: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.primary },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  row: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  rowValue: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  rowValueHighlight: { color: Colors.primary, fontSize: 18 },
});
