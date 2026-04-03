import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const requestingUser = (req as any).user;
    const users = await db.select({
      id: usersTable.id,
      phone: usersTable.phone,
      email: usersTable.email,
      role: usersTable.role,
      name: usersTable.name,
      city: usersTable.city,
      directoryPhone: usersTable.directoryPhone,
      regionId: usersTable.regionId,
      points: usersTable.points,
      createdAt: usersTable.createdAt,
    }).from(usersTable);
    const filtered = requestingUser.role === "super_admin"
      ? users
      : users.filter(u => u.role !== "super_admin");
    res.json(filtered.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { phone, password, role, name, email, city, directoryPhone, regionId } = req.body;
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
    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await db.insert(usersTable).values({
      phone: phone.trim(),
      passwordHash,
      role,
      name: name?.trim() || null,
      email: email?.trim() || null,
      city: city?.trim() || null,
      directoryPhone: directoryPhone?.trim() || null,
      regionId: regionId ? Number(regionId) : null,
      points: 0,
    }).returning();
    const user = inserted[0];
    res.status(201).json({
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      name: user.name,
      city: user.city,
      directoryPhone: user.directoryPhone,
      regionId: user.regionId,
      points: user.points,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(400).json({ error: "Phone number already exists" });
      return;
    }
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
    const rows = await db.select({ passwordHash: usersTable.passwordHash })
      .from(usersTable).where(eq(usersTable.id, requestingUser.userId));
    if (!rows.length) { res.status(404).json({ error: "User not found" }); return; }
    const match = await bcrypt.compare(currentPassword, rows[0].passwordHash);
    if (!match) { res.status(400).json({ error: "Current password is incorrect" }); return; }
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, requestingUser.userId));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid user id" }); return; }
    const { phone, role, name, email, city, directoryPhone, password, regionId } = req.body;
    const validRoles = ["admin", "salesman", "mechanic", "retailer"];
    if (role && !validRoles.includes(role)) {
      res.status(400).json({ error: "Invalid role" }); return;
    }
    const existing = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, id));
    if (!existing.length) { res.status(404).json({ error: "User not found" }); return; }
    if (existing[0].role === "super_admin" && password && (req as any).user?.role !== "super_admin") {
      res.status(403).json({ error: "Only super admin can update a super admin's password" });
      return;
    }
    const updates: Record<string, any> = {};
    if (phone) updates.phone = phone.trim();
    if (role) updates.role = role;
    if (name !== undefined) updates.name = name?.trim() || null;
    if (email !== undefined) updates.email = email?.trim() || null;
    if (city !== undefined) updates.city = city?.trim() || null;
    if (directoryPhone !== undefined) updates.directoryPhone = directoryPhone?.trim() || null;
    if (regionId !== undefined) updates.regionId = regionId ? Number(regionId) : null;
    if (password) {
      if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
      updates.passwordHash = await bcrypt.hash(password, 10);
    }
    const updated = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    if (!updated.length) { res.status(404).json({ error: "User not found" }); return; }
    const user = updated[0];
    res.json({
      id: user.id, phone: user.phone, email: user.email, role: user.role,
      name: user.name, city: user.city, directoryPhone: user.directoryPhone,
      regionId: user.regionId, points: user.points,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err: any) {
    if (err.code === "23505") { res.status(400).json({ error: "Phone number already exists" }); return; }
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid user id" }); return; }
    const deleted = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
    if (!deleted.length) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
