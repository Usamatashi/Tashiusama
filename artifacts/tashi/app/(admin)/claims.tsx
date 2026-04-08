import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
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

interface ClaimScan {
  id: number;
  qrNumber: string;
  productName: string;
  pointsEarned: number;
  scannedAt: string;
  adminVerified: boolean | null;
}

interface Claim {
  id: number;
  pointsClaimed: number;
  verifiedPoints: number;
  unverifiedPoints: number;
  status: "pending" | "received";
  claimedAt: string;
  userName: string;
  userPhone: string | null;
  userRole: string;
  userId: number;
  totalScans: number;
  verifiedScans: number;
  missingScans: number;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function ScanRow({
  scan,
  onMarkMissing,
  onScanQR,
}: {
  scan: ClaimScan;
  onMarkMissing: (scan: ClaimScan) => void;
  onScanQR: () => void;
}) {
  const isPending = scan.adminVerified === null;
  const isVerified = scan.adminVerified === true;
  const isMissing = scan.adminVerified === false;

  return (
    <View style={[
      scanRowStyles.row,
      isVerified && scanRowStyles.rowVerified,
      isMissing && scanRowStyles.rowMissing,
    ]}>
      <View style={[
        scanRowStyles.statusDot,
        isVerified && scanRowStyles.dotVerified,
        isMissing && scanRowStyles.dotMissing,
        isPending && scanRowStyles.dotPending,
      ]} />
      <View style={scanRowStyles.info}>
        <Text style={scanRowStyles.qr} numberOfLines={1}>{scan.qrNumber || "—"}</Text>
        <Text style={scanRowStyles.product} numberOfLines={1}>{scan.productName}</Text>
      </View>
      <Text style={[
        scanRowStyles.pts,
        isMissing && scanRowStyles.ptsMissing,
        isVerified && scanRowStyles.ptsVerified,
      ]}>
        {isMissing ? "-" : ""}{scan.pointsEarned} pts
      </Text>
      {isPending && (
        <View style={scanRowStyles.actions}>
          <TouchableOpacity style={scanRowStyles.scanBtn} onPress={onScanQR} activeOpacity={0.8}>
            <Feather name="maximize" size={12} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={scanRowStyles.missingBtn} onPress={() => onMarkMissing(scan)} activeOpacity={0.8}>
            <Feather name="x" size={12} color={Colors.white} />
          </TouchableOpacity>
        </View>
      )}
      {isVerified && (
        <View style={scanRowStyles.verifiedTag}>
          <Feather name="check" size={12} color="#10B981" />
        </View>
      )}
      {isMissing && (
        <View style={scanRowStyles.missingTag}>
          <Feather name="x" size={12} color="#EF4444" />
        </View>
      )}
    </View>
  );
}

const scanRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },
  rowVerified: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  rowMissing: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotPending: { backgroundColor: "#F59E0B" },
  dotVerified: { backgroundColor: "#10B981" },
  dotMissing: { backgroundColor: "#EF4444" },
  info: { flex: 1 },
  qr: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#1A1A1A" },
  product: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#777", marginTop: 1 },
  pts: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#1A1A1A", minWidth: 52, textAlign: "right" },
  ptsVerified: { color: "#10B981" },
  ptsMissing: { color: "#EF4444" },
  actions: { flexDirection: "row", gap: 6 },
  scanBtn: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: Colors.adminAccent,
    justifyContent: "center", alignItems: "center",
  },
  missingBtn: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: "#EF4444",
    justifyContent: "center", alignItems: "center",
  },
  verifiedTag: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#D1FAE5",
    justifyContent: "center", alignItems: "center",
  },
  missingTag: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#FEE2E2",
    justifyContent: "center", alignItems: "center",
  },
});

export default function AdminClaimsScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [smsTarget, setSmsTarget] = useState<Claim | null>(null);
  const [smsSending, setSmsSending] = useState(false);
  const [markingReceived, setMarkingReceived] = useState(false);

  // Verification sheet state
  const [verifyingClaim, setVerifyingClaim] = useState<Claim | null>(null);
  const [claimScans, setClaimScans] = useState<ClaimScan[]>([]);
  const [scansLoading, setScansLoading] = useState(false);

  // QR scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [qrScanned, setQrScanned] = useState(false);
  const [scanProcessing, setScanProcessing] = useState(false);
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

  const fetchClaimScans = async (claim: Claim) => {
    setScansLoading(true);
    try {
      const res = await fetch(
        `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/claims/${claim.id}/scans`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setClaimScans(data);
    } catch {
      setClaimScans([]);
    } finally {
      setScansLoading(false);
    }
  };

  const openVerifySheet = async (claim: Claim) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVerifyingClaim(claim);
    await fetchClaimScans(claim);
  };

  // ── QR Scanner ──

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
    setScannerOpen(true);
  };

  const handleQrScanned = async ({ data }: { data: string }) => {
    if (qrScanned || scanProcessing || !verifyingClaim) return;
    setQrScanned(true);
    setScanProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await fetch(
        `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/claims/${verifyingClaim.id}/verify-qr`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ qrNumber: data }),
        }
      );
      const result = await res.json();

      if (!res.ok) {
        const msg =
          result.code === "NOT_IN_CLAIM"
            ? "This QR code is not part of this claim."
            : result.code === "ALREADY_VERIFIED"
            ? "This QR has already been verified."
            : result.code === "QR_NOT_FOUND"
            ? "QR code not found in the system."
            : result.error || "Failed to verify QR.";

        Alert.alert("Cannot Verify", msg, [
          { text: "Scan Again", onPress: () => { setQrScanned(false); setScanProcessing(false); } },
          { text: "Close Scanner", onPress: () => setScannerOpen(false) },
        ]);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setScannerOpen(false);
        // Update local scan list
        setClaimScans(prev =>
          prev.map(s => {
            const matched = prev.find(ps => ps.id === result.scanId);
            if (matched && s.id === result.scanId) return { ...s, adminVerified: true };
            return s;
          })
        );
        // Update claim verifiedPoints in list
        setClaims(prev =>
          prev.map(c =>
            c.id === verifyingClaim.id
              ? { ...c, verifiedPoints: result.verifiedPoints, verifiedScans: c.verifiedScans + 1 }
              : c
          )
        );
        setVerifyingClaim(prev =>
          prev ? { ...prev, verifiedPoints: result.verifiedPoints } : prev
        );
        await fetchClaimScans(verifyingClaim);
      }
    } catch {
      Alert.alert("Error", "Failed to verify QR. Check your connection.", [
        { text: "Try Again", onPress: () => { setQrScanned(false); setScanProcessing(false); } },
      ]);
    } finally {
      setScanProcessing(false);
    }
  };

  const handleMarkMissing = (scan: ClaimScan) => {
    if (!verifyingClaim) return;
    Alert.alert(
      "Mark as Missing",
      `Mark QR "${scan.qrNumber}" as missing? The ${scan.pointsEarned} pts will be deducted from this claim.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Missing",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(
                `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/claims/${verifyingClaim.id}/mark-missing`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ scanId: scan.id }),
                }
              );
              const result = await res.json();
              if (res.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                setClaimScans(prev =>
                  prev.map(s => s.id === scan.id ? { ...s, adminVerified: false } : s)
                );
                setClaims(prev =>
                  prev.map(c =>
                    c.id === verifyingClaim.id
                      ? { ...c, verifiedPoints: result.verifiedPoints, missingScans: c.missingScans + 1 }
                      : c
                  )
                );
                setVerifyingClaim(prev =>
                  prev ? { ...prev, verifiedPoints: result.verifiedPoints } : prev
                );
              }
            } catch {
              Alert.alert("Error", "Failed to mark scan as missing.");
            }
          },
        },
      ]
    );
  };

  const handleMarkReceived = async () => {
    if (!verifyingClaim) return;
    const verifiedPts = claimScans
      .filter(s => s.adminVerified === true)
      .reduce((sum, s) => sum + s.pointsEarned, 0);

    Alert.alert(
      "Process Payment",
      `Mark payment of ${verifiedPts} verified points for ${verifyingClaim.userName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Payment Made",
          onPress: async () => {
            setMarkingReceived(true);
            try {
              const res = await fetch(
                `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/claims/${verifyingClaim.id}`,
                { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }
              );
              if (res.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                const paid = verifyingClaim;
                setVerifyingClaim(null);
                await fetchClaims();
                setTimeout(() => setSmsTarget(paid), 400);
              }
            } catch {
              // ignore
            } finally {
              setMarkingReceived(false);
            }
          },
        },
      ]
    );
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
      `Your claim of ${smsTarget.verifiedPoints} verified points has been processed and payment has been made.\n\n` +
      `Thank you for your service!\n- Tashi Team`;
    setSmsSending(true);
    try {
      await SMS.sendSMSAsync([phone], message);
    } finally {
      setSmsSending(false);
      setSmsTarget(null);
    }
  };

  // Computed stats for verify sheet
  const pendingScans = claimScans.filter(s => s.adminVerified === null);
  const verifiedScansLocal = claimScans.filter(s => s.adminVerified === true);
  const missingScansLocal = claimScans.filter(s => s.adminVerified === false);
  const localVerifiedPts = verifiedScansLocal.reduce((sum, s) => sum + s.pointsEarned, 0);
  const localMissingPts = missingScansLocal.reduce((sum, s) => sum + s.pointsEarned, 0);
  const verifyProgress = claimScans.length > 0
    ? (verifiedScansLocal.length + missingScansLocal.length) / claimScans.length
    : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <BackButton color={Colors.adminAccent} fallback="/(admin)" />
        <Text style={styles.headerTitle}>Claimed Rewards</Text>
        <TouchableOpacity onPress={fetchClaims} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={20} color={Colors.adminAccent} />
        </TouchableOpacity>
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
              <Text style={styles.emptySub}>Mechanics can claim their scan points from the app.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPending = item.status === "pending";
            const hasVerification = item.totalScans > 0;
            const allChecked = hasVerification && (item.verifiedScans + item.missingScans) === item.totalScans;
            return (
              <TouchableOpacity
                style={[styles.card, isPending && styles.cardPending]}
                onPress={() => isPending ? openVerifySheet(item) : null}
                activeOpacity={isPending ? 0.75 : 1}
              >
                <View style={styles.cardLeft}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{item.userName?.[0]?.toUpperCase() || "?"}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.userName || "—"}</Text>
                    <Text style={styles.cardRole}>{item.userRole?.toUpperCase()}</Text>
                    {item.userPhone && <Text style={styles.cardPhone}>{item.userPhone}</Text>}
                    <Text style={styles.cardDate}>{formatDate(item.claimedAt)}</Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  {/* Points breakdown */}
                  <View style={styles.pointsStack}>
                    <View style={styles.pointsBadge}>
                      <Text style={styles.pointsBadgeText}>{item.pointsClaimed}</Text>
                      <Text style={styles.pointsBadgeUnit}>total pts</Text>
                    </View>
                    {item.verifiedPoints > 0 && item.verifiedPoints < item.pointsClaimed && (
                      <>
                        <View style={styles.verifiedPtsBadge}>
                          <Feather name="check-circle" size={10} color="#10B981" />
                          <Text style={styles.verifiedPtsText}>{item.verifiedPoints} verified</Text>
                        </View>
                        <View style={styles.unverifiedPtsBadge}>
                          <Feather name="x-circle" size={10} color="#EF4444" />
                          <Text style={styles.unverifiedPtsText}>{item.pointsClaimed - item.verifiedPoints} deducted</Text>
                        </View>
                      </>
                    )}
                  </View>
                  {/* QR summary chips — moved here from left */}
                  {hasVerification && (
                    <View style={styles.qrSummaryCol}>
                      <View style={styles.qrSummaryChip}>
                        <Feather name="maximize" size={10} color={Colors.textSecondary} />
                        <Text style={styles.qrSummaryText}>{item.totalScans} QRs</Text>
                      </View>
                      {item.verifiedScans > 0 && (
                        <View style={[styles.qrSummaryChip, styles.qrSummaryVerified]}>
                          <Feather name="check" size={10} color="#10B981" />
                          <Text style={[styles.qrSummaryText, { color: "#10B981" }]}>{item.verifiedScans} verified</Text>
                        </View>
                      )}
                      {item.missingScans > 0 && (
                        <View style={[styles.qrSummaryChip, styles.qrSummaryMissing]}>
                          <Feather name="x" size={10} color="#EF4444" />
                          <Text style={[styles.qrSummaryText, { color: "#EF4444" }]}>{item.missingScans} missing</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {!hasVerification && (
                    <View style={[styles.statusBadge, isPending ? styles.statusPending : styles.statusReceived]}>
                      <Text style={[styles.statusText, isPending ? styles.statusTextPending : styles.statusTextReceived]}>
                        {isPending ? "Tap to Verify" : "Received"}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── Verification Bottom Sheet ── */}
      <Modal
        visible={!!verifyingClaim}
        animationType="slide"
        onRequestClose={() => setVerifyingClaim(null)}
      >
        <View style={[styles.verifyModalContainer, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.verifyHeader}>
            <TouchableOpacity onPress={() => setVerifyingClaim(null)} style={styles.closeBtn}>
              <Feather name="x" size={20} color={Colors.adminText} />
            </TouchableOpacity>
            <Text style={styles.verifyHeaderTitle}>Verify QR Codes</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Mechanic info bar */}
          {verifyingClaim && (
            <View style={styles.mechanicBar}>
              <View style={styles.mechAvatarCircle}>
                <Text style={styles.mechAvatarText}>
                  {verifyingClaim.userName?.[0]?.toUpperCase() || "?"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mechName}>{verifyingClaim.userName}</Text>
                <Text style={styles.mechPhone}>{verifyingClaim.userPhone || verifyingClaim.userRole?.toUpperCase()}</Text>
              </View>
              <Text style={styles.mechTotalPts}>{verifyingClaim.pointsClaimed} pts</Text>
            </View>
          )}

          {/* Progress */}
          {claimScans.length > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${verifyProgress * 100}%` },
                    verifyProgress === 1 && { backgroundColor: "#10B981" },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {verifiedScansLocal.length + missingScansLocal.length} of {claimScans.length} QRs checked
              </Text>
            </View>
          )}

          {/* Points split */}
          {claimScans.length > 0 && (
            <View style={styles.ptsSplitRow}>
              <View style={[styles.ptsSplitCard, styles.ptsSplitVerified]}>
                <Feather name="check-circle" size={16} color="#10B981" />
                <Text style={styles.ptsSplitValue}>{localVerifiedPts}</Text>
                <Text style={styles.ptsSplitLabel}>Verified pts</Text>
              </View>
              <View style={styles.ptsSplitSep} />
              <View style={[styles.ptsSplitCard, styles.ptsSplitPending]}>
                <Feather name="clock" size={16} color="#F59E0B" />
                <Text style={[styles.ptsSplitValue, { color: "#F59E0B" }]}>
                  {pendingScans.reduce((s, sc) => s + sc.pointsEarned, 0)}
                </Text>
                <Text style={styles.ptsSplitLabel}>Pending pts</Text>
              </View>
              <View style={styles.ptsSplitSep} />
              <View style={[styles.ptsSplitCard, styles.ptsSplitMissing]}>
                <Feather name="x-circle" size={16} color="#EF4444" />
                <Text style={[styles.ptsSplitValue, { color: "#EF4444" }]}>{localMissingPts}</Text>
                <Text style={styles.ptsSplitLabel}>Deducted pts</Text>
              </View>
            </View>
          )}

          {/* Scan QR button */}
          {pendingScans.length > 0 && (
            <TouchableOpacity style={styles.scanQrBtn} onPress={openScanner} activeOpacity={0.85}>
              <Feather name="maximize" size={18} color={Colors.white} />
              <Text style={styles.scanQrBtnText}>
                Scan QR to Verify ({pendingScans.length} remaining)
              </Text>
            </TouchableOpacity>
          )}

          {/* Scan list */}
          {scansLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.adminAccent} />
            </View>
          ) : (
            <ScrollView style={styles.scanList} contentContainerStyle={styles.scanListContent}>
              {claimScans.length === 0 ? (
                <View style={styles.emptyScans}>
                  <Text style={styles.emptyScansText}>No scan records found for this claim.</Text>
                </View>
              ) : (
                claimScans.map(scan => (
                  <ScanRow
                    key={scan.id}
                    scan={scan}
                    onMarkMissing={handleMarkMissing}
                    onScanQR={openScanner}
                  />
                ))
              )}
            </ScrollView>
          )}

          {/* Bottom: payment button */}
          <View style={[styles.verifyFooter, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[
                styles.payBtn,
                (localVerifiedPts === 0 || markingReceived) && styles.payBtnDisabled,
              ]}
              onPress={handleMarkReceived}
              disabled={localVerifiedPts === 0 || markingReceived}
              activeOpacity={0.85}
            >
              {markingReceived ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Feather name="credit-card" size={18} color={Colors.white} />
                  <Text style={styles.payBtnText}>
                    Mark Payment Made — {localVerifiedPts} pts
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* QR Scanner overlay (nested in verify modal) */}
        <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
          <View style={styles.scannerContainer}>
            {Platform.OS !== "web" && (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={qrScanned ? undefined : handleQrScanned}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              />
            )}
            <View style={[styles.scannerOverlay, { paddingTop: insets.top }]}>
              <View style={styles.scannerHeader}>
                <TouchableOpacity
                  onPress={() => setScannerOpen(false)}
                  style={styles.closeScannerBtn}
                >
                  <Feather name="x" size={22} color={Colors.white} />
                </TouchableOpacity>
                <Text style={styles.scannerTitle}>Verify QR Code</Text>
                <View style={{ width: 40 }} />
              </View>
              <View style={styles.scanArea}>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <Text style={styles.scanHint}>
                  {scanProcessing ? "Verifying..." : qrScanned ? "Processing..." : "Scan a QR code from this claim"}
                </Text>
                {verifyingClaim && (
                  <View style={styles.scannerInfo}>
                    <Text style={styles.scannerInfoText}>
                      {pendingScans.length} QR{pendingScans.length !== 1 ? "s" : ""} left to verify
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
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
                <Feather name="check-circle" size={14} color="#10B981" />
                <Text style={[styles.sheetDetailText, { color: "#10B981", fontFamily: "Inter_700Bold" }]}>
                  {smsTarget?.verifiedPoints} verified pts paid
                </Text>
              </View>
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
  refreshBtn: { padding: 8 },
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
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { color: Colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 15 },
  emptySub: { color: Colors.textLight, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", paddingHorizontal: 32 },

  // Claim card
  card: {
    backgroundColor: Colors.adminCard,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  cardPending: { borderColor: `${Colors.adminAccent}50`, borderWidth: 1.5 },
  cardLeft: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: `${Colors.adminAccent}20`,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  cardRole: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.textSecondary },
  cardPhone: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight },
  cardDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight, marginTop: 2 },
  qrSummaryRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  qrSummaryCol: { flexDirection: "column", gap: 4, alignItems: "flex-end", marginTop: 4 },
  qrSummaryChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#F0F0F0", borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  qrSummaryVerified: { backgroundColor: "#D1FAE5" },
  qrSummaryMissing: { backgroundColor: "#FEE2E2" },
  qrSummaryText: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  cardRight: { alignItems: "flex-end", gap: 6 },
  pointsStack: { alignItems: "flex-end", gap: 3 },
  pointsBadge: {
    backgroundColor: `${Colors.adminAccent}18`,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignItems: "center",
  },
  pointsBadgeText: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  pointsBadgeUnit: { fontSize: 9, fontFamily: "Inter_500Medium", color: Colors.adminAccent },
  verifiedPtsBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  verifiedPtsText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#10B981" },
  unverifiedPtsBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#FEE2E2", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  unverifiedPtsText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#EF4444" },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusPending: { backgroundColor: `${Colors.adminAccent}22` },
  statusReceived: { backgroundColor: `${Colors.success}18` },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  statusTextPending: { color: Colors.adminAccent },
  statusTextReceived: { color: Colors.success },

  // Verification modal
  verifyModalContainer: { flex: 1, backgroundColor: Colors.adminBg },
  verifyHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  verifyHeaderTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.adminText },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${Colors.adminAccent}12`,
    justifyContent: "center", alignItems: "center",
  },
  mechanicBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: `${Colors.adminAccent}10`,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  mechAvatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: `${Colors.adminAccent}25`,
    justifyContent: "center", alignItems: "center",
  },
  mechAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  mechName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.adminText },
  mechPhone: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  mechTotalPts: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.adminAccent },
  progressContainer: { paddingHorizontal: 20, paddingTop: 14, gap: 6 },
  progressBar: {
    height: 6, borderRadius: 3, backgroundColor: Colors.border, overflow: "hidden",
  },
  progressFill: {
    height: "100%", borderRadius: 3, backgroundColor: Colors.adminAccent,
  },
  progressLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },

  // Points split
  ptsSplitRow: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, marginTop: 12,
    backgroundColor: Colors.adminCard,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 14,
  },
  ptsSplitCard: { flex: 1, alignItems: "center", gap: 4 },
  ptsSplitVerified: {},
  ptsSplitPending: {},
  ptsSplitMissing: {},
  ptsSplitSep: { width: 1, height: 36, backgroundColor: Colors.border },
  ptsSplitValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.adminText },
  ptsSplitLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary },

  // Scan QR button
  scanQrBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.adminAccent,
    borderRadius: 12, paddingVertical: 12, marginHorizontal: 20, marginTop: 14,
    shadowColor: Colors.adminAccent, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  scanQrBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.white },

  // Scan list
  scanList: { flex: 1, marginTop: 12 },
  scanListContent: { paddingHorizontal: 20, paddingBottom: 8, gap: 8 },
  emptyScans: { alignItems: "center", paddingTop: 30 },
  emptyScansText: { color: Colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14 },

  // Footer payment button
  verifyFooter: {
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.adminCard,
  },
  payBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#10B981",
    borderRadius: 14, paddingVertical: 16,
    shadowColor: "#10B981", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  payBtnDisabled: { backgroundColor: Colors.border },
  payBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.white },

  // QR Scanner
  scannerContainer: { flex: 1, backgroundColor: "#000" },
  scannerOverlay: { flex: 1 },
  scannerHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  scannerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.white },
  closeScannerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },
  scanArea: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24 },
  scanFrame: { width: 240, height: 240, position: "relative" },
  corner: { position: "absolute", width: 36, height: 36, borderColor: Colors.adminAccent },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanHint: {
    backgroundColor: "rgba(0,0,0,0.65)",
    color: Colors.white, fontFamily: "Inter_500Medium", fontSize: 14,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
    textAlign: "center", maxWidth: 280,
  },
  scannerInfo: {
    backgroundColor: `${Colors.adminAccent}CC`,
    borderRadius: 16, paddingHorizontal: 18, paddingVertical: 8,
  },
  scannerInfoText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.white },

  // SMS sheet
  smsModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  smsSheet: {
    backgroundColor: Colors.adminCard,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
    gap: 14, alignItems: "center",
    borderTopWidth: 1, borderColor: Colors.border,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 4 },
  paymentSuccessIcon: { marginBottom: 2 },
  sheetTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.adminText },
  sheetSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  sheetName: { fontFamily: "Inter_700Bold", color: Colors.adminText },
  sheetDetail: {
    backgroundColor: `${Colors.adminAccent}10`, borderRadius: 14,
    padding: 14, width: "100%", gap: 8,
  },
  sheetDetailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sheetDetailText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.adminText },
  sendSmsBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.adminAccent, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 18, width: "100%",
    shadowColor: Colors.adminAccent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  sendSmsBtnTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  sendSmsBtnSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 2 },
  skipBtn: { paddingVertical: 12, alignItems: "center", width: "100%" },
  skipBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
});
