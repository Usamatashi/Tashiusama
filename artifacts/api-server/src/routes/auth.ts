import { Router } from "express";
import bcrypt from "bcryptjs";
import { fdb, toISOString } from "../lib/firebase";
import { signToken, requireAuth } from "../lib/auth";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      res.status(400).json({ error: "Phone and password required" });
      return;
    }
    const snap = await fdb.collection("users").where("phone", "==", phone.trim()).limit(1).get();
    if (snap.empty) {
      res.status(401).json({ error: "Invalid phone or password" });
      return;
    }
    const userDoc = snap.docs[0];
    const user = userDoc.data();
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid phone or password" });
      return;
    }
    const token = signToken({ userId: user.id, role: user.role, phone: user.phone });
    res.json({
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name ?? null,
        role: user.role,
        points: user.points,
        createdAt: toISOString(user.createdAt),
      },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword are required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }
    const userRef = fdb.collection("users").doc(String(userId));
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = userDoc.data()!;
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await userRef.update({ passwordHash: hashed });
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const userDoc = await fdb.collection("users").doc(String(userId)).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = userDoc.data()!;
    res.json({
      id: user.id,
      phone: user.phone,
      name: user.name ?? null,
      role: user.role,
      points: user.points,
      createdAt: toISOString(user.createdAt),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
