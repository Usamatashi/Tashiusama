import { Router } from "express";
import { fdb } from "../lib/firebase";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../lib/auth";

const DEFAULT_SETTINGS = {
  tab_dashboard: true,
  tab_products: true,
  tab_users: true,
  tab_payments: true,
  card_create_qr: true,
  card_orders: true,
  card_claims: true,
  card_create_ads: true,
  card_create_text: true,
  card_payments: true,
};

const SETTINGS_DOC = "adminSettings/global";

const router = Router();

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const doc = await fdb.doc(SETTINGS_DOC).get();
    if (!doc.exists) {
      res.json(DEFAULT_SETTINGS);
      return;
    }
    try {
      const parsed = JSON.parse(doc.data()!.settingsJson);
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
    const merged = { ...DEFAULT_SETTINGS, ...req.body };
    const settingsJson = JSON.stringify(merged);
    await fdb.doc(SETTINGS_DOC).set({ settingsJson });
    res.json(merged);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
