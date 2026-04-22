import { Router } from "express";
import { fdb, nextId, toISOString } from "../lib/firebase";
import { uploadBase64ToStorage, deleteFromStorage } from "../lib/storage";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

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
          createdAt: toISOString(p.createdAt),
        };
      }),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, points, salesPrice, category, productNumber, vehicleManufacturer, imageBase64 } = req.body;
    if (!name || points === undefined) {
      res.status(400).json({ error: "Name and points are required" });
      return;
    }
    const id = await nextId("products");
    let imageUrl: string | null = null;
    if (imageBase64) {
      imageUrl = await uploadBase64ToStorage(imageBase64, `products/${id}/image`);
    }
    const cat = category || "other";
    const product = {
      id,
      name,
      points: Number(points),
      salesPrice: Number(salesPrice) || 0,
      category: cat,
      productNumber: cat === "other" ? null : (productNumber ? String(productNumber).trim() : null),
      vehicleManufacturer: cat === "other" ? null : (vehicleManufacturer ? String(vehicleManufacturer).trim() : null),
      imageUrl,
      createdAt: new Date(),
    };
    await fdb.collection("products").doc(String(id)).set(product);
    res.status(201).json({ ...product, createdAt: toISOString(product.createdAt) });
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
    const { name, points, salesPrice, category, productNumber, vehicleManufacturer, imageBase64 } = req.body;
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
    await fdb.collection("products").doc(String(id)).delete();
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
