import { Router } from "express";
import { fdb } from "../lib/firebase";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../lib/auth";

const DOC = "whatsappContacts/byRole";

const DEFAULT_CONTACTS = {
  mechanic: "923055198651",
  salesman: "923055198651",
  retailer: "923055198651",
};

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const doc = await fdb.doc(DOC).get();
    if (!doc.exists) {
      res.json(DEFAULT_CONTACTS);
      return;
    }
    try {
      const parsed = JSON.parse(doc.data()!.contactsJson);
      res.json({ ...DEFAULT_CONTACTS, ...parsed });
    } catch {
      res.json(DEFAULT_CONTACTS);
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { mechanic, salesman, retailer } = req.body as Record<string, string>;
    const merged = {
      ...DEFAULT_CONTACTS,
      ...(mechanic ? { mechanic: String(mechanic).replace(/\D/g, "") } : {}),
      ...(salesman ? { salesman: String(salesman).replace(/\D/g, "") } : {}),
      ...(retailer ? { retailer: String(retailer).replace(/\D/g, "") } : {}),
    };
    await fdb.doc(DOC).set({ contactsJson: JSON.stringify(merged) });
    res.json(merged);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
