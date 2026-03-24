import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      points: usersTable.points,
      createdAt: usersTable.createdAt,
    }).from(usersTable);
    res.json(users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      res.status(400).json({ error: "Email, password, and role are required" });
      return;
    }
    const validRoles = ["admin", "salesman", "mechanic", "retailer"];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await db.insert(usersTable).values({
      email: email.toLowerCase(),
      passwordHash,
      role,
      points: 0,
    }).returning();
    const user = inserted[0];
    res.status(201).json({
      id: user.id,
      email: user.email,
      role: user.role,
      points: user.points,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(400).json({ error: "Email already exists" });
      return;
    }
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
