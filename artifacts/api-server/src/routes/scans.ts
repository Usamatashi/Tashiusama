import { Router } from "express";
import { db, scansTable, qrCodesTable, productsTable, claimsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const scans = await db
      .select({
        id: scansTable.id,
        qrNumber: qrCodesTable.qrNumber,
        productName: productsTable.name,
        pointsEarned: scansTable.pointsEarned,
        scannedAt: scansTable.scannedAt,
      })
      .from(scansTable)
      .leftJoin(qrCodesTable, eq(scansTable.qrId, qrCodesTable.id))
      .leftJoin(productsTable, eq(qrCodesTable.productId, productsTable.id))
      .where(eq(scansTable.userId, userId));
    res.json(scans.map(s => ({
      id: s.id,
      qrNumber: s.qrNumber || "",
      productName: s.productName || "",
      pointsEarned: s.pointsEarned,
      scannedAt: s.scannedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/scans/by-qr/:qrNumber - admin looks up scan details by QR number for verification
router.get("/by-qr/:qrNumber", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { qrNumber } = req.params;

    const rows = await db
      .select({
        scanId: scansTable.id,
        pointsEarned: scansTable.pointsEarned,
        scannedAt: scansTable.scannedAt,
        qrNumber: qrCodesTable.qrNumber,
        productName: productsTable.name,
        mechanicId: usersTable.id,
        mechanicName: usersTable.name,
        mechanicPhone: usersTable.phone,
        mechanicRole: usersTable.role,
        claimId: claimsTable.id,
      })
      .from(scansTable)
      .leftJoin(qrCodesTable, eq(scansTable.qrId, qrCodesTable.id))
      .leftJoin(productsTable, eq(qrCodesTable.productId, productsTable.id))
      .leftJoin(usersTable, eq(scansTable.userId, usersTable.id))
      .leftJoin(claimsTable, eq(claimsTable.scanId, scansTable.id))
      .where(eq(qrCodesTable.qrNumber, qrNumber));

    if (!rows.length) {
      // Check if QR exists at all
      const qrRows = await db
        .select({ id: qrCodesTable.id, status: qrCodesTable.status })
        .from(qrCodesTable)
        .where(eq(qrCodesTable.qrNumber, qrNumber));

      if (!qrRows.length) {
        res.status(404).json({ error: "QR code not found" });
        return;
      }
      res.status(400).json({ error: "This QR code has not been scanned by any mechanic yet" });
      return;
    }

    const row = rows[0];
    const alreadyClaimed = row.claimId !== null;

    res.json({
      scanId: row.scanId,
      pointsEarned: row.pointsEarned,
      scannedAt: row.scannedAt.toISOString(),
      qrNumber: row.qrNumber || qrNumber,
      productName: row.productName || "",
      mechanic: {
        id: row.mechanicId,
        name: row.mechanicName || "Unknown",
        phone: row.mechanicPhone || null,
        role: row.mechanicRole || "",
      },
      alreadyClaimed,
      claimId: row.claimId ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
