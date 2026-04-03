import React, { useState, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { FontAwesome } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as SMS from "expo-sms";
import ViewShot from "react-native-view-shot";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";
import { BackButton } from "@/components/BackButton";
import { TASHI_LOGO_BASE64 } from "@/constants/tashibLogoBase64";

function toWhatsAppPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return "92" + digits.slice(1);
  return "92" + digits;
}

async function getToken() { return (await AsyncStorage.getItem("tashi_token")) || ""; }
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error || "Request failed");
  return data as T;
}

interface RetailerBalance {
  id: number; name: string | null; phone: string; city: string | null;
  totalOrdered: number; totalPaid: number; outstanding: number;
}

interface Payment {
  id: number; amount: number; notes: string | null; createdAt: string;
  status: "pending" | "verified";
  verifiedAt: string | null;
  verifiedByName: string | null;
  retailerName: string | null; retailerPhone: string | null;
  collectorName: string | null;
}

interface MyBalance {
  totalOrdered: number; totalPaid: number; outstanding: number;
  payments: {
    id: number; amount: number; notes: string | null; createdAt: string;
    status: "pending" | "verified";
    verifiedAt: string | null;
    collectorName: string | null;
  }[];
}

type Tab = "outstanding" | "collections" | "commission";

function fmt(n: number) { return n.toLocaleString(); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: "pending" | "verified" }) {
  const verified = status === "verified";
  return (
    <View style={[styles.badge, verified ? styles.badgeVerified : styles.badgePending]}>
      <Feather name={verified ? "check-circle" : "clock"} size={10} color={verified ? "#065F46" : "#92400E"} />
      <Text style={[styles.badgeText, { color: verified ? "#065F46" : "#92400E" }]}>
        {verified ? "Verified" : "Under Review"}
      </Text>
    </View>
  );
}

interface ShareReceiptData {
  retailerName: string;
  retailerPhone: string;
  amount: number;
  notes: string;
  date: string;
  salesmanName: string;
}

// ─── Receipt card (captured as image for WhatsApp) ─────────────────────────────
function ReceiptCard({ data, cardRef }: { data: ShareReceiptData; cardRef: React.RefObject<ViewShot | null> }) {
  const logoUri = `data:image/png;base64,${TASHI_LOGO_BASE64}`;
  const dateStr = new Date(data.date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = new Date(data.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <ViewShot ref={cardRef as any} options={{ format: "png", quality: 1 }}>
      <View style={rcStyles.card}>
        <View style={rcStyles.header}>
          <View style={rcStyles.logoContainer}>
            <Image source={{ uri: logoUri }} style={rcStyles.logo} resizeMode="contain" />
          </View>
          <View style={rcStyles.badge}>
            <Feather name="check-circle" size={11} color="#fff" />
            <Text style={rcStyles.badgeText}>Payment Received</Text>
          </View>
        </View>
        <View style={rcStyles.body}>
          <View style={rcStyles.amountSection}>
            <Text style={rcStyles.amountLabel}>Amount Collected</Text>
            <Text style={rcStyles.amount}>Rs. {data.amount.toLocaleString()}</Text>
          </View>
          <View style={[rcStyles.divider, { width: "100%" }]} />
          <View style={rcStyles.row}>
            <Feather name="user" size={13} color="#666" />
            <Text style={rcStyles.rowLabel}>Retailer</Text>
            <Text style={rcStyles.rowValue}>{data.retailerName || data.retailerPhone}</Text>
          </View>
          <View style={rcStyles.row}>
            <Feather name="phone" size={13} color="#666" />
            <Text style={rcStyles.rowLabel}>Phone</Text>
            <Text style={rcStyles.rowValue}>{data.retailerPhone}</Text>
          </View>
          <View style={rcStyles.row}>
            <Feather name="calendar" size={13} color="#666" />
            <Text style={rcStyles.rowLabel}>Date</Text>
            <Text style={rcStyles.rowValue}>{dateStr}</Text>
          </View>
          <View style={rcStyles.row}>
            <Feather name="clock" size={13} color="#666" />
            <Text style={rcStyles.rowLabel}>Time</Text>
            <Text style={rcStyles.rowValue}>{timeStr}</Text>
          </View>
          <View style={rcStyles.row}>
            <Feather name="briefcase" size={13} color="#666" />
            <Text style={rcStyles.rowLabel}>Collected By</Text>
            <Text style={rcStyles.rowValue}>{data.salesmanName}</Text>
          </View>
          {data.notes ? (
            <View style={rcStyles.row}>
              <Feather name="file-text" size={13} color="#666" />
              <Text style={rcStyles.rowLabel}>Notes</Text>
              <Text style={rcStyles.rowValue}>{data.notes}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </ViewShot>
  );
}

// ─── Share Receipt Modal ────────────────────────────────────────────────────────
function ShareReceiptModal({ data, onClose }: { data: ShareReceiptData; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const cardRef = useRef<ViewShot | null>(null);

  const handleWhatsApp = useCallback(async () => {
    const waPhone = toWhatsAppPhone(data.retailerPhone);
    const dateStr = new Date(data.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const message =
      `Assalam-o-Alaikum ${data.retailerName || data.retailerPhone}!\n\n` +
      `Aap ki payment receive ho gayi hai.\n\n` +
      `Amount: Rs. ${data.amount.toLocaleString()}\n` +
      `Date: ${dateStr}\n` +
      `Collected By: ${data.salesmanName}\n` +
      (data.notes ? `Notes: ${data.notes}\n` : "") +
      `\nShukria! - Tashi Brake Parts`;
    try {
      const waUrl = `whatsapp://send?phone=${waPhone}&text=${encodeURIComponent(message)}`;
      const webUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
      const canOpenWa = await Linking.canOpenURL(waUrl);
      await Linking.openURL(canOpenWa ? waUrl : webUrl);
    } catch {
      Alert.alert("WhatsApp Not Found", "Could not open WhatsApp. Please use SMS instead.");
    }
  }, [data]);

  const handleSMS = useCallback(async () => {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert("SMS not available", "Your device does not support SMS sending.");
      return;
    }
    const dateStr = new Date(data.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const message =
      `Assalam-o-Alaikum ${data.retailerName || data.retailerPhone}!\n\n` +
      `Aap ki payment receive ho gayi hai.\n\n` +
      `Amount: Rs. ${data.amount.toLocaleString()}\n` +
      `Date: ${dateStr}\n` +
      `Collected By: ${data.salesmanName}\n` +
      (data.notes ? `Notes: ${data.notes}\n` : "") +
      `\nShukria! - Tashi Brake Parts`;
    await SMS.sendSMSAsync([data.retailerPhone], message);
  }, [data]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={[shareStyles.overlay]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[shareStyles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={shareStyles.handle} />
          <Text style={shareStyles.title}>Share Receipt</Text>
          <Text style={shareStyles.subtitle}>Send payment confirmation to the retailer</Text>

          <View style={shareStyles.cardWrapper}>
            <ReceiptCard data={data} cardRef={cardRef} />
          </View>

          <View style={shareStyles.actions}>
            <TouchableOpacity
              style={[shareStyles.actionBtn, shareStyles.waBtn]}
              onPress={handleWhatsApp}
              activeOpacity={0.8}
            >
              <FontAwesome name="whatsapp" size={22} color="#fff" />
              <Text style={shareStyles.actionBtnText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[shareStyles.actionBtn, shareStyles.smsBtn]}
              onPress={handleSMS}
              activeOpacity={0.8}
            >
              <Feather name="message-square" size={18} color="#fff" />
              <Text style={shareStyles.actionBtnText}>Send SMS</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={shareStyles.skipBtn} onPress={onClose}>
            <Text style={shareStyles.skipText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Salesman view ─────────────────────────────────────────────────────────────
function SalesmanPayments() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useAuth();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const [tab, setTab] = useState<Tab>("outstanding");
  const [collectTarget, setCollectTarget] = useState<RetailerBalance | null>(null);
  const [selectedRetailer, setSelectedRetailer] = useState<RetailerBalance | null>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [shareReceipt, setShareReceipt] = useState<ShareReceiptData | null>(null);
  const lastTapRef = useRef<{ id: number; time: number } | null>(null);

  const handleCardTap = useCallback((item: RetailerBalance) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === item.id && now - last.time < 350) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedRetailer(prev => prev?.id === item.id ? null : item);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { id: item.id, time: now };
    }
  }, []);

  // Outstanding search
  const [retailerSearch, setRetailerSearch] = useState("");

  // Collections filters
  type DateFilter = "all" | "today" | "week" | "month";
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [collectionSearch, setCollectionSearch] = useState("");

  const { data: summary, refetch: refetchSummary } = useQuery<{ totalOutstanding: number; todayCollections: number; totalCommission: number }>({
    queryKey: ["salesman-summary"],
    queryFn: () => apiFetch("/payments/salesman-summary"),
  });

  const { data: balances = [], isLoading: loadingBalances, refetch: refetchBalances, isRefetching: refetchingBalances } = useQuery<RetailerBalance[]>({
    queryKey: ["salesman-retailer-balances"],
    queryFn: () => apiFetch("/payments/retailer-balances"),
  });

  const { data: payments = [], isLoading: loadingHistory, refetch: refetchHistory, isRefetching: refetchingHistory } = useQuery<Payment[]>({
    queryKey: ["salesman-payments"],
    queryFn: () => apiFetch("/payments"),
  });

  const { data: commissions = [], isLoading: loadingCommissions, refetch: refetchCommissions, isRefetching: refetchingCommissions } = useQuery<{
    id: number; salesAmount: number; percentage: number; commissionAmount: number;
    periodFrom: string | null; periodTo: string; adminName: string | null; createdAt: string;
  }[]>({
    queryKey: ["my-commissions"],
    queryFn: () => apiFetch("/commission/my-commissions"),
  });

  const recordPayment = useMutation({
    mutationFn: ({ retailerId, amount, notes }: { retailerId: number; amount: number; notes: string }) =>
      apiFetch("/payments", { method: "POST", body: JSON.stringify({ retailerId, amount, notes }) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["salesman-summary"] });
      qc.invalidateQueries({ queryKey: ["salesman-retailer-balances"] });
      qc.invalidateQueries({ queryKey: ["salesman-payments"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (collectTarget) {
        setShareReceipt({
          retailerName: collectTarget.name || "",
          retailerPhone: collectTarget.phone,
          amount: vars.amount,
          notes: vars.notes,
          date: new Date().toISOString(),
          salesmanName: user?.name || "Salesman",
        });
      }
      setCollectTarget(null); setAmount(""); setNotes("");
    },
  });

  const handleCollect = useCallback(() => {
    if (!collectTarget || !amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    recordPayment.mutate({ retailerId: collectTarget.id, amount: Number(amount), notes });
  }, [collectTarget, amount, notes, recordPayment]);

  const totalOutstanding = summary?.totalOutstanding ?? 0;
  const todayCollections = summary?.todayCollections ?? 0;
  const totalCommission = summary?.totalCommission ?? 0;

  // Filtered outstanding balances
  const q = retailerSearch.trim().toLowerCase();
  const filteredBalances = q
    ? balances.filter(b =>
        (b.name ?? "").toLowerCase().includes(q) ||
        b.phone.toLowerCase().includes(q) ||
        (b.city ?? "").toLowerCase().includes(q),
      )
    : balances;

  // Filtered collections
  const now = new Date();
  const filteredPayments = payments.filter(p => {
    const d = new Date(p.createdAt);
    if (dateFilter === "today") {
      const s = new Date(now); s.setHours(0, 0, 0, 0);
      if (d < s) return false;
    } else if (dateFilter === "week") {
      const s = new Date(now); s.setDate(s.getDate() - 6); s.setHours(0, 0, 0, 0);
      if (d < s) return false;
    } else if (dateFilter === "month") {
      const s = new Date(now); s.setDate(s.getDate() - 29); s.setHours(0, 0, 0, 0);
      if (d < s) return false;
    }
    if (collectionSearch.trim()) {
      const cs = collectionSearch.trim().toLowerCase();
      if (
        !(p.retailerName ?? "").toLowerCase().includes(cs) &&
        !(p.retailerPhone ?? "").toLowerCase().includes(cs)
      ) return false;
    }
    return true;
  });

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Accounts</Text>
        {selectedRetailer && tab === "outstanding" ? (
          <TouchableOpacity
            style={styles.headerCollectBtn}
            onPress={() => { setCollectTarget(selectedRetailer); setSelectedRetailer(null); }}
            activeOpacity={0.8}
          >
            <Feather name="dollar-sign" size={13} color="#fff" />
            <Text style={styles.headerCollectBtnText}>Collect</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 70 }} />
        )}
      </View>

      <View style={styles.summaryBar}>
        <Pressable style={[styles.summaryCell, tab === "outstanding" && styles.summaryCellActive]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab("outstanding"); }}>
          <Text style={[styles.summaryCellLabel, tab === "outstanding" && styles.summaryCellLabelActive]}>Outstanding</Text>
          <Text style={[styles.summaryCellValue, { color: totalOutstanding > 0 ? "#EF4444" : Colors.text }]}>Rs. {fmt(totalOutstanding)}</Text>
          {tab === "outstanding" && <View style={styles.summaryActiveBar} />}
        </Pressable>
        <View style={styles.summaryDivider} />
        <Pressable style={[styles.summaryCell, tab === "collections" && styles.summaryCellActive]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab("collections"); }}>
          <Text style={[styles.summaryCellLabel, tab === "collections" && styles.summaryCellLabelActive]}>Collections</Text>
          <Text style={[styles.summaryCellValue, { color: "#10B981" }]}>Rs. {fmt(todayCollections)}</Text>
          {tab === "collections" && <View style={styles.summaryActiveBar} />}
        </Pressable>
        <View style={styles.summaryDivider} />
        <Pressable style={[styles.summaryCell, tab === "commission" && styles.summaryCellActive]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab("commission"); }}>
          <Text style={[styles.summaryCellLabel, tab === "commission" && styles.summaryCellLabelActive]}>Commission</Text>
          <Text style={[styles.summaryCellValue, { color: totalCommission > 0 ? "#10B981" : Colors.text }]}>Rs. {fmt(totalCommission)}</Text>
          {tab === "commission" && <View style={styles.summaryActiveBar} />}
        </Pressable>
      </View>

      {tab === "outstanding" && (
        <View style={styles.searchBar}>
          <Feather name="search" size={15} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={retailerSearch}
            onChangeText={setRetailerSearch}
            placeholder="Search by name, phone or city…"
            placeholderTextColor={Colors.textLight}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {retailerSearch.length > 0 && (
            <Pressable onPress={() => setRetailerSearch("")}>
              <Feather name="x-circle" size={15} color={Colors.textSecondary} />
            </Pressable>
          )}
        </View>
      )}

      {tab === "collections" && (
        <View style={styles.filterBlock}>
          <View style={styles.searchBar}>
            <Feather name="search" size={15} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={collectionSearch}
              onChangeText={setCollectionSearch}
              placeholder="Search by retailer name or phone…"
              placeholderTextColor={Colors.textLight}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {collectionSearch.length > 0 && (
              <Pressable onPress={() => setCollectionSearch("")}>
                <Feather name="x-circle" size={15} color={Colors.textSecondary} />
              </Pressable>
            )}
          </View>
          <View style={styles.filterChips}>
            {(["all", "today", "week", "month"] as DateFilter[]).map(f => (
              <Pressable
                key={f}
                style={[styles.chip, dateFilter === f && styles.chipActive]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDateFilter(f); }}
              >
                <Text style={[styles.chipText, dateFilter === f && styles.chipTextActive]}>
                  {f === "all" ? "All" : f === "today" ? "Today" : f === "week" ? "Last 7 Days" : "Last 30 Days"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {tab === "outstanding" ? (
        loadingBalances ? (
          <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
        ) : filteredBalances.length === 0 ? (
          <View style={styles.center}>
            <Feather name={retailerSearch ? "search" : "users"} size={48} color={Colors.border} />
            <Text style={styles.emptyTitle}>{retailerSearch ? "No results found" : "No retailers yet"}</Text>
            <Text style={styles.emptyText}>{retailerSearch ? "Try a different name, phone or city" : "Create orders to see your retailers here"}</Text>
          </View>
        ) : (
          <FlatList
            data={filteredBalances}
            keyExtractor={i => String(i.id)}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.card, selectedRetailer?.id === item.id && styles.cardSelected]}
                onPress={() => handleCardTap(item)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.avatarCircle}>
                    <Feather name="user" size={16} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name || item.phone}</Text>
                    <Text style={styles.cardSub}>{item.phone} · {item.city || "—"}</Text>
                  </View>
                  <View style={[styles.dueBox, { borderColor: item.outstanding <= 0 ? "#10B981" : "#EF4444", backgroundColor: item.outstanding <= 0 ? "#F0FDF4" : "#FEF2F2" }]}>
                    <Text style={styles.dueBoxLabel}>{item.outstanding < 0 ? "Credit" : "Due"}</Text>
                    <Text style={[styles.dueBoxAmount, { color: item.outstanding <= 0 ? "#10B981" : "#EF4444" }]}>
                      Rs. {fmt(Math.abs(item.outstanding))}
                    </Text>
                  </View>
                </View>
              </Pressable>
            )}
            contentContainerStyle={{ padding: 16, paddingBottom: botPad + 20 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refetchingBalances} onRefresh={refetchBalances} tintColor={Colors.primary} />}
          />
        )
      ) : tab === "collections" ? (
        loadingHistory ? (
          <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
        ) : filteredPayments.length === 0 ? (
          <View style={styles.center}>
            <Feather name="credit-card" size={48} color={Colors.border} />
            <Text style={styles.emptyTitle}>{payments.length === 0 ? "No collections yet" : "No results"}</Text>
            <Text style={styles.emptyText}>{payments.length === 0 ? "Payments you collect will appear here" : "Try adjusting the date or retailer filter"}</Text>
          </View>
        ) : (
          <FlatList
            data={filteredPayments}
            keyExtractor={i => String(i.id)}
            renderItem={({ item }) => (
              <View style={styles.historyCard}>
                <View style={styles.historyLeft}>
                  <View style={[styles.cashIcon, item.status === "verified" ? styles.cashIconVerified : styles.cashIconPending]}>
                    <Feather name={item.status === "verified" ? "check-circle" : "clock"} size={18} color={item.status === "verified" ? "#10B981" : "#D97706"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyRetailer} numberOfLines={1}>{item.retailerName || item.retailerPhone || "Retailer"}</Text>
                    <Text style={styles.historySub}>{fmtDate(item.createdAt)}</Text>
                    {item.notes ? <Text style={styles.historyNotes} numberOfLines={1}>{item.notes}</Text> : null}
                    <StatusBadge status={item.status} />
                  </View>
                </View>
                <Text style={styles.historyAmount}>+ Rs. {fmt(item.amount)}</Text>
              </View>
            )}
            contentContainerStyle={{ padding: 16, paddingBottom: botPad + 20 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refetchingHistory} onRefresh={refetchHistory} tintColor={Colors.primary} />}
          />
        )
      ) : (
        loadingCommissions ? (
          <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
        ) : commissions.length === 0 ? (
          <View style={styles.center}>
            <Feather name="percent" size={48} color={Colors.border} />
            <Text style={styles.emptyTitle}>No commission records</Text>
            <Text style={styles.emptyText}>Commission entries will appear here once added by admin</Text>
          </View>
        ) : (
          <FlatList
            data={commissions}
            keyExtractor={i => String(i.id)}
            renderItem={({ item }) => (
              <View style={styles.historyCard}>
                <View style={styles.historyLeft}>
                  <View style={[styles.cashIcon, styles.cashIconVerified]}>
                    <Feather name="percent" size={18} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyRetailer}>Commission — {item.percentage}%</Text>
                    <Text style={styles.historySub}>Sales: Rs. {fmt(item.salesAmount)}</Text>
                    {item.adminName ? <Text style={styles.historyNotes}>By {item.adminName}</Text> : null}
                    <Text style={styles.historySub}>{fmtDate(item.createdAt)}</Text>
                  </View>
                </View>
                <Text style={styles.historyAmount}>Rs. {fmt(item.commissionAmount)}</Text>
              </View>
            )}
            contentContainerStyle={{ padding: 16, paddingBottom: botPad + 20 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refetchingCommissions} onRefresh={refetchCommissions} tintColor={Colors.primary} />}
          />
        )
      )}

      {shareReceipt && (
        <ShareReceiptModal data={shareReceipt} onClose={() => setShareReceipt(null)} />
      )}

      <Modal visible={!!collectTarget} transparent animationType="slide" onRequestClose={() => setCollectTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setCollectTarget(null)} />
          <View style={[styles.modalSheet, { paddingBottom: botPad + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Record Cash Payment</Text>
            {collectTarget && (
              <>
                <View style={styles.modalRetailerRow}>
                  <Feather name="user" size={15} color={Colors.primary} />
                  <Text style={styles.modalRetailerName}>{collectTarget.name || collectTarget.phone}</Text>
                  <Text style={styles.modalRetailerBalance}>Due: Rs. {fmt(collectTarget.outstanding)}</Text>
                </View>
                <View style={styles.noteBox}>
                  <Feather name="info" size={13} color="#2563EB" />
                  <Text style={styles.noteBoxText}>Payment will be sent to admin for verification</Text>
                </View>
                <Text style={styles.fieldLabel}>Amount Received (Rs.)</Text>
                <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="e.g. 50000" placeholderTextColor={Colors.textLight} autoFocus />
                <Text style={styles.fieldLabel}>Notes (optional)</Text>
                <TextInput style={[styles.input, { height: 70 }]} value={notes} onChangeText={setNotes} placeholder="e.g. Partial payment" placeholderTextColor={Colors.textLight} multiline />
                <TouchableOpacity style={[styles.confirmBtn, (!amount || recordPayment.isPending) && { opacity: 0.5 }]} onPress={handleCollect} disabled={!amount || recordPayment.isPending} activeOpacity={0.8}>
                  {recordPayment.isPending ? <ActivityIndicator color="#fff" /> : <><Feather name="check-circle" size={18} color="#fff" /><Text style={styles.confirmBtnText}>Submit for Verification</Text></>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Retailer view ─────────────────────────────────────────────────────────────
function RetailerPayments() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const { data, isLoading, refetch, isRefetching } = useQuery<MyBalance>({
    queryKey: ["my-balance"],
    queryFn: () => apiFetch("/payments/my-balance"),
  });

  const outstanding = data?.outstanding ?? 0;
  const totalOrdered = data?.totalOrdered ?? 0;
  const totalPaid = data?.totalPaid ?? 0;
  const payments = data?.payments ?? [];
  const pendingCount = payments.filter(p => p.status === "pending").length;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>My Account</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={i => String(i.id)}
          ListHeaderComponent={
            <>
              <View style={styles.balanceSummaryCard}>
                <Text style={styles.balanceSummaryLabel}>Outstanding Balance</Text>
                <Text style={[styles.balanceSummaryAmount, { color: outstanding > 0 ? "#EF4444" : "#10B981" }]}>
                  Rs. {fmt(Math.abs(outstanding))}
                </Text>
                {outstanding < 0 && <Text style={styles.creditNote}>You have a credit of Rs. {fmt(Math.abs(outstanding))}</Text>}
                {outstanding === 0 && <Text style={[styles.creditNote, { color: "#10B981" }]}>Account is clear</Text>}
                <View style={styles.balanceSummaryRow}>
                  <View style={styles.summaryCell}>
                    <Text style={styles.summaryCellLabel}>Total Ordered</Text>
                    <Text style={styles.summaryCellValue}>Rs. {fmt(totalOrdered)}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryCell}>
                    <Text style={styles.summaryCellLabel}>Total Paid</Text>
                    <Text style={[styles.summaryCellValue, { color: "#10B981" }]}>Rs. {fmt(totalPaid)}</Text>
                  </View>
                </View>
              </View>

              {pendingCount > 0 && (
                <View style={styles.pendingBanner}>
                  <Feather name="clock" size={14} color="#92400E" />
                  <Text style={styles.pendingBannerText}>{pendingCount} payment{pendingCount !== 1 ? "s" : ""} under review by admin</Text>
                </View>
              )}

              <Text style={styles.sectionHeading}>Payment History</Text>
              {payments.length === 0 && (
                <View style={[styles.center, { paddingVertical: 40 }]}>
                  <Feather name="credit-card" size={44} color={Colors.border} />
                  <Text style={styles.emptyTitle}>No payments recorded yet</Text>
                  <Text style={styles.emptyText}>Your payment history will appear here</Text>
                </View>
              )}
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.historyCard}>
              <View style={styles.historyLeft}>
                <View style={[styles.cashIcon, item.status === "verified" ? styles.cashIconVerified : styles.cashIconPending]}>
                  <Feather name={item.status === "verified" ? "check-circle" : "clock"} size={18} color={item.status === "verified" ? "#10B981" : "#D97706"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyRetailer}>Cash Payment</Text>
                  <Text style={styles.historySub}>
                    {item.collectorName ? `Collected by ${item.collectorName}` : "Recorded"} · {fmtDate(item.createdAt)}
                  </Text>
                  {item.notes ? <Text style={styles.historyNotes} numberOfLines={1}>{item.notes}</Text> : null}
                  <StatusBadge status={item.status} />
                </View>
              </View>
              <Text style={styles.historyAmount}>Rs. {fmt(item.amount)}</Text>
            </View>
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad + 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        />
      )}
    </View>
  );
}

// ─── Entry point — role-based ──────────────────────────────────────────────────
export default function PaymentsScreen() {
  const { user } = useAuth();
  if (user?.role === "retailer") return <RetailerPayments />;
  return <SalesmanPayments />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F8FA" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  header: {
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerTitle: { flex: 1, fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text, textAlign: "center" },
  summaryBar: {
    flexDirection: "row", backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  summaryCell: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 4, position: "relative" },
  summaryCellActive: { backgroundColor: `${Colors.primary}10` },
  summaryCellLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryCellLabelActive: { color: Colors.primary, fontFamily: "Inter_700Bold" },
  summaryCellValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  summaryActiveBar: { position: "absolute", bottom: -14, left: 8, right: 8, height: 3, backgroundColor: Colors.primary, borderRadius: 2 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.text, padding: 0 },
  filterBlock: { paddingBottom: 4 },
  filterChips: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#F0F0F0", borderWidth: 1, borderColor: "#E0E0E0" },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  chipTextActive: { color: "#fff" },
  card: {
    backgroundColor: "#fff", borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#F0F0F0",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  cardSelected: { borderColor: Colors.primary, borderWidth: 1.5 },
  dueBox: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 80 },
  dueBoxLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" },
  dueBoxAmount: { fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center" },
  headerCollectBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#10B981", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  headerCollectBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${Colors.primary}18`, alignItems: "center", justifyContent: "center" },
  cardName: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  collectBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#10B981", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  collectBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  balanceRow: { flexDirection: "row", paddingVertical: 14 },
  balanceCell: { flex: 1, alignItems: "center", gap: 4 },
  balanceCellLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  balanceCellValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  balanceDivider: { width: 1, backgroundColor: "#EEEEEE" },
  historyCard: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#F0F0F0",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  historyLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1 },
  cashIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  cashIconVerified: { backgroundColor: "#D1FAE5" },
  cashIconPending: { backgroundColor: "#FEF3C7" },
  historyRetailer: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.text },
  historySub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  historyNotes: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textLight, fontStyle: "italic", marginTop: 1 },
  historyAmount: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#10B981" },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, marginTop: 4, alignSelf: "flex-start" },
  badgeVerified: { backgroundColor: "#D1FAE5" },
  badgePending: { backgroundColor: "#FEF3C7" },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  balanceSummaryCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 24, marginBottom: 16,
    borderWidth: 1, borderColor: "#F0F0F0", alignItems: "center", gap: 6,
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  balanceSummaryLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.7 },
  balanceSummaryAmount: { fontSize: 36, fontFamily: "Inter_700Bold" },
  creditNote: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  balanceSummaryRow: { flexDirection: "row", width: "100%", marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  pendingBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF3C7", borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  pendingBannerText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#92400E", flex: 1 },
  sectionHeading: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
  noteBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  noteBoxText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#1D4ED8", flex: 1 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 12, gap: 14 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0", alignSelf: "center", marginBottom: 8 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  modalRetailerRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  modalRetailerName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text, flex: 1 },
  modalRetailerBalance: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#EF4444" },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.text,
    backgroundColor: "#FAFAFA",
  },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15,
  },
  confirmBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});

// ─── Receipt card styles ────────────────────────────────────────────────────────
const rcStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    width: 320,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoContainer: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  logo: { width: 120, height: 42 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#10B981",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 10 },
  amountSection: { alignItems: "center", width: "100%" },
  amountLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#999", textTransform: "uppercase", letterSpacing: 0.7, textAlign: "center" },
  amount: { fontSize: 34, fontFamily: "Inter_700Bold", color: "#10B981", textAlign: "center" },
  dividerFull: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 4, width: "100%" },
  divider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#999", width: 100 },
  rowValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1A1A1A", flex: 1 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  statusText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#92400E", flex: 1 },
  footer: {
    backgroundColor: "#F7F8FA",
    paddingVertical: 10,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  footerText: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#aaa" },
});

// ─── Share modal styles ─────────────────────────────────────────────────────────
const shareStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingTop: 12,
    alignItems: "center",
    gap: 16,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0", marginBottom: 4 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: -8 },
  cardWrapper: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderRadius: 20,
  },
  actions: { flexDirection: "row", gap: 10, width: "100%" },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  waBtn: { backgroundColor: "#25D366" },
  smsBtn: { backgroundColor: "#2563EB" },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  skipBtn: { paddingVertical: 10 },
  skipText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
});
