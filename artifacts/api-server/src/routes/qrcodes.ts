import { Router } from "express";
import { fdb, nextId, toISOString } from "../lib/firebase";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const snap = await fdb.collection("qrCodes").orderBy("createdAt", "desc").get();
    res.json(
      snap.docs.map((d) => {
        const q = d.data();
        return {
          id: q.id,
          qrNumber: q.qrNumber,
          productId: q.productId,
          productName: q.productName || "",
          points: q.points,
          status: q.status,
          createdAt: toISOString(q.createdAt),
        };
      }),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { qrNumber, productId } = req.body;
    if (!qrNumber || !productId) {
      res.status(400).json({ error: "QR number and product ID are required" });
      return;
    }
    const productDoc = await fdb.collection("products").doc(String(productId)).get();
    if (!productDoc.exists) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const product = productDoc.data()!;

    const existingSnap = await fdb.collection("qrCodes").where("qrNumber", "==", String(qrNumber)).limit(1).get();
    if (!existingSnap.empty) {
      res.status(400).json({ error: "QR number already exists" });
      return;
    }

    const id = await nextId("qrCodes");
    const qr = {
      id,
      qrNumber: String(qrNumber),
      productId: Number(productId),
      productName: product.name,
      points: product.points,
      status: "unused",
      createdAt: new Date(),
    };
    await fdb.collection("qrCodes").doc(String(qrNumber)).set(qr);
    res.status(201).json({ ...qr, createdAt: toISOString(qr.createdAt) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/scan", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { qrNumber } = req.body;
    if (!qrNumber) {
      res.status(400).json({ error: "QR number required" });
      return;
    }

    const qrRef = fdb.collection("qrCodes").doc(String(qrNumber));
    const qrDoc = await qrRef.get();
    if (!qrDoc.exists) {
      res.status(400).json({ error: "QR code not found" });
      return;
    }
    const qr = qrDoc.data()!;
    if (qr.status === "used") {
      res.status(400).json({ error: "QR code has already been used" });
      return;
    }

    const userRef = fdb.collection("users").doc(String(userId));
    const scanId = await nextId("scans");

    const result = await fdb.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) throw new Error("User not found");
      const user = userDoc.data()!;
      const newPoints = (user.points || 0) + qr.points;
      t.update(qrRef, { status: "used" });
      t.update(userRef, { points: newPoints });
      t.set(fdb.collection("scans").doc(String(scanId)), {
        id: scanId,
        userId,
        qrId: qr.id,
        qrNumber: qr.qrNumber,
        productName: qr.productName || "",
        pointsEarned: qr.points,
        scannedAt: new Date(),
        claimId: null,
        adminVerified: null,
      });
      return { newPoints };
    });

    res.json({
      pointsEarned: qr.points,
      totalPoints: result.newPoints,
      productName: qr.productName || "",
      message: `You earned ${qr.points} points for ${qr.productName}!`,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
