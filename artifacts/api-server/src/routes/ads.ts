import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { adsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get("/", requireAuth, async (_req, res) => {
  const ads = await db.select().from(adsTable).orderBy(adsTable.createdAt);
  res.json(ads);
});

// Supports two upload modes:
//  1. JSON body: { imageBase64, mediaType?, title? }  — used for image banners
//  2. Multipart form: file field + mediaType + title  — used for video uploads
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
        // Multipart upload (video)
        const file = (req as any).file as Express.Multer.File;
        const b64 = file.buffer.toString("base64");
        const mime = file.mimetype || "video/mp4";
        imageBase64 = `data:${mime};base64,${b64}`;
        mediaType = (req.body.mediaType as string) || "video";
        title = (req.body.title as string) || null;
      } else {
        // JSON upload (image)
        imageBase64 = req.body.imageBase64;
        if (!imageBase64) {
          res.status(400).json({ error: "No file or imageBase64 provided" });
          return;
        }
        mediaType = req.body.mediaType || "image";
        title = req.body.title || null;
      }

      const [ad] = await db
        .insert(adsTable)
        .values({ imageBase64, title, mediaType })
        .returning();

      res.status(201).json(ad);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

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
