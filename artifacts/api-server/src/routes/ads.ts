import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { adsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// List ads — returns imageBase64 for images, mediaUrl for videos (no heavy base64 blob in list)
router.get("/", requireAuth, async (req, res) => {
  const ads = await db.select().from(adsTable).orderBy(adsTable.createdAt);
  const host = `${req.protocol}://${req.get("host")}`;
  res.json(
    ads.map((ad) => {
      if (ad.mediaType === "video") {
        return { id: ad.id, mediaType: ad.mediaType, title: ad.title, createdAt: ad.createdAt, mediaUrl: `${host}/api/ads/${ad.id}/media` };
      }
      return { id: ad.id, mediaType: ad.mediaType ?? "image", title: ad.title, createdAt: ad.createdAt, imageBase64: ad.imageBase64 };
    }),
  );
});

// Stream a single ad's media (video or image) by id
router.get("/:id/media", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.select().from(adsTable).where(eq(adsTable.id, id));
  const ad = rows[0];
  if (!ad) { res.status(404).json({ error: "Not found" }); return; }

  const dataUrl = ad.imageBase64;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) { res.status(500).json({ error: "Invalid media data" }); return; }

  const mime = match[1];
  const buf = Buffer.from(match[2], "base64");
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Length", buf.length);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(buf);
});

// Upload — supports JSON (images) and multipart FormData (videos)
router.post(
  "/",
  requireAuth,
  requireAdmin,
  (req, res, next) => {
    const ct = req.headers["content-type"] ?? "";
    if (ct.includes("multipart/form-data")) {
      upload.single("file")(req, res, next);
    } else {
      next();
    }
  },
  async (req, res) => {
    try {
      let imageBase64: string;
      let mediaType = "image";
      let title: string | null = null;

      if ((req as any).file) {
        const file = (req as any).file as Express.Multer.File;
        const b64 = file.buffer.toString("base64");
        const mime = file.mimetype || "video/mp4";
        imageBase64 = `data:${mime};base64,${b64}`;
        mediaType = (req.body.mediaType as string) || "video";
        title = (req.body.title as string) || null;
      } else {
        imageBase64 = req.body.imageBase64;
        if (!imageBase64) { res.status(400).json({ error: "No file or imageBase64 provided" }); return; }
        mediaType = req.body.mediaType || "image";
        title = req.body.title || null;
      }

      const [ad] = await db.insert(adsTable).values({ imageBase64, title, mediaType }).returning();

      // Return same shape as GET list
      const host = `${req.protocol}://${req.get("host")}`;
      if (mediaType === "video") {
        res.status(201).json({ id: ad.id, mediaType: ad.mediaType, title: ad.title, createdAt: ad.createdAt, mediaUrl: `${host}/api/ads/${ad.id}/media` });
      } else {
        res.status(201).json({ id: ad.id, mediaType: ad.mediaType, title: ad.title, createdAt: ad.createdAt, imageBase64: ad.imageBase64 });
      }
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(adsTable).where(eq(adsTable.id, id));
  res.json({ success: true });
});

export default router;
