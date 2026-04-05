import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import * as Haptics from "expo-haptics";
import * as SMS from "expo-sms";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

interface Claim {
  id: number;
  pointsClaimed: number;
  status: "pending" | "received";
  claimedAt: string;
  userName: string;
  userPhone: string | null;
  userRole: string;
  userId: number;
}

interface ScanInfo {
  scanId: number;
  pointsEarned: number;
  scannedAt: string;
  qrNumber: string;
  productName: string;
  mechanic: {
    id: number;
    name: string;
    phone: string | null;
    role: string;
  };
  alreadyClaimed: boolean;
  claimId: number | null;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    "  " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function AdminClaimsScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [marking, setMarking] = useState(false);
  const [smsTarget, setSmsTarget] = useState<Claim | null>(null);
  const [smsSending, setSmsSending] = useState(false);

  // QR Scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [qrScanned, setQrScanned] = useState(false);
  const [scanLookupLoading, setScanLookupLoading] = useState(false);
  const [scanInfo, setScanInfo] = useState<ScanInfo | null>(null);
  const [approvingClaim, setApprovingClaim] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/claims`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setClaims(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchClaims(); }, [fetchClaims]));

  const totalPoints = claims.reduce((sum, c) => sum + c.pointsClaimed, 0);
  const pendingCount = claims.filter(c => c.status === "pending").length;

  const handlePressClaim = (claim: Claim) => {
    if (claim.status === "received") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedClaim(claim);
  };

  const handleMarkReceived = async () => {
    if (!selectedClaim) return;
    setMarking(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/claims/${selectedClaim.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setClaims(prev => prev.map(c =>
          c.id === selectedClaim.id ? { ...c, status: "received" } : c
        ));
        const paid = selectedClaim;
        setSelectedClaim(null);
        setTimeout(() => setSmsTarget(paid), 300);
      }
    } catch {
      // ignore
    } finally {
      setMarking(false);
      setSelectedClaim(null);
    }
  };

  const handleSendSms = async () => {
    if (!smsTarget) return;
    const phone = smsTarget.userPhone;
    if (!phone) {
      Alert.alert("No Phone Number", "This user has no phone number on record.");
      setSmsTarget(null);
      return;
    }

    const available = await SMS.isAvailableAsync();
    if (!available) {
      Alert.alert("SMS Not Available", "SMS is not supported on this device.");
      setSmsTarget(null);
      return;
    }

    const date = new Date(smsTarget.claimedAt).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });

    const message =
      `*Tashi Payment Confirmation*\n` +
      `Name: ${smsTarget.userName}\n` +
      `Date: ${date}\n\n` +
      `Your claim of ${smsTarget.pointsClaimed} points has been processed and payment has been made to your account.\n\n` +
      `Thank you for your service!\n- Tashi Team`;

    setSmsSending(true);
    try {
      await SMS.sendSMSAsync([phone], message);
    } finally {
      setSmsSending(false);
      setSmsTarget(null);
    }
  };

  // ── QR Scanner handlers ──

  const openScanner = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Not Supported", "QR scanning is only available on the mobile app.");
      return;
    }
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Permission Required", "Camera permission is needed to scan QR codes.");
        return;
      }
    }
    setQrScanned(false);
    setScanInfo(null);
    setScannerOpen(true);
  };

  const handleQrScanned = async ({ data }: { data: string }) => {
    if (qrScanned || scanLookupLoading) return;
    setQrScanned(true);
    setScanLookupLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await fetch(
        `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/scans/by-qr/${encodeURIComponent(data)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const result = await res.json();
      if (!res.ok) {
        Alert.alert("Cannot Verify", result.error || "Failed to look up this QR code.", [
          { text: "Scan Again", onPress: () => { setQrScanned(false); setScanLookupLoading(false); } },
          { text: "Close", onPress: () => setScannerOpen(false) },
        ]);
      } else {
        setScanInfo(result);
      }
    } catch {
      Alert.alert("Error", "Failed to look up QR code. Check your connection.", [
        { text: "Try Again", onPress: () => { setQrScanned(false); setScanLookupLoading(false); } },
        { text: "Close", onPress: () => setScannerOpen(false) },
      ]);
    } finally {
      setScanLookupLoading(false);
    }
  };

  const handleApproveClaim = async () => {
    if (!scanInfo) return;
    setApprovingClaim(true);
    try {
      const res = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/claims/from-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scanId: scanInfo.scanId }),
      });
      const result = await res.json();
      if (!res.ok) {
        Alert.alert("Failed", result.error || "Could not create claim.");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setScannerOpen(false);
        setScanInfo(null);
        setQrScanned(false);
        await fetchClaims();
        Alert.alert(
          "Claim Created",
          `A claim of ${result.pointsClaimed} pts has been created for ${result.mechanicName || scanInfo.mechanic.name}.`
        );
      }
    } catch {
      Alert.alert("Error", "Failed to approve claim.");
    } finally {
      setApprovingClaim(false);
    }
  };

  const closeScanInfo = () => {
    setScanInfo(null);
    setQrScanned(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <BackButton color={Colors.adminAccent} fallback="/(admin)" />
        <Text style={styles.headerTitle}>Claimed Rewards</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={openScanner} style={styles.scanBtn}>
            <Feather name="maximize" size={18} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={fetchClaims} style={styles.refreshBtn}>
            <Feather name="refresh-cw" size={20} color={Colors.adminAccent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{claims.length}</Text>
          <Text style={styles.summaryLabel}>Total Claims</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalPoints}</Text>
          <Text style={styles.summaryLabel}>Total Points</Text>
        </View>
      </View>

      {/* Verify QR banner */}
      <TouchableOpacity style={styles.verifyBanner} onPress={openScanner} activeOpacity={0.85}>
        <View style={styles.verifyBannerIcon}>
          <Feather name="maximize" size={20} color={Colors.adminAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.verifyBannerTitle}>Verify & Claim via QR</Text>
          <Text style={styles.verifyBannerSub}>Scan a mechanic's QR code to approve their points claim</Text>
        </View>
        <Feather name="chevron-right" size={18} color={Colors.adminAccent} />
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.adminAccent} />
        </View>
      ) : (
        <FlatList
          data={claims}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchClaims}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="gift" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No claims yet.</Text>
              <Text style={styles.emptySubText}>Scan a mechanic's QR code to create one.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPending = item.status === "pending";
            return (
              <TouchableOpacity
                style={[styles.card, isPending && styles.cardPending]}
                onPress={() => handlePressClaim(item)}
                activeOpacity={isPending ? 0.75 : 1}
              >
                <View style={styles.cardLeft}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{item.userName?.[0]?.toUpperCase() || "?"}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardEmail} numberOfLines={1}>{item.userName || "—"}</Text>
                    <Text style={styles.cardRole}>{item.userRole?.toUpperCase()}</Text>
                    {item.userPhone && (
                      <Text style={styles.cardPhone}>{item.userPhone}</Text>
                    )}
                    <Text style={styles.cardDate}>{formatDate(item.claimedAt)}</Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <View style={styles.pointsBadge}>
                    <Text style={styles.pointsBadgeText}>{item.pointsClaimed}</Text>
                    <Text style={styles.pointsBadgeUnit}>pts</Text>
                  </View>
                  <View style={[styles.statusBadge, isPending ? styles.statusPending : styles.statusReceived]}>
                    <Text style={[styles.statusText, isPending ? styles.statusTextPending : styles.statusTextReceived]}>
                      {isPending ? "Pending" : "Received"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── QR Scanner Modal ── */}
      <Modal
        visible={scannerOpen}
        animationType="slide"
        onRequestClose={() => setScannerOpen(false)}
      >
        <View style={styles.scannerContainer}>
          {/* Camera feed */}
          {Platform.OS !== "web" && !scanInfo && (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={qrScanned ? undefined : handleQrScanned}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            />
          )}

          {/* Scanner overlay */}
          <View style={[styles.scannerOverlay, { paddingTop: insets.top }]}>
            <View style={styles.scannerHeader}>
              <TouchableOpacity
                onPress={() => { setScannerOpen(false); setScanInfo(null); setQrScanned(false); }}
                style={styles.closeBtn}
              >
                <Feather name="x" size={22} color={Colors.white} />
              </TouchableOpacity>
              <Text style={styles.scannerHeaderTitle}>Verify QR Code</Text>
              <View style={{ width: 40 }} />
            </View>

            {!scanInfo && (
              <View style={styles.scanArea}>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <Text style={styles.scanHint}>
                  {scanLookupLoading
                    ? "Looking up scan..."
                    : qrScanned
                    ? "Processing..."
                    : "Point camera at a mechanic's QR code"}
                </Text>
              </View>
            )}
          </View>

          {/* Scan result bottom sheet */}
          {scanInfo && (
            <View style={[styles.scanResultSheet, { paddingBottom: insets.bottom + 24 }]}>
              <View style={styles.sheetHandle} />

              {scanInfo.alreadyClaimed ? (
                <>
                  <View style={styles.alreadyClaimedIcon}>
                    <Feather name="check-circle" size={36} color="#10B981" />
                  </View>
                  <Text style={styles.scanResultTitle}>Already Claimed</Text>
                  <Text style={styles.scanResultSub}>
                    This QR scan has already been claimed. Claim #{scanInfo.claimId}
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.scanResultIconRow}>
                    <View style={styles.scanResultIconCircle}>
                      <Feather name="user-check" size={28} color={Colors.adminAccent} />
                    </View>
                  </View>
                  <Text style={styles.scanResultTitle}>Scan Verified</Text>
                  <Text style={styles.scanResultSub}>Approve this claim to process the mechanic's points</Text>
                </>
              )}

              {/* Mechanic details */}
              <View style={styles.mechanicCard}>
                <View style={styles.mechanicAvatarCircle}>
                  <Text style={styles.mechanicAvatarText}>
                    {scanInfo.mechanic.name?.[0]?.toUpperCase() || "?"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mechanicName}>{scanInfo.mechanic.name}</Text>
                  <Text style={styles.mechanicRole}>{scanInfo.mechanic.role?.toUpperCase()}</Text>
                  {scanInfo.mechanic.phone && (
                    <Text style={styles.mechanicPhone}>{scanInfo.mechanic.phone}</Text>
                  )}
                </View>
                <View style={styles.mechanicPointsBadge}>
                  <Text style={styles.mechanicPoints}>{scanInfo.pointsEarned}</Text>
                  <Text style={styles.mechanicPtsLabel}>pts</Text>
                </View>
              </View>

              {/* QR / product info */}
              <View style={styles.qrInfoRow}>
                <View style={styles.qrInfoItem}>
                  <Feather name="maximize" size={13} color={Colors.textSecondary} />
                  <Text style={styles.qrInfoText}>{scanInfo.qrNumber}</Text>
                </View>
                <View style={styles.qrInfoDot} />
                <View style={styles.qrInfoItem}>
                  <Feather name="box" size={13} color={Colors.textSecondary} />
                  <Text style={styles.qrInfoText}>{scanInfo.productName || "—"}</Text>
                </View>
                <View style={styles.qrInfoDot} />
                <View style={styles.qrInfoItem}>
                  <Feather name="clock" size={13} color={Colors.textSecondary} />
                  <Text style={styles.qrInfoText}>
                    {new Date(scanInfo.scannedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </Text>
                </View>
              </View>

              {/* Action buttons */}
              {!scanInfo.alreadyClaimed && (
                <TouchableOpacity
                  style={[styles.approveBtn, approvingClaim && { opacity: 0.6 }]}
                  onPress={handleApproveClaim}
                  disabled={approvingClaim}
                  activeOpacity={0.85}
                >
                  {approvingClaim ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <>
                      <Feather name="check" size={20} color={Colors.white} />
                      <Text style={styles.approveBtnText}>Approve Claim — {scanInfo.pointsEarned} pts</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.scanAgainBtn} onPress={closeScanInfo}>
                <Text style={styles.scanAgainBtnText}>
                  {scanInfo.alreadyClaimed ? "Scan Another" : "Cancel"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* ── Payment confirmation modal ── */}
      <Modal
        visible={!!selectedClaim}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedClaim(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.popupCard}>
            <View style={styles.popupIconCircle}>
              <Feather name="credit-card" size={32} color={Colors.adminAccent} />
            </View>
            <Text style={styles.popupTitle}>Payment Made?</Text>
            <Text style={styles.popupSub}>Confirm that payment has been processed for:</Text>
            <View style={styles.popupDetail}>
              <Text style={styles.popupName}>{selectedClaim?.userName || "—"}</Text>
              {selectedClaim?.userPhone && (
                <Text style={styles.popupPhone}>{selectedClaim.userPhone}</Text>
              )}
              <Text style={styles.popupPts}>{selectedClaim?.pointsClaimed} pts</Text>
            </View>
            <View style={styles.popupActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSelectedClaim(null)}
                disabled={marking}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.okBtn, marking && { opacity: 0.6 }]}
                onPress={handleMarkReceived}
                disabled={marking}
              >
                {marking
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Text style={styles.okBtnText}>OK, Payment Made</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── SMS confirmation modal ── */}
      <Modal
        visible={!!smsTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setSmsTarget(null)}
      >
        <View style={styles.smsModalOverlay}>
          <View style={styles.smsSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.paymentSuccessIcon}>
              <Feather name="check-circle" size={36} color="#10B981" />
            </View>
            <Text style={styles.sheetTitle}>Payment Recorded</Text>
            <Text style={styles.sheetSub}>
              Would you like to send an SMS to{"\n"}
              <Text style={styles.sheetName}>{smsTarget?.userName}</Text> to notify them?
            </Text>
            <View style={styles.sheetDetail}>
              <View style={styles.sheetDetailRow}>
                <Feather name="user" size={14} color={Colors.textSecondary} />
                <Text style={styles.sheetDetailText}>{smsTarget?.userName || "—"}</Text>
              </View>
              {smsTarget?.userPhone && (
                <View style={styles.sheetDetailRow}>
                  <Feather name="phone" size={14} color={Colors.textSecondary} />
                  <Text style={styles.sheetDetailText}>{smsTarget.userPhone}</Text>
                </View>
              )}
              <View style={styles.sheetDetailRow}>
                <Feather name="star" size={14} color={Colors.adminAccent} />
                <Text style={[styles.sheetDetailText, { color: Colors.adminAccent, fontWeight: "700" }]}>
                  {smsTarget?.pointsClaimed} points paid
                </Text>
              </View>
            </View>
            <View style={styles.smsPreviewBox}>
              <Text style={styles.smsPreviewLabel}>SMS Preview</Text>
              <Text style={styles.smsPreviewText}>
                {`Your claim of ${smsTarget?.pointsClaimed} points has been processed and payment has been made to your account. Thank you! — Tashi`}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.sendSmsBtn, smsSending && { opacity: 0.6 }]}
              onPress={handleSendSms}
              disabled={smsSending}
              activeOpacity={0.85}
            >
              {smsSending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Feather name="message-square" size={20} color="#FFF" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sendSmsBtnTitle}>Send SMS Confirmation</Text>
                    <Text style={styles.sendSmsBtnSub}>{smsTarget?.userPhone ?? "No phone number"}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.7)" />
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={() => setSmsTarget(null)}>
              <Text style={styles.skipBtnText}>Skip, Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.adminBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminText, flex: 1, textAlign: "center" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  scanBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.adminAccent,
    justifyContent: "center",
    alignItems: "center",
  },
  refreshBtn: { padding: 8 },

  // Verify banner
  verifyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${Colors.adminAccent}12`,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: `${Colors.adminAccent}30`,
  },
  verifyBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${Colors.adminAccent}18`,
    justifyContent: "center",
    alignItems: "center",
  },
  verifyBannerTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.adminText },
  verifyBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },

  summaryCard: {
    flexDirection: "row",
    backgroundColor: Colors.adminAccent,
    margin: 16,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryValue: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.white },
  summaryLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)" },
  summaryDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.3)" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16, gap: 12 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { color: Colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 15 },
  emptySubText: { color: Colors.textLight, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },
  card: {
    backgroundColor: Colors.adminCard,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  cardPending: { borderColor: `${Colors.adminAccent}50`, borderWidth: 1.5 },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Colors.adminAccent}20`,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  cardInfo: { flex: 1, gap: 2 },
  cardEmail: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  cardRole: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textSecondary },
  cardPhone: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight },
  cardDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight, marginTop: 2 },
  cardRight: { alignItems: "flex-end", gap: 6 },
  pointsBadge: {
    backgroundColor: `${Colors.adminAccent}18`,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: "center",
  },
  pointsBadgeText: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  pointsBadgeUnit: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.adminAccent },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusPending: { backgroundColor: `${Colors.adminAccent}22` },
  statusReceived: { backgroundColor: `${Colors.success}18` },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  statusTextPending: { color: Colors.adminAccent },
  statusTextReceived: { color: Colors.success },

  // QR Scanner
  scannerContainer: { flex: 1, backgroundColor: "#000" },
  scannerOverlay: { flex: 1 },
  scannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  scannerHeaderTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.white },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  scanFrame: { width: 240, height: 240, position: "relative" },
  corner: { position: "absolute", width: 36, height: 36, borderColor: Colors.adminAccent },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanHint: {
    backgroundColor: "rgba(0,0,0,0.65)",
    color: Colors.white,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    textAlign: "center",
    maxWidth: 280,
  },

  // Scan result bottom sheet
  scanResultSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.adminCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 14,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  scanResultIconRow: { alignItems: "center" },
  scanResultIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${Colors.adminAccent}18`,
    justifyContent: "center",
    alignItems: "center",
  },
  alreadyClaimedIcon: { marginTop: 4 },
  scanResultTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminText },
  scanResultSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },

  mechanicCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: `${Colors.adminAccent}10`,
    borderRadius: 14,
    padding: 14,
    width: "100%",
    borderWidth: 1,
    borderColor: `${Colors.adminAccent}25`,
  },
  mechanicAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${Colors.adminAccent}20`,
    justifyContent: "center",
    alignItems: "center",
  },
  mechanicAvatarText: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  mechanicName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  mechanicRole: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textSecondary, marginTop: 1 },
  mechanicPhone: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight, marginTop: 2 },
  mechanicPointsBadge: {
    alignItems: "center",
    backgroundColor: `${Colors.adminAccent}22`,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mechanicPoints: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  mechanicPtsLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.adminAccent },

  qrInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
    width: "100%",
  },
  qrInfoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  qrInfoText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  qrInfoDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.textLight },

  approveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.adminAccent,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: "100%",
    shadowColor: Colors.adminAccent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  approveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.white },
  scanAgainBtn: { paddingVertical: 12, alignItems: "center", width: "100%" },
  scanAgainBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },

  // Payment modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  popupCard: {
    backgroundColor: Colors.adminCard,
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  popupIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${Colors.adminAccent}20`,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  popupTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.adminText },
  popupSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
  popupDetail: {
    backgroundColor: `${Colors.adminAccent}12`,
    borderRadius: 14,
    padding: 16,
    width: "100%",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  popupName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  popupPhone: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  popupPts: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  popupActions: { flexDirection: "row", gap: 12, width: "100%", marginTop: 8 },
  cancelBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: Colors.border,
  },
  cancelBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  okBtn: {
    flex: 2,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: Colors.adminAccent,
  },
  okBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.white },

  // SMS sheet
  smsModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  smsSheet: {
    backgroundColor: Colors.adminCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    gap: 14,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 4 },
  paymentSuccessIcon: { marginBottom: 2 },
  sheetTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.adminText },
  sheetSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  sheetName: { fontFamily: "Inter_700Bold", color: Colors.adminText },
  sheetDetail: {
    backgroundColor: `${Colors.adminAccent}10`,
    borderRadius: 14,
    padding: 14,
    width: "100%",
    gap: 8,
  },
  sheetDetailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sheetDetailText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.adminText },
  smsPreviewBox: {
    backgroundColor: "#F7F4F1",
    borderRadius: 12,
    padding: 14,
    width: "100%",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  smsPreviewLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.textSecondary, letterSpacing: 0.6, textTransform: "uppercase" },
  smsPreviewText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.adminText, lineHeight: 18 },
  sendSmsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.adminAccent,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    width: "100%",
    shadowColor: Colors.adminAccent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  sendSmsBtnTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  sendSmsBtnSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 2 },
  skipBtn: { paddingVertical: 12, alignItems: "center", width: "100%" },
  skipBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
});
