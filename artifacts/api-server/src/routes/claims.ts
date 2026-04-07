import { Router } from "express";
import { db, claimsTable, usersTable, scansTable, qrCodesTable, productsTable } from "@workspace/db";
import { eq, desc, sql, isNull, and, sum } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

// POST /api/claims - mechanic claims all their unlinked scans as one claim
router.post("/", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;

    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const user = users[0];
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Find all scans for this user that haven't been linked to a claim yet
    const unclaimedScans = await db
      .select()
      .from(scansTable)
      .where(and(eq(scansTable.userId, userId), isNull(scansTable.claimId)));

    if (!unclaimedScans.length) {
      res.status(400).json({ error: "No unclaimed scans to claim" });
      return;
    }

    const pointsToClaim = unclaimedScans.reduce((sum, s) => sum + s.pointsEarned, 0);
    const scanIds = unclaimedScans.map(s => s.id);

    // Deduct points from user
    await db
      .update(usersTable)
      .set({ points: sql`GREATEST(${usersTable.points} - ${pointsToClaim}, 0)` })
      .where(eq(usersTable.id, userId));

    // Create the claim
    const inserted = await db
      .insert(claimsTable)
      .values({ userId, pointsClaimed: pointsToClaim, verifiedPoints: 0 })
      .returning();

    const newClaim = inserted[0];

    // Link all unclaimed scans to this claim
    for (const scanId of scanIds) {
      await db
        .update(scansTable)
        .set({ claimId: newClaim.id, adminVerified: null })
        .where(eq(scansTable.id, scanId));
    }

    res.status(201).json({
      id: newClaim.id,
      pointsClaimed: pointsToClaim,
      scanCount: scanIds.length,
      claimedAt: newClaim.claimedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/claims - admin: all claims; mechanic/user: own claims
router.get("/", requireAuth, async (req, res) => {
  try {
    const { userId, role } = (req as any).user;

    if (role === "admin" || role === "super_admin") {
      const claims = await db
        .select({
          id: claimsTable.id,
          pointsClaimed: claimsTable.pointsClaimed,
          verifiedPoints: claimsTable.verifiedPoints,
          status: claimsTable.status,
          claimedAt: claimsTable.claimedAt,
          userName: usersTable.name,
          userPhone: usersTable.phone,
          userRole: usersTable.role,
          userId: usersTable.id,
        })
        .from(claimsTable)
        .leftJoin(usersTable, eq(claimsTable.userId, usersTable.id))
        .orderBy(desc(claimsTable.claimedAt));

      // For each claim, count total and verified scans
      const claimIds = claims.map(c => c.id);
      const scanCounts: Record<number, { total: number; verified: number; missing: number }> = {};
      if (claimIds.length > 0) {
        for (const claimId of claimIds) {
          const scans = await db
            .select({ adminVerified: scansTable.adminVerified, pointsEarned: scansTable.pointsEarned })
            .from(scansTable)
            .where(eq(scansTable.claimId, claimId));
          scanCounts[claimId] = {
            total: scans.length,
            verified: scans.filter(s => s.adminVerified === true).length,
            missing: scans.filter(s => s.adminVerified === false).length,
          };
        }
      }

      res.json(claims.map(c => ({
        id: c.id,
        pointsClaimed: c.pointsClaimed,
        verifiedPoints: c.verifiedPoints,
        unverifiedPoints: c.pointsClaimed - c.verifiedPoints,
        status: c.status,
        claimedAt: c.claimedAt.toISOString(),
        userName: c.userName || "",
        userPhone: c.userPhone || null,
        userRole: c.userRole || "",
        userId: c.userId || 0,
        totalScans: scanCounts[c.id]?.total || 0,
        verifiedScans: scanCounts[c.id]?.verified || 0,
        missingScans: scanCounts[c.id]?.missing || 0,
      })));
    } else {
      const claims = await db
        .select()
        .from(claimsTable)
        .where(eq(claimsTable.userId, userId))
        .orderBy(desc(claimsTable.claimedAt));

      res.json(claims.map(c => ({
        id: c.id,
        pointsClaimed: c.pointsClaimed,
        verifiedPoints: c.verifiedPoints,
        status: c.status,
        claimedAt: c.claimedAt.toISOString(),
      })));
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/claims/:id/scans - admin gets all scans for a claim
router.get("/:id/scans", requireAuth, requireAdmin, async (req, res) => {
  try {
    const claimId = Number(req.params.id);
    if (isNaN(claimId)) {
      res.status(400).json({ error: "Invalid claim id" });
      return;
    }

    const scans = await db
      .select({
        id: scansTable.id,
        pointsEarned: scansTable.pointsEarned,
        scannedAt: scansTable.scannedAt,
        adminVerified: scansTable.adminVerified,
        qrNumber: qrCodesTable.qrNumber,
        productName: productsTable.name,
      })
      .from(scansTable)
      .leftJoin(qrCodesTable, eq(scansTable.qrId, qrCodesTable.id))
      .leftJoin(productsTable, eq(qrCodesTable.productId, productsTable.id))
      .where(eq(scansTable.claimId, claimId));

    res.json(scans.map(s => ({
      id: s.id,
      pointsEarned: s.pointsEarned,
      scannedAt: s.scannedAt.toISOString(),
      adminVerified: s.adminVerified,
      qrNumber: s.qrNumber || "",
      productName: s.productName || "",
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/claims/:id/verify-qr - admin scans a QR to verify a scan in this claim
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

    // Find the QR code
    const qrRows = await db
      .select()
      .from(qrCodesTable)
      .where(eq(qrCodesTable.qrNumber, String(qrNumber)));

    if (!qrRows.length) {
      res.status(404).json({ error: "QR code not found", code: "QR_NOT_FOUND" });
      return;
    }

    const qr = qrRows[0];

    // Find the scan in this claim matching this QR
    const scanRows = await db
      .select()
      .from(scansTable)
      .where(and(eq(scansTable.claimId, claimId), eq(scansTable.qrId, qr.id)));

    if (!scanRows.length) {
      res.status(400).json({ error: "This QR code is not part of this claim", code: "NOT_IN_CLAIM" });
      return;
    }

    const scan = scanRows[0];

    if (scan.adminVerified === true) {
      res.status(400).json({ error: "This QR has already been verified", code: "ALREADY_VERIFIED" });
      return;
    }

    // Mark scan as verified
    await db
      .update(scansTable)
      .set({ adminVerified: true })
      .where(eq(scansTable.id, scan.id));

    // Recalculate verifiedPoints for the claim
    const claimScans = await db
      .select({ adminVerified: scansTable.adminVerified, pointsEarned: scansTable.pointsEarned })
      .from(scansTable)
      .where(eq(scansTable.claimId, claimId));

    const newVerifiedPoints = claimScans
      .filter(s => s.adminVerified === true)
      .reduce((sum, s) => sum + s.pointsEarned, 0);

    await db
      .update(claimsTable)
      .set({ verifiedPoints: newVerifiedPoints })
      .where(eq(claimsTable.id, claimId));

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

// POST /api/claims/:id/mark-missing - admin marks a scan as missing/unverified
router.post("/:id/mark-missing", requireAuth, requireAdmin, async (req, res) => {
  try {
    const claimId = Number(req.params.id);
    const { scanId } = req.body;

    if (isNaN(claimId) || !scanId) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }

    const scanRows = await db
      .select()
      .from(scansTable)
      .where(and(eq(scansTable.id, Number(scanId)), eq(scansTable.claimId, claimId)));

    if (!scanRows.length) {
      res.status(404).json({ error: "Scan not found in this claim" });
      return;
    }

    // Mark as explicitly unverified (missing QR)
    await db
      .update(scansTable)
      .set({ adminVerified: false })
      .where(eq(scansTable.id, Number(scanId)));

    // Recalculate verifiedPoints
    const claimScans = await db
      .select({ adminVerified: scansTable.adminVerified, pointsEarned: scansTable.pointsEarned })
      .from(scansTable)
      .where(eq(scansTable.claimId, claimId));

    const newVerifiedPoints = claimScans
      .filter(s => s.adminVerified === true)
      .reduce((sum, s) => sum + s.pointsEarned, 0);

    await db
      .update(claimsTable)
      .set({ verifiedPoints: newVerifiedPoints })
      .where(eq(claimsTable.id, claimId));

    res.json({ scanId, verifiedPoints: newVerifiedPoints });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/claims/:id - admin marks claim as received (payment done)
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const claimId = Number(req.params.id);
    if (isNaN(claimId)) {
      res.status(400).json({ error: "Invalid claim id" });
      return;
    }

    const updated = await db
      .update(claimsTable)
      .set({ status: "received" })
      .where(eq(claimsTable.id, claimId))
      .returning();

    if (!updated.length) {
      res.status(404).json({ error: "Claim not found" });
      return;
    }

    res.json({
      id: updated[0].id,
      status: updated[0].status,
      pointsClaimed: updated[0].pointsClaimed,
      verifiedPoints: updated[0].verifiedPoints,
      claimedAt: updated[0].claimedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
