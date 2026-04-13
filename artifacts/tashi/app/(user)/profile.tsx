import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { BackButton } from "@/components/BackButton";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

const profilePicKey = (userId?: number) => `tashi_profile_pic_${userId ?? "unknown"}`;

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
  const { user, refreshUser, logout, changePassword } = useAuth();
  const insets = useSafeAreaInsets();
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => { refreshUser(); }, []);

  useEffect(() => {
    if (!user?.id) return;
    AsyncStorage.getItem(profilePicKey(user.id)).then((uri) => {
      if (uri) setProfilePic(uri);
    });
  }, [user?.id]);

  const isRetailer = user?.role === "retailer";
  const roleColor = ROLE_COLORS[user?.role || ""] || Colors.primary;
  const roleLabel = ROLE_LABELS[user?.role || ""] || user?.role || "-";
  const initial = user?.name?.[0]?.toUpperCase() || user?.phone?.[0]?.toUpperCase() || "U";
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long" })
    : "-";

  const closeChangePw = () => {
    setShowChangePw(false);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setShowCurrentPw(false); setShowNewPw(false); setShowConfirmPw(false);
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      Alert.alert("Missing fields", "Please fill in all fields."); return;
    }
    if (newPw.length < 6) {
      Alert.alert("Too short", "New password must be at least 6 characters."); return;
    }
    if (newPw !== confirmPw) {
      Alert.alert("Mismatch", "New passwords do not match."); return;
    }
    setChangingPw(true);
    try {
      await changePassword(currentPw, newPw);
      closeChangePw();
      Alert.alert("Success", "Your password has been updated.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to change password.");
    } finally {
      setChangingPw(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library to update your profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setProfilePic(uri);
      await AsyncStorage.setItem(profilePicKey(user?.id), uri);
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 32 }}>

        {/* ── Gradient Hero ── */}
        <LinearGradient
          colors={[roleColor, `${roleColor}CC`, `${roleColor}88`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: topPad + 16 }]}
        >
          {/* Decorative circles */}
          <View style={[styles.decCircle, { width: 180, height: 180, top: -40, right: -40, opacity: 0.12 }]} />
          <View style={[styles.decCircle, { width: 100, height: 100, top: 20, left: -20, opacity: 0.1 }]} />
          <View style={[styles.decCircle, { width: 60, height: 60, bottom: 20, right: 60, opacity: 0.15 }]} />

          {/* Back button */}
          <View style={[styles.heroBack, { top: topPad + 8 }]}>
            <BackButton dark />
          </View>

          {/* Avatar */}
          <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={styles.avatarWrap}>
            <View style={styles.avatarGlow}>
              <View style={styles.avatarRing}>
                {profilePic ? (
                  <Image source={{ uri: profilePic }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarInner, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.cameraBtn}>
              <Feather name="camera" size={14} color={roleColor} />
            </View>
          </TouchableOpacity>

          <Text style={styles.heroName}>{user?.name || user?.phone || "User"}</Text>

          {!isRetailer && (
            <View style={styles.roleBadge}>
              <Text style={[styles.roleBadgeText, { color: roleColor }]}>{roleLabel}</Text>
            </View>
          )}

          <View style={{ height: 50 }} />
        </LinearGradient>

        {/* ── Floating Stats Card ── */}
        <View style={styles.statsCardWrap}>
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <View style={styles.statIconWrap}>
                <Feather name="phone" size={15} color={roleColor} />
              </View>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {user?.phone || "-"}
              </Text>
              <Text style={styles.statLabel}>Phone</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={styles.statIconWrap}>
                <Feather name="calendar" size={15} color={roleColor} />
              </View>
              <Text style={styles.statValue}>{memberSince.split(" ")[1] || "-"}</Text>
              <Text style={styles.statLabel}>Member Since</Text>
            </View>
          </View>
        </View>

        {/* ── Action Section ── */}
        <View style={styles.actionsWrap}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setShowChangePw(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: `${Colors.primary}15` }]}>
              <Feather name="lock" size={18} color={Colors.primary} />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Change Password</Text>
              <Text style={styles.actionSub}>Update your account password</Text>
            </View>
            <View style={styles.actionChevron}>
              <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>

        </View>

        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={logout}
          activeOpacity={0.82}
        >
          <View style={styles.signOutIconWrap}>
            <Feather name="log-out" size={18} color="#EF4444" />
          </View>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Change Password Modal ── */}
      <Modal visible={showChangePw} transparent animationType="slide" onRequestClose={closeChangePw}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeChangePw} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <View style={[styles.actionIconBox, { backgroundColor: `${Colors.primary}15` }]}>
                <Feather name="lock" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Change Password</Text>
                <Text style={styles.modalSubtitle}>Enter your current then new password</Text>
              </View>
            </View>

            <PwField label="Current Password" value={currentPw} onChangeText={setCurrentPw} show={showCurrentPw} toggleShow={() => setShowCurrentPw(v => !v)} />
            <PwField label="New Password" value={newPw} onChangeText={setNewPw} show={showNewPw} toggleShow={() => setShowNewPw(v => !v)} />
            <PwField label="Confirm New Password" value={confirmPw} onChangeText={setConfirmPw} show={showConfirmPw} toggleShow={() => setShowConfirmPw(v => !v)} />

            <TouchableOpacity
              style={[styles.submitBtn, changingPw && { opacity: 0.7 }]}
              onPress={handleChangePassword}
              disabled={changingPw}
              activeOpacity={0.82}
            >
              {changingPw
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Update Password</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={closeChangePw} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function PwField({ label, value, onChangeText, show, toggleShow }: {
  label: string; value: string;
  onChangeText: (v: string) => void;
  show: boolean; toggleShow: () => void;
}) {
  return (
    <View style={styles.pwFieldWrap}>
      <Text style={styles.pwFieldLabel}>{label}</Text>
      <View style={styles.pwInputRow}>
        <TextInput
          style={styles.pwInput}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          placeholder="Enter password"
          placeholderTextColor={Colors.textLight}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={toggleShow} style={styles.pwEyeBtn}>
          <Feather name={show ? "eye-off" : "eye"} size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },

  hero: {
    alignItems: "center",
    paddingBottom: 0,
    overflow: "hidden",
    position: "relative",
    paddingHorizontal: 24,
  },
  heroBack: {
    position: "absolute",
    left: 12,
  },
  decCircle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#fff",
  },

  avatarWrap: { position: "relative", marginBottom: 14 },
  avatarGlow: {
    width: 112, height: 112, borderRadius: 56,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  avatarRing: {
    width: 112, height: 112, borderRadius: 56,
    borderWidth: 3, borderColor: "rgba(255,255,255,0.7)",
    overflow: "hidden", justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  avatarImage: { width: 106, height: 106, borderRadius: 53 },
  avatarInner: {
    width: 106, height: 106, borderRadius: 53,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 38, fontFamily: "Inter_700Bold", color: "#fff" },
  cameraBtn: {
    position: "absolute", bottom: 2, right: 2,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.9)",
  },
  heroName: {
    fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff",
    textAlign: "center", letterSpacing: 0.3,
    textShadowColor: "rgba(0,0,0,0.15)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  roleBadge: {
    marginTop: 6, marginBottom: 4,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 5,
  },
  roleBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

  statsCardWrap: {
    marginHorizontal: 20,
    marginTop: -28,
    marginBottom: 20,
  },
  statsCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 20,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${Colors.primary}12`,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  statValue: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  statDivider: { width: 1, backgroundColor: "#F0F0F0", marginVertical: 8 },

  actionsWrap: {
    marginHorizontal: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  actionCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 18, paddingVertical: 16,
  },
  actionSep: { height: 1, backgroundColor: "#F5F5F5", marginHorizontal: 18 },
  actionIconBox: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  actionTextWrap: { flex: 1 },
  actionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  actionSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  actionChevron: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#F5F5F5",
    alignItems: "center", justifyContent: "center",
  },

  signOutBtn: {
    marginHorizontal: 20,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#EF4444",
    shadowColor: "#EF4444",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  signOutIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "#FEE2E2",
    alignItems: "center", justifyContent: "center",
  },
  signOutText: {
    fontSize: 16, fontFamily: "Inter_700Bold",
    color: "#EF4444", letterSpacing: 0.3,
  },

  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16,
    elevation: 20,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E5E5",
    alignSelf: "center", marginBottom: 20,
  },
  modalHeaderRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  modalSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },

  pwFieldWrap: { marginBottom: 14 },
  pwFieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  pwInputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: "#E5E5E5", borderRadius: 12,
    backgroundColor: "#FAFAFA",
  },
  pwInput: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text,
  },
  pwEyeBtn: { paddingHorizontal: 14, paddingVertical: 13 },

  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: "center", marginTop: 8, marginBottom: 10,
    shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  submitBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  cancelBtn: { alignItems: "center", paddingVertical: 8 },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
});
