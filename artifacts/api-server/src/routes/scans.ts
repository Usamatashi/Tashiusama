import { Router } from "express";
import { db, scansTable, qrCodesTable, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

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

export default router;
