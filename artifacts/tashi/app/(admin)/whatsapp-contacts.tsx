import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Feather, FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Colors } from "@/constants/colors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

async function getToken() {
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  return (await AsyncStorage.getItem("tashi_token")) || "";
}

type Contacts = { mechanic: string; salesman: string; retailer: string };

const ROLES: { key: keyof Contacts; label: string; desc: string; gradient: [string, string]; icon: string }[] = [
  {
    key: "mechanic",
    label: "Mechanic",
    desc: "Mechanics will open this number when tapping WhatsApp",
    gradient: ["#E87722", "#F5A54A"],
    icon: "🔧",
  },
  {
    key: "salesman",
    label: "Salesman",
    desc: "Salesmen will open this number when tapping WhatsApp",
    gradient: ["#2563EB", "#60A5FA"],
    icon: "💼",
  },
  {
    key: "retailer",
    label: "Retailer",
    desc: "Retailers will open this number when tapping WhatsApp",
    gradient: ["#047857", "#10B981"],
    icon: "🏪",
  },
];

export default function WhatsAppContactsScreen() {
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<Contacts>({ mechanic: "", salesman: "", retailer: "" });
  const [draft, setDraft] = useState<Contacts>({ mechanic: "", salesman: "", retailer: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/whatsapp-contacts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Contacts = await res.json();
        setContacts(data);
        setDraft(data);
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchContacts(); }, [fetchContacts]));

  const save = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/whatsapp-contacts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("Failed to save");
      const saved: Contacts = await res.json();
      setContacts(saved);
      setDraft(saved);
      Alert.alert("Saved", "WhatsApp numbers updated successfully.");
    } catch {
      Alert.alert("Error", "Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    draft.mechanic !== contacts.mechanic ||
    draft.salesman !== contacts.salesman ||
    draft.retailer !== contacts.retailer;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton />
          <View style={styles.headerCenter}>
            <View style={styles.headerIconWrap}>
              <FontAwesome name="whatsapp" size={20} color="#25D366" />
            </View>
            <Text style={styles.headerTitle}>WhatsApp Contacts</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
        ) : (
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.subtitle}>
              Set the WhatsApp number for each account type. When a user taps the WhatsApp button in their home screen, they'll be connected to the number configured for their role.
            </Text>

            {ROLES.map((role) => (
              <View key={role.key} style={styles.card}>
                <LinearGradient
                  colors={role.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cardHeader}
                >
                  <Text style={styles.cardIcon}>{role.icon}</Text>
                  <Text style={styles.cardTitle}>{role.label}</Text>
                </LinearGradient>
                <View style={styles.cardBody}>
                  <Text style={styles.cardDesc}>{role.desc}</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.inputPrefix}>
                      <FontAwesome name="whatsapp" size={16} color="#25D366" />
                      <Text style={styles.inputPrefixText}>+</Text>
                    </View>
                    <TextInput
                      style={styles.input}
                      value={draft[role.key]}
                      onChangeText={(v) => setDraft((d) => ({ ...d, [role.key]: v.replace(/\D/g, "") }))}
                      keyboardType="phone-pad"
                      placeholder="e.g. 923001234567"
                      placeholderTextColor={Colors.textLight}
                      maxLength={15}
                    />
                  </View>
                  <Text style={styles.hint}>
                    Include country code without "+". e.g. 923001234567
                  </Text>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
              onPress={save}
              disabled={!hasChanges || saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F4F1" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#E8F8EF",
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text },

  content: { padding: 16, gap: 16 },

  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  card: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: Colors.white,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardIcon: { fontSize: 20 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },

  cardBody: { padding: 16, gap: 10 },
  cardDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F9F7F5",
  },
  inputPrefix: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: "#F0EDE9",
  },
  inputPrefixText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  hint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textLight,
    marginTop: -4,
  },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#25D366",
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
    shadowColor: "#25D366",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  saveBtnDisabled: { backgroundColor: "#A0D9B4", shadowOpacity: 0 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});
