import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { router } from "expo-router";
import { Colors } from "@/constants/colors";

interface TickerItem {
  id: number;
  text: string;
  createdAt: string;
}

async function getToken() {
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  return (await AsyncStorage.getItem("tashi_token")) || "";
}

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

export default function CreateTextScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<TickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/ticker`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setItems(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const saveText = async () => {
    if (!inputText.trim()) return;
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/ticker`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: inputText.trim() }),
      });
      if (res.ok) {
        const item = await res.json();
        setItems((prev) => [item, ...prev]);
        setInputText("");
      } else {
        Alert.alert("Error", "Could not save ticker text.");
      }
    } catch {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = (id: number) => {
    Alert.alert("Delete Ticker", "Remove this scrolling text from users' screens?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeletingId(id);
          try {
            const token = await getToken();
            await fetch(`${BASE}/ticker/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            setItems((prev) => prev.filter((t) => t.id !== id));
          } catch {
            Alert.alert("Error", "Could not delete.");
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={Colors.adminAccent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ticker Text</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>New Ticker Message</Text>
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder="Type a message to scroll across user screens..."
            placeholderTextColor={Colors.textLight}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={200}
          />
          <View style={styles.inputFooter}>
            <Text style={styles.charCount}>{inputText.length}/200</Text>
            <TouchableOpacity
              style={[styles.saveBtn, (!inputText.trim() || saving) && { opacity: 0.5 }]}
              onPress={saveText}
              disabled={!inputText.trim() || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={styles.saveBtnText}>Add Ticker</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Active Tickers</Text>

        {loading ? (
          <ActivityIndicator color={Colors.adminAccent} style={{ marginTop: 32 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No ticker texts yet</Text>
            <Text style={styles.emptyDesc}>Add a message above — it will scroll across user home screens.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <View key={item.id} style={styles.tickerCard}>
                <View style={styles.tickerPreview}>
                  <Text style={styles.tickerPreviewLabel}>PREVIEW</Text>
                  <Text style={styles.tickerText} numberOfLines={2}>{item.text}</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteItem(item.id)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id
                    ? <ActivityIndicator size="small" color={Colors.error} />
                    : <Feather name="trash-2" size={18} color={Colors.error} />
                  }
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FA" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${Colors.adminAccent}18`, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.adminText },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6,
    marginTop: 8,
  },
  inputCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, gap: 12,
  },
  input: {
    fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text,
    minHeight: 80, textAlignVertical: "top",
  },
  inputFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  charCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight },
  saveBtn: {
    backgroundColor: Colors.adminAccent, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.white },

  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },

  list: { gap: 12 },
  tickerCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, flexDirection: "row", alignItems: "center", gap: 12,
  },
  tickerPreview: { flex: 1, gap: 4 },
  tickerPreviewLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold",
    color: Colors.adminAccent, letterSpacing: 0.8,
  },
  tickerText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.text },
  deleteBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: `${Colors.error}10`,
    justifyContent: "center", alignItems: "center",
  },
});
