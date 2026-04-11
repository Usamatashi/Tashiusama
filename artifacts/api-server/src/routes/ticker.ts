import { Router } from "express";
import { fdb, nextId, toISOString } from "../lib/firebase";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const snap = await fdb.collection("ticker").orderBy("createdAt", "desc").get();
    res.json(
      snap.docs.map((d) => {
        const t = d.data();
        return { id: t.id, text: t.text, createdAt: toISOString(t.createdAt) };
      }),
    );
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { text } = req.body as { text: string };
    if (!text?.trim()) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    const id = await nextId("ticker");
    const row = { id, text: text.trim(), createdAt: new Date() };
    await fdb.collection("ticker").doc(String(id)).set(row);
    res.status(201).json({ ...row, createdAt: toISOString(row.createdAt) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await fdb.collection("ticker").doc(String(id)).delete();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
