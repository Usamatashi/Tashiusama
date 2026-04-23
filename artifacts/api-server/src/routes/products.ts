import { Router } from "express";
import { fdb, nextId, toISOString } from "../lib/firebase";
import { uploadBase64ToStorage, deleteFromStorage } from "../lib/storage";
import { requireAuth, requireAdmin } from "../lib/auth";
import { getImageEmbedding, getImageEmbeddingFromUrl, cosineSimilarity } from "../lib/embeddings";

const router = Router();

const HIGH_CONFIDENCE = 0.75;
const LOW_CONFIDENCE = 0.65;

router.get("/", requireAuth, async (req, res) => {
  try {
    const snap = await fdb.collection("products").orderBy("createdAt", "desc").get();
    res.json(
      snap.docs.map((d) => {
        const p = d.data();
        return {
          id: p.id,
          name: p.name,
          points: p.points,
          salesPrice: p.salesPrice,
          category: p.category,
          productNumber: p.productNumber ?? null,
          vehicleManufacturer: p.vehicleManufacturer ?? null,
          imageUrl: p.imageUrl ?? null,
          diagramUrl: p.diagramUrl ?? null,
          createdAt: toISOString(p.createdAt),
        };
      }),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/identify", requireAuth, async (req, res) => {
  try {
    const { photoBase64 } = req.body;
    if (!photoBase64) {
      res.status(400).json({ error: "photoBase64 is required" });
      return;
    }

    const snap = await fdb.collection("products").get();
    const products = snap.docs.map((d) => d.data());
    const productsWithEmbeddings = products.filter(
      (p) => Array.isArray(p.diagramEmbedding) && p.diagramEmbedding.length > 0,
    );

    if (productsWithEmbeddings.length === 0) {
      res.status(422).json({
        error:
          "No product diagrams have embeddings yet. Run POST /api/products/admin/backfill-embeddings as an admin.",
      });
      return;
    }

    const cleanBase64 = photoBase64.replace(/^data:image\/\w+;base64,/, "");
    const photoEmbedding = await getImageEmbedding(Buffer.from(cleanBase64, "base64"));

    let best: { product: Record<string, unknown>; score: number } | null = null;
    for (const p of productsWithEmbeddings) {
      const score = cosineSimilarity(photoEmbedding, p.diagramEmbedding as number[]);
      if (!best || score > best.score) best = { product: p, score };
    }

    if (!best) {
      res.status(500).json({ error: "Failed to score products" });
      return;
    }

    let confidence: "high" | "medium" | "low";
    let matchedProductId: number | null = null;
    let matchedProduct: Record<string, unknown> | null = null;
    let reason: string;

    if (best.score >= HIGH_CONFIDENCE) {
      confidence = "high";
      matchedProductId = best.product.id as number;
      matchedProduct = best.product;
      reason = `Visual match score ${best.score.toFixed(3)}`;
    } else if (best.score >= LOW_CONFIDENCE) {
      confidence = "medium";
      matchedProductId = best.product.id as number;
      matchedProduct = best.product;
      reason = `Low-confidence visual match (score ${best.score.toFixed(3)}). Please verify before confirming.`;
    } else {
      confidence = "low";
      reason = `No confident match (best score ${best.score.toFixed(3)}). Please retake the photo with better lighting and angle.`;
    }

    res.json({
      matchedProductId,
      confidence,
      reason,
      score: best.score,
      product: matchedProduct
        ? {
            id: matchedProduct.id,
            name: matchedProduct.name,
            points: matchedProduct.points,
            salesPrice: matchedProduct.salesPrice,
            category: matchedProduct.category,
            productNumber: matchedProduct.productNumber ?? null,
            vehicleManufacturer: matchedProduct.vehicleManufacturer ?? null,
            imageUrl: matchedProduct.imageUrl ?? null,
            diagramUrl: matchedProduct.diagramUrl ?? null,
          }
        : null,
    });
  } catch (err) {
    req.log.error({ err }, "identify failed");
    res.status(500).json({ error: "Failed to identify pad" });
  }
});

router.post("/admin/backfill-embeddings", requireAuth, requireAdmin, async (req, res) => {
  try {
    const snap = await fdb.collection("products").get();
    const products = snap.docs.map((d) => ({ ref: d.ref, data: d.data() }));

    const targets = products.filter(
      (p) =>
        p.data.diagramUrl &&
        (!Array.isArray(p.data.diagramEmbedding) || p.data.diagramEmbedding.length === 0),
    );

    let processed = 0;
    let failed = 0;
    const errors: { id: unknown; error: string }[] = [];

    for (const t of targets) {
      try {
        const emb = await getImageEmbeddingFromUrl(t.data.diagramUrl);
        await t.ref.update({ diagramEmbedding: emb });
        processed++;
      } catch (e: any) {
        failed++;
        errors.push({ id: t.data.id, error: e?.message ?? String(e) });
      }
    }

    res.json({
      total: targets.length,
      processed,
      failed,
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    req.log.error({ err }, "backfill failed");
    res.status(500).json({ error: "Backfill failed" });
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, points, salesPrice, category, productNumber, vehicleManufacturer, imageBase64, diagramBase64 } = req.body;
    if (!name || points === undefined) {
      res.status(400).json({ error: "Name and points are required" });
      return;
    }
    const id = await nextId("products");
    let imageUrl: string | null = null;
    let diagramUrl: string | null = null;
    let diagramEmbedding: number[] | null = null;

    if (imageBase64) {
      imageUrl = await uploadBase64ToStorage(imageBase64, `products/${id}/image`);
    }
    if (diagramBase64) {
      diagramUrl = await uploadBase64ToStorage(diagramBase64, `products/${id}/diagram`);
      try {
        const cleanB64 = diagramBase64.replace(/^data:image\/\w+;base64,/, "");
        diagramEmbedding = await getImageEmbedding(Buffer.from(cleanB64, "base64"));
      } catch (e) {
        req.log.error({ err: e }, "Failed to generate embedding on create");
      }
    }
    const cat = category || "other";
    const product: Record<string, unknown> = {
      id,
      name,
      points: Number(points),
      salesPrice: Number(salesPrice) || 0,
      category: cat,
      productNumber: cat === "other" ? null : (productNumber ? String(productNumber).trim() : null),
      vehicleManufacturer: cat === "other" ? null : (vehicleManufacturer ? String(vehicleManufacturer).trim() : null),
      imageUrl,
      diagramUrl,
      createdAt: new Date(),
    };
    if (diagramEmbedding) product.diagramEmbedding = diagramEmbedding;
    await fdb.collection("products").doc(String(id)).set(product);
    res.status(201).json({ ...product, createdAt: toISOString(product.createdAt as Date), diagramEmbedding: undefined });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid product id" });
      return;
    }
    const { name, points, salesPrice, category, productNumber, vehicleManufacturer, imageBase64, diagramBase64 } = req.body;
    if (!name || points === undefined) {
      res.status(400).json({ error: "Name and points are required" });
      return;
    }
    const productRef = fdb.collection("products").doc(String(id));
    const doc = await productRef.get();
    if (!doc.exists) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const cat = category || "other";
    const updateData: Record<string, unknown> = {
      name,
      points: Number(points),
      salesPrice: Number(salesPrice) || 0,
      category: cat,
      productNumber: cat === "other" ? null : (productNumber ? String(productNumber).trim() : null),
      vehicleManufacturer: cat === "other" ? null : (vehicleManufacturer ? String(vehicleManufacturer).trim() : null),
    };
    if (imageBase64 !== undefined) {
      if (imageBase64) {
        await deleteFromStorage(`products/${id}/image`);
        updateData.imageUrl = await uploadBase64ToStorage(imageBase64, `products/${id}/image`);
      } else {
        await deleteFromStorage(`products/${id}/image`);
        updateData.imageUrl = null;
      }
    }
    if (diagramBase64 !== undefined) {
      if (diagramBase64) {
        await deleteFromStorage(`products/${id}/diagram`);
        updateData.diagramUrl = await uploadBase64ToStorage(diagramBase64, `products/${id}/diagram`);
        try {
          const cleanB64 = diagramBase64.replace(/^data:image\/\w+;base64,/, "");
          updateData.diagramEmbedding = await getImageEmbedding(Buffer.from(cleanB64, "base64"));
        } catch (e) {
          req.log.error({ err: e }, "Failed to generate embedding on update");
          updateData.diagramEmbedding = null;
        }
      } else {
        await deleteFromStorage(`products/${id}/diagram`);
        updateData.diagramUrl = null;
        updateData.diagramEmbedding = null;
      }
    }
    await productRef.update(updateData);
    const updated = { ...doc.data(), ...updateData };
    res.json({
      id: updated.id,
      name: updated.name,
      points: updated.points,
      salesPrice: updated.salesPrice,
      category: updated.category,
      productNumber: updated.productNumber ?? null,
      vehicleManufacturer: updated.vehicleManufacturer ?? null,
      imageUrl: updated.imageUrl ?? null,
      diagramUrl: updated.diagramUrl ?? null,
      createdAt: toISOString(updated.createdAt),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid product id" });
      return;
    }
    await deleteFromStorage(`products/${id}/image`);
    await deleteFromStorage(`products/${id}/diagram`);
    await fdb.collection("products").doc(String(id)).delete();
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
