import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "salesman", label: "Salesman" },
  { value: "mechanic", label: "Mechanic" },
  { value: "retailer", label: "Retailer" },
] as const;

type Role = typeof ROLES[number]["value"];

export default function CreateAccountScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("retailer");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCreate = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Email and password are required");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim(), password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create account");
      setSuccess(true);
      setEmail("");
      setPassword("");
      setRole("retailer");
      Alert.alert("Success", `Account created for ${data.email}`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
      setSuccess(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Account</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Role</Text>
          <View style={styles.roleGrid}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[styles.roleBtn, role === r.value && styles.roleBtnActive]}
                onPress={() => setRole(r.value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.roleBtnText, role === r.value && styles.roleBtnTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter email address"
            placeholderTextColor="#555"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password (min. 6 chars)"
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Feather name="user-plus" size={20} color={Colors.white} />
          <Text style={styles.buttonText}>{loading ? "Creating..." : "Create Account"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.adminBg },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminText },
  scroll: { padding: 20, gap: 24 },
  inputGroup: { gap: 10 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#aaa" },
  roleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  roleBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#444",
    backgroundColor: "transparent",
  },
  roleBtnActive: { backgroundColor: Colors.adminAccent, borderColor: Colors.adminAccent },
  roleBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#888" },
  roleBtnTextActive: { color: Colors.white },
  input: {
    backgroundColor: Colors.adminCard,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.adminText,
  },
  button: {
    backgroundColor: Colors.adminAccent,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Colors.white, fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
