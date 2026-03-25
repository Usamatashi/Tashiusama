import React, { useEffect } from "react";
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

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  salesman: "Salesman",
  mechanic: "Mechanic",
  retailer: "Retailer",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "#8B5CF6",
  salesman: "#3B82F6",
  mechanic: "#F59E0B",
  retailer: Colors.primary,
};

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => { refreshUser(); }, []);

  const roleColor = ROLE_COLORS[user?.role || ""] || Colors.primary;
  const roleLabel = ROLE_LABELS[user?.role || ""] || user?.role || "-";
  const initial = user?.email?.[0]?.toUpperCase() || "U";
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long" })
    : "-";

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar hero */}
        <View style={styles.heroCard}>
          <View style={[styles.avatarOuter, { borderColor: `${roleColor}40` }]}>
            <View style={[styles.avatarInner, { backgroundColor: roleColor }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          </View>
          <Text style={styles.heroEmail}>{user?.email}</Text>
          <View style={[styles.rolePill, { backgroundColor: `${roleColor}18` }]}>
            <View style={[styles.roleDot, { backgroundColor: roleColor }]} />
            <Text style={[styles.rolePillText, { color: roleColor }]}>{roleLabel}</Text>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{user?.points ?? 0}</Text>
              <Text style={styles.heroStatLabel}>Points</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{memberSince.split(" ")[1] || "-"}</Text>
              <Text style={styles.heroStatLabel}>Member Since</Text>
            </View>
          </View>
        </View>

        {/* Info rows */}
        <View style={styles.infoCard}>
          <InfoRow icon="mail" label="Email" value={user?.email || "-"} />
          <InfoRow icon="shield" label="Role" value={roleLabel} valueColor={roleColor} />
          <InfoRow icon="star" label="Total Points" value={`${user?.points ?? 0} pts`} valueColor={Colors.primary} />
          <InfoRow icon="calendar" label="Member Since" value={memberSince} last />
        </View>

        <View style={styles.noteCard}>
          <Feather name="info" size={14} color={Colors.textLight} />
          <Text style={styles.noteText}>Contact your admin to update profile information.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value, valueColor, last }: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowIcon}>
        <Feather name={icon} size={16} color={Colors.textSecondary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      </View>
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
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },

  heroCard: {
    backgroundColor: Colors.white,
    borderRadius: 24, padding: 24,
    alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  avatarOuter: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, justifyContent: "center", alignItems: "center",
    marginBottom: 4,
  },
  avatarInner: {
    width: 82, height: 82, borderRadius: 41,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 34, fontFamily: "Inter_700Bold", color: Colors.white },
  heroEmail: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.text, textAlign: "center" },
  rolePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },
  roleDot: { width: 7, height: 7, borderRadius: 4 },
  rolePillText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  heroStats: {
    flexDirection: "row", alignItems: "center",
    marginTop: 8, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: Colors.border, width: "100%",
    justifyContent: "center", gap: 32,
  },
  heroStat: { alignItems: "center", gap: 2 },
  heroStatValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  heroStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  heroStatDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  infoCard: {
    backgroundColor: Colors.white, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 15, gap: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#F5F5F5", justifyContent: "center", alignItems: "center",
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  rowValue: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text, marginTop: 1 },

  noteCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  noteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
});
