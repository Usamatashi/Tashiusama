import { Router } from "express";
import { db } from "@workspace/db";
import { adminUserSettingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../lib/auth";

const DEFAULT_SETTINGS = {
  tab_dashboard: true,
  tab_vehicles: true,
  tab_users: true,
  tab_payments: true,
  card_create_qr: true,
  card_orders: true,
  card_claims: true,
  card_create_ads: true,
  card_create_text: true,
  card_payments: true,
};

const router = Router();

// GET /api/admin-user-settings/me — current admin's own settings
router.get("/me", requireAuth, requireAdmin, async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const userId = (req as any).user.id;
    const rows = await db
      .select()
      .from(adminUserSettingsTable)
      .where(eq(adminUserSettingsTable.userId, userId))
      .limit(1);
    if (rows.length === 0) {
      res.json(DEFAULT_SETTINGS);
      return;
    }
    try {
      const parsed = JSON.parse(rows[0].settingsJson);
      res.json({ ...DEFAULT_SETTINGS, ...parsed });
    } catch {
      res.json(DEFAULT_SETTINGS);
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin-user-settings — list all admins with their settings (super admin only)
router.get("/", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const admins = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        phone: usersTable.phone,
        role: usersTable.role,
      })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"));

    const settingsRows = await db.select().from(adminUserSettingsTable);
    const settingsMap: Record<number, object> = {};
    for (const row of settingsRows) {
      try {
        settingsMap[row.userId] = { ...DEFAULT_SETTINGS, ...JSON.parse(row.settingsJson) };
      } catch {
        settingsMap[row.userId] = DEFAULT_SETTINGS;
      }
    }

    const result = admins.map((admin) => ({
      ...admin,
      settings: settingsMap[admin.id] ?? DEFAULT_SETTINGS,
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin-user-settings/:userId — update a specific admin's settings (super admin only)
router.put("/:userId", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }

    // Verify target is an admin
    const target = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!target.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (target[0].role !== "admin") {
      res.status(400).json({ error: "Target user is not an admin" });
      return;
    }

    const merged = { ...DEFAULT_SETTINGS, ...req.body };
    const settingsJson = JSON.stringify(merged);

    const existing = await db
      .select()
      .from(adminUserSettingsTable)
      .where(eq(adminUserSettingsTable.userId, userId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(adminUserSettingsTable).values({ userId, settingsJson });
    } else {
      await db
        .update(adminUserSettingsTable)
        .set({ settingsJson, updatedAt: new Date() })
        .where(eq(adminUserSettingsTable.userId, userId));
    }

    res.json(merged);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
