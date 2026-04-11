import { Router } from "express";
import { fdb, toISOString, toDate } from "../lib/firebase";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const snap = await fdb.collection("scans").where("userId", "==", userId).get();
    const sorted = snap.docs.map((d) => d.data()).sort((a, b) => toDate(b.scannedAt).getTime() - toDate(a.scannedAt).getTime());
    res.json(
      sorted.map((s) => {
        return {
          id: s.id,
          qrNumber: s.qrNumber || "",
          productName: s.productName || "",
          pointsEarned: s.pointsEarned,
          scannedAt: toISOString(s.scannedAt),
        };
      }),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
