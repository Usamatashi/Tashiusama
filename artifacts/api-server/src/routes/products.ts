import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const products = await db.select().from(productsTable);
    res.json(products.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, points, salesPrice, category, imageBase64 } = req.body;
    if (!name || points === undefined) {
      res.status(400).json({ error: "Name and points are required" });
      return;
    }
    const inserted = await db.insert(productsTable).values({
      name,
      points: Number(points),
      salesPrice: Number(salesPrice) || 0,
      category: category || "other",
      imageBase64: imageBase64 || null,
    }).returning();
    const product = inserted[0];
    res.status(201).json({ ...product, createdAt: product.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, points, salesPrice, category, imageBase64 } = req.body;
    if (!name || points === undefined) {
      res.status(400).json({ error: "Name and points are required" });
      return;
    }
    const updateData: Record<string, unknown> = {
      name,
      points: Number(points),
      salesPrice: Number(salesPrice) || 0,
      category: category || "other",
    };
    if (imageBase64 !== undefined) {
      updateData.imageBase64 = imageBase64 || null;
    }
    const updated = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json({ ...updated[0], createdAt: updated[0].createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
