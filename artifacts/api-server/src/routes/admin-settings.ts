import { Router } from "express";
import { db } from "@workspace/db";
import { adminSettingsTable } from "@workspace/db";
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

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(adminSettingsTable).limit(1);
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

router.put("/", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const settings = req.body;
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    const settingsJson = JSON.stringify(merged);

    const rows = await db.select().from(adminSettingsTable).limit(1);
    if (rows.length === 0) {
      await db.insert(adminSettingsTable).values({ settingsJson });
    } else {
      await db.update(adminSettingsTable).set({ settingsJson });
    }

    res.json(merged);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
