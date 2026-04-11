import { Router } from "express";
import { fdb, nextId, toISOString, chunkArray } from "../lib/firebase";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;

    const userDoc = await fdb.collection("users").doc(String(userId)).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const unclaimedSnap = await fdb
      .collection("scans")
      .where("userId", "==", userId)
      .where("claimId", "==", null)
      .get();

    if (unclaimedSnap.empty) {
      res.status(400).json({ error: "No unclaimed scans to claim" });
      return;
    }

    const unclaimedScans = unclaimedSnap.docs.map((d) => ({ ref: d.ref, ...d.data() }));
    const pointsToClaim = unclaimedScans.reduce((sum, s) => sum + (s.pointsEarned as number), 0);

    const claimId = await nextId("claims");
    const claimedAt = new Date();

    await fdb.runTransaction(async (t) => {
      const userRef = fdb.collection("users").doc(String(userId));
      const freshUser = await t.get(userRef);
      const currentPoints = (freshUser.data()?.points || 0) as number;
      const newPoints = Math.max(currentPoints - pointsToClaim, 0);
      t.update(userRef, { points: newPoints });

      t.set(fdb.collection("claims").doc(String(claimId)), {
        id: claimId,
        userId,
        pointsClaimed: pointsToClaim,
        verifiedPoints: 0,
        status: "pending",
        claimedAt,
      });

      for (const scan of unclaimedScans) {
        t.update(scan.ref, { claimId, adminVerified: null });
      }
    });

    res.status(201).json({
      id: claimId,
      pointsClaimed: pointsToClaim,
      scanCount: unclaimedScans.length,
      claimedAt: claimedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const { userId, role } = (req as any).user;

    if (role === "admin" || role === "super_admin") {
      const claimsSnap = await fdb.collection("claims").orderBy("claimedAt", "desc").get();
      const claims = claimsSnap.docs.map((d) => d.data());

      const userIds = [...new Set(claims.map((c) => c.userId as number))];
      const userMap = new Map<number, any>();
      if (userIds.length) {
        const batches = chunkArray(userIds, 30);
        for (const batch of batches) {
          const refs = batch.map((id) => fdb.collection("users").doc(String(id)));
          const docs = await fdb.getAll(...refs);
          docs.forEach((doc) => {
            if (doc.exists) userMap.set(parseInt(doc.id), doc.data());
          });
        }
      }

      const claimIds = claims.map((c) => c.id as number);
      const scanCountMap: Record<number, { total: number; verified: number; missing: number }> = {};
      if (claimIds.length) {
        const batches = chunkArray(claimIds, 30);
        for (const batch of batches) {
          const scansSnap = await fdb.collection("scans").where("claimId", "in", batch).get();
          scansSnap.forEach((doc) => {
            const s = doc.data();
            const cid = s.claimId as number;
            if (!scanCountMap[cid]) scanCountMap[cid] = { total: 0, verified: 0, missing: 0 };
            scanCountMap[cid].total++;
            if (s.adminVerified === true) scanCountMap[cid].verified++;
            if (s.adminVerified === false) scanCountMap[cid].missing++;
          });
        }
      }

      res.json(
        claims.map((c) => {
          const user = userMap.get(c.userId as number);
          return {
            id: c.id,
            pointsClaimed: c.pointsClaimed,
            verifiedPoints: c.verifiedPoints,
            unverifiedPoints: (c.pointsClaimed as number) - (c.verifiedPoints as number),
            status: c.status,
            claimedAt: toISOString(c.claimedAt),
            userName: user?.name || "",
            userPhone: user?.phone || null,
            userRole: user?.role || "",
            userId: c.userId,
            totalScans: scanCountMap[c.id as number]?.total || 0,
            verifiedScans: scanCountMap[c.id as number]?.verified || 0,
            missingScans: scanCountMap[c.id as number]?.missing || 0,
          };
        }),
      );
    } else {
      const claimsSnap = await fdb
        .collection("claims")
        .where("userId", "==", userId)
        .get();
      res.json(
        claimsSnap.docs.map((d) => {
          const c = d.data();
          return {
            id: c.id,
            pointsClaimed: c.pointsClaimed,
            verifiedPoints: c.verifiedPoints,
            status: c.status,
            claimedAt: toISOString(c.claimedAt),
          };
        }),
      );
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/scans", requireAuth, requireAdmin, async (req, res) => {
  try {
    const claimId = Number(req.params.id);
    if (isNaN(claimId)) {
      res.status(400).json({ error: "Invalid claim id" });
      return;
    }
    const scansSnap = await fdb.collection("scans").where("claimId", "==", claimId).get();
    res.json(
      scansSnap.docs.map((d) => {
        const s = d.data();
        return {
          id: s.id,
          pointsEarned: s.pointsEarned,
          scannedAt: toISOString(s.scannedAt),
          adminVerified: s.adminVerified ?? null,
          qrNumber: s.qrNumber || "",
          productName: s.productName || "",
        };
      }),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/verify-qr", requireAuth, requireAdmin, async (req, res) => {
  try {
    const claimId = Number(req.params.id);
    const { qrNumber } = req.body;
    if (isNaN(claimId)) {
      res.status(400).json({ error: "Invalid claim id" });
      return;
    }
    if (!qrNumber) {
      res.status(400).json({ error: "qrNumber is required" });
      return;
    }

    const qrDoc = await fdb.collection("qrCodes").doc(String(qrNumber)).get();
    if (!qrDoc.exists) {
      res.status(404).json({ error: "QR code not found", code: "QR_NOT_FOUND" });
      return;
    }
    const qr = qrDoc.data()!;

    const scansSnap = await fdb
      .collection("scans")
      .where("claimId", "==", claimId)
      .where("qrId", "==", qr.id)
      .limit(1)
      .get();

    if (scansSnap.empty) {
      res.status(400).json({ error: "This QR code is not part of this claim", code: "NOT_IN_CLAIM" });
      return;
    }
    const scanDoc = scansSnap.docs[0];
    const scan = scanDoc.data();
    if (scan.adminVerified === true) {
      res.status(400).json({ error: "This QR has already been verified", code: "ALREADY_VERIFIED" });
      return;
    }

    await scanDoc.ref.update({ adminVerified: true });

    const allScansSnap = await fdb.collection("scans").where("claimId", "==", claimId).get();
    const newVerifiedPoints = allScansSnap.docs
      .filter((d) => d.data().adminVerified === true || d.id === scanDoc.id)
      .reduce((sum, d) => sum + (d.data().pointsEarned as number), 0);

    await fdb.collection("claims").doc(String(claimId)).update({ verifiedPoints: newVerifiedPoints });

    res.json({
      scanId: scan.id,
      pointsEarned: scan.pointsEarned,
      verifiedPoints: newVerifiedPoints,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/mark-missing", requireAuth, requireAdmin, async (req, res) => {
  try {
    const claimId = Number(req.params.id);
    const { scanId } = req.body;
    if (isNaN(claimId) || !scanId) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }

    const scanDoc = await fdb.collection("scans").doc(String(scanId)).get();
    if (!scanDoc.exists || scanDoc.data()!.claimId !== claimId) {
      res.status(404).json({ error: "Scan not found in this claim" });
      return;
    }

    await scanDoc.ref.update({ adminVerified: false });

    const allScansSnap = await fdb.collection("scans").where("claimId", "==", claimId).get();
    const newVerifiedPoints = allScansSnap.docs
      .filter((d) => d.data().adminVerified === true && d.id !== String(scanId))
      .reduce((sum, d) => sum + (d.data().pointsEarned as number), 0);

    await fdb.collection("claims").doc(String(claimId)).update({ verifiedPoints: newVerifiedPoints });

    res.json({ scanId, verifiedPoints: newVerifiedPoints });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const claimId = Number(req.params.id);
    if (isNaN(claimId)) {
      res.status(400).json({ error: "Invalid claim id" });
      return;
    }
    const claimRef = fdb.collection("claims").doc(String(claimId));
    const doc = await claimRef.get();
    if (!doc.exists) {
      res.status(404).json({ error: "Claim not found" });
      return;
    }
    await claimRef.update({ status: "received" });
    const updated = { ...doc.data(), status: "received" };
    res.json({
      id: updated.id,
      status: updated.status,
      pointsClaimed: updated.pointsClaimed,
      verifiedPoints: updated.verifiedPoints,
      claimedAt: toISOString(updated.claimedAt),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
