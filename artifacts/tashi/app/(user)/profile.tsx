import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

const PROFILE_PIC_KEY = "tashi_profile_pic";

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
  const { user, refreshUser, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [profilePic, setProfilePic] = useState<string | null>(null);

  useEffect(() => {
    refreshUser();
    AsyncStorage.getItem(PROFILE_PIC_KEY).then((uri) => {
      if (uri) setProfilePic(uri);
    });
  }, []);

  const isRetailer = user?.role === "retailer";
  const isSalesman = user?.role === "salesman";
  const isMechanic = user?.role === "mechanic";
  const roleColor = ROLE_COLORS[user?.role || ""] || Colors.primary;
  const roleLabel = ROLE_LABELS[user?.role || ""] || user?.role || "-";
  const initial = user?.name?.[0]?.toUpperCase() || user?.phone?.[0]?.toUpperCase() || "U";
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long" })
    : "-";

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library to update your profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setProfilePic(uri);
      await AsyncStorage.setItem(PROFILE_PIC_KEY, uri);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar hero */}
        <View style={styles.heroCard}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={styles.avatarWrap}>
            <View style={[styles.avatarOuter, { borderColor: `${roleColor}40` }]}>
              {profilePic ? (
                <Image source={{ uri: profilePic }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarInner, { backgroundColor: roleColor }]}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
            </View>
            <View style={[styles.cameraBtn, { backgroundColor: roleColor }]}>
              <Feather name="camera" size={13} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.heroEmail}>{user?.name || user?.phone}</Text>
          <View style={[styles.rolePill, { backgroundColor: `${roleColor}18` }]}>
            <View style={[styles.roleDot, { backgroundColor: roleColor }]} />
            <Text style={[styles.rolePillText, { color: roleColor }]}>{roleLabel}</Text>
          </View>

          <View style={styles.heroStats}>
            {isRetailer ? (
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue} numberOfLines={1} adjustsFontSizeToFit>
                  {user?.phone || "-"}
                </Text>
                <Text style={styles.heroStatLabel}>Phone</Text>
              </View>
            ) : isSalesman ? (
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue} numberOfLines={1} adjustsFontSizeToFit>
                  {user?.city || "-"}
                </Text>
                <Text style={styles.heroStatLabel}>City</Text>
              </View>
            ) : (
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{user?.points ?? 0}</Text>
                <Text style={styles.heroStatLabel}>Points</Text>
              </View>
            )}
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{memberSince.split(" ")[1] || "-"}</Text>
              <Text style={styles.heroStatLabel}>Member Since</Text>
            </View>
          </View>
        </View>

        {/* Info rows */}
        <View style={styles.infoCard}>
          <InfoRow label="Name" value={user?.name || "-"} />
          <InfoRow label="Phone" value={user?.phone || "-"} />
          {!isSalesman && !isMechanic && (
            <InfoRow label="Role" value={roleLabel} valueColor={roleColor} />
          )}
          {!isRetailer && !isSalesman && !isMechanic && (
            <InfoRow label="Total Points" value={`${user?.points ?? 0} pts`} valueColor={Colors.primary} />
          )}
          <InfoRow label="Member Since" value={memberSince} last />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.82}>
          <View style={styles.logoutBtnInner}>
            <Feather name="log-out" size={18} color="#fff" />
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, valueColor, last }: {
  label: string;
  value: string;
  valueColor?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
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
  avatarWrap: {
    position: "relative",
    marginBottom: 4,
  },
  avatarOuter: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, justifyContent: "center", alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 90, height: 90, borderRadius: 45,
  },
  avatarInner: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 34, fontFamily: "Inter_700Bold", color: Colors.white },
  cameraBtn: {
    position: "absolute",
    bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: Colors.white,
  },
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
  heroStat: { alignItems: "center", gap: 2, flex: 1 },
  heroStatValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  heroStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  heroStatDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  infoCard: {
    backgroundColor: Colors.white, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 15 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  rowValue: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },

  logoutBtn: {
    backgroundColor: "#EF4444",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutBtnInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16,
  },
  logoutBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.3 },
});
