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
  card_commission: true,
};

const router = Router();

router.get("/me", requireAuth, requireAdmin, async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const userId = (req as any).user.userId;
    const doc = await fdb.collection("adminUserSettings").doc(String(userId)).get();
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

router.get("/", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const [adminsSnap, settingsSnap] = await Promise.all([
      fdb.collection("users").where("role", "==", "admin").get(),
      fdb.collection("adminUserSettings").get(),
    ]);
    const settingsMap: Record<string, object> = {};
    settingsSnap.forEach((doc) => {
      try {
        settingsMap[doc.id] = { ...DEFAULT_SETTINGS, ...JSON.parse(doc.data().settingsJson) };
      } catch {
        settingsMap[doc.id] = DEFAULT_SETTINGS;
      }
    });
    res.json(
      adminsSnap.docs.map((d) => {
        const admin = d.data();
        return {
          id: admin.id, name: admin.name ?? null, phone: admin.phone, role: admin.role,
          settings: settingsMap[d.id] ?? DEFAULT_SETTINGS,
        };
      }),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:userId", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }
    const doc = await fdb.collection("adminUserSettings").doc(String(userId)).get();
    if (!doc.exists) { res.json(DEFAULT_SETTINGS); return; }
    try {
      res.json({ ...DEFAULT_SETTINGS, ...JSON.parse(doc.data()!.settingsJson) });
    } catch {
      res.json(DEFAULT_SETTINGS);
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:userId", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }
    const targetDoc = await fdb.collection("users").doc(String(userId)).get();
    if (!targetDoc.exists) { res.status(404).json({ error: "User not found" }); return; }
    if (targetDoc.data()!.role !== "admin") { res.status(400).json({ error: "Target user is not an admin" }); return; }
    const merged = { ...DEFAULT_SETTINGS, ...req.body };
    const settingsJson = JSON.stringify(merged);
    await fdb.collection("adminUserSettings").doc(String(userId)).set({
      userId, settingsJson, updatedAt: new Date(),
    });
    res.json(merged);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
