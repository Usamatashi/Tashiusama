import { Router } from "express";
import multer from "multer";
import { fdb, nextId, toISOString } from "../lib/firebase";
import { uploadBase64ToStorage, uploadBufferToStorage, deleteFromStorage } from "../lib/storage";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get("/", requireAuth, async (req, res) => {
  try {
    const snap = await fdb.collection("ads").orderBy("createdAt", "asc").get();
    res.json(
      snap.docs.map((d) => {
        const ad = d.data();
        return {
          id: ad.id,
          mediaType: ad.mediaType,
          title: ad.title ?? null,
          createdAt: toISOString(ad.createdAt),
          mediaUrl: ad.mediaUrl,
        };
      }),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
      const id = await nextId("ads");
      let mediaUrl: string;
      let mediaType = "image";
      let title: string | null = null;

      if ((req as any).file) {
        const file = (req as any).file as Express.Multer.File;
        const mime = file.mimetype || "video/mp4";
        mediaType = (req.body.mediaType as string) || "video";
        title = (req.body.title as string) || null;
        mediaUrl = await uploadBufferToStorage(file.buffer, mime, `ads/${id}/media`);
      } else {
        const { imageBase64, title: bodyTitle, mediaType: bodyMediaType } = req.body;
        if (!imageBase64) {
          res.status(400).json({ error: "No file or imageBase64 provided" });
          return;
        }
        mediaType = bodyMediaType || "image";
        title = bodyTitle || null;
        mediaUrl = await uploadBase64ToStorage(imageBase64, `ads/${id}/media`);
      }

      const ad = {
        id,
        mediaType,
        title,
        mediaUrl,
        createdAt: new Date(),
      };
      await fdb.collection("ads").doc(String(id)).set(ad);
      res.status(201).json({ ...ad, createdAt: toISOString(ad.createdAt) });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await deleteFromStorage(`ads/${id}/media`);
    await fdb.collection("ads").doc(String(id)).delete();
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
