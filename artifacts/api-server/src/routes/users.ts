import { Router } from "express";
import bcrypt from "bcryptjs";
import { fdb, nextId, toISOString } from "../lib/firebase";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const requestingUser = (req as any).user;
    const snap = await fdb.collection("users").get();
    const users = snap.docs.map((d) => d.data());
    const filtered = requestingUser.role === "super_admin"
      ? users
      : users.filter((u) => u.role !== "super_admin");
    res.json(
      filtered.map((u) => ({
        id: u.id,
        phone: u.phone,
        email: u.email ?? null,
        role: u.role,
        name: u.name ?? null,
        city: u.city ?? null,
        regionId: u.regionId ?? null,
        points: u.points,
        createdAt: toISOString(u.createdAt),
      })),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { phone, password, role, name, email, city, regionId } = req.body;
    if (!phone || !password || !role) {
      res.status(400).json({ error: "Phone, password, and role are required" });
      return;
    }
    const validRoles = ["admin", "salesman", "mechanic", "retailer"];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    if (role === "admin" && (req as any).user?.role !== "super_admin") {
      res.status(403).json({ error: "Only super admin can create admin accounts" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }
    const existing = await fdb.collection("users").where("phone", "==", phone.trim()).limit(1).get();
    if (!existing.empty) {
      res.status(400).json({ error: "Phone number already exists" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const id = await nextId("users");
    const user = {
      id,
      phone: phone.trim(),
      passwordHash,
      role,
      name: name?.trim() || null,
      email: email?.trim() || null,
      city: city?.trim() || null,
      regionId: regionId ? Number(regionId) : null,
      points: 0,
      createdAt: new Date(),
    };
    await fdb.collection("users").doc(String(id)).set(user);
    res.status(201).json({
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      name: user.name,
      city: user.city,
      regionId: user.regionId,
      points: user.points,
      createdAt: toISOString(user.createdAt),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/change-password", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const requestingUser = (req as any).user;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Current password and new password are required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }
    const userDoc = await fdb.collection("users").doc(String(requestingUser.userId)).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = userDoc.data()!;
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await userDoc.ref.update({ passwordHash: newHash });
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const { phone, role, name, email, city, password, regionId } = req.body;
    const validRoles = ["admin", "salesman", "mechanic", "retailer"];
    if (role && !validRoles.includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    const userRef = fdb.collection("users").doc(String(id));
    const existingDoc = await userRef.get();
    if (!existingDoc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const existing = existingDoc.data()!;
    if (existing.role === "super_admin" && password && (req as any).user?.role !== "super_admin") {
      res.status(403).json({ error: "Only super admin can update a super admin's password" });
      return;
    }
    if (phone && phone.trim() !== existing.phone) {
      const phoneCheck = await fdb.collection("users").where("phone", "==", phone.trim()).limit(1).get();
      if (!phoneCheck.empty) {
        res.status(400).json({ error: "Phone number already exists" });
        return;
      }
    }
    const updates: Record<string, unknown> = {};
    if (phone) updates.phone = phone.trim();
    if (role) updates.role = role;
    if (name !== undefined) updates.name = name?.trim() || null;
    if (email !== undefined) updates.email = email?.trim() || null;
    if (city !== undefined) updates.city = city?.trim() || null;
    if (regionId !== undefined) updates.regionId = regionId ? Number(regionId) : null;
    if (password) {
      if (password.length < 6) {
        res.status(400).json({ error: "Password must be at least 6 characters" });
        return;
      }
      updates.passwordHash = await bcrypt.hash(password, 10);
    }
    await userRef.update(updates);
    const updated = { ...existing, ...updates };
    res.json({
      id: updated.id,
      phone: updated.phone,
      email: updated.email ?? null,
      role: updated.role,
      name: updated.name ?? null,
      city: updated.city ?? null,
      regionId: updated.regionId ?? null,
      points: updated.points,
      createdAt: toISOString(updated.createdAt),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const userRef = fdb.collection("users").doc(String(id));
    const doc = await userRef.get();
    if (!doc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    await userRef.delete();
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
