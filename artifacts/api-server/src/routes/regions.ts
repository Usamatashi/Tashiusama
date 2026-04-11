import { Router } from "express";
import { fdb, nextId, toISOString } from "../lib/firebase";
import { requireAuth, requireSuperAdmin } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const snap = await fdb.collection("regions").orderBy("name", "asc").get();
    res.json(
      snap.docs.map((d) => {
        const r = d.data();
        return { id: r.id, name: r.name };
      }),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: "Region name is required" });
      return;
    }
    const existing = await fdb.collection("regions").where("name", "==", name.trim()).limit(1).get();
    if (!existing.empty) {
      res.status(400).json({ error: "Region name already exists" });
      return;
    }
    const id = await nextId("regions");
    const region = { id, name: name.trim(), createdAt: new Date() };
    await fdb.collection("regions").doc(String(id)).set(region);
    res.status(201).json({ id: region.id, name: region.name, createdAt: toISOString(region.createdAt) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid region id" });
      return;
    }
    await fdb.collection("regions").doc(String(id)).delete();
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
