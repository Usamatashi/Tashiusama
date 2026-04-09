import { Router } from "express";
import { db } from "@workspace/db";
import { adsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const ads = await db.select().from(adsTable).orderBy(adsTable.createdAt);
  res.json(ads);
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { imageBase64, title, mediaType } = req.body;
  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }
  const [ad] = await db
    .insert(adsTable)
    .values({ imageBase64, title: title ?? null, mediaType: mediaType ?? "image" })
    .returning();
  res.status(201).json(ad);
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(adsTable).where(eq(adsTable.id, id));
  res.json({ success: true });
});

export default router;
