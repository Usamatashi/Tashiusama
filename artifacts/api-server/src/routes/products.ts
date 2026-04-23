import { Router } from "express";
import { fdb, nextId, toISOString } from "../lib/firebase";
import { uploadBase64ToStorage, deleteFromStorage } from "../lib/storage";
import { requireAuth, requireAdmin } from "../lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "Gemini API key not configured" });
      return;
    }

    const snap = await fdb.collection("products").orderBy("createdAt", "desc").get();
    const products = snap.docs.map((d) => d.data());
    const productsWithDiagrams = products.filter((p) => p.diagramUrl);

    if (productsWithDiagrams.length === 0) {
      res.status(422).json({ error: "No product diagrams available for comparison. Please add diagrams to products first." });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const fetchImageAsBase64 = async (url: string): Promise<{ data: string; mimeType: string } | null> => {
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const contentType = response.headers.get("content-type") || "image/jpeg";
        return { data: base64, mimeType: contentType.split(";")[0] };
      } catch {
        return null;
      }
    };

    const diagramParts: { inlineData: { data: string; mimeType: string } }[] = [];
    const diagramLabels: string[] = [];

    for (const p of productsWithDiagrams) {
      const img = await fetchImageAsBase64(p.diagramUrl);
      if (img) {
        diagramParts.push({ inlineData: img });
        diagramLabels.push(`Product ID ${p.id}: ${p.name}${p.productNumber ? ` (#${p.productNumber})` : ""}${p.vehicleManufacturer ? ` - ${p.vehicleManufacturer}` : ""}`);
      }
    }

    if (diagramParts.length === 0) {
      res.status(422).json({ error: "Could not load any product diagrams for comparison." });
      return;
    }

    const labelList = diagramLabels.map((l, i) => `Diagram ${i + 1}: ${l}`).join("\n");
    const prompt = `You are an expert at identifying brake pad and disc pad shapes. 

I will show you:
1. A photo of a worn brake pad/disc pad (first image)
2. ${diagramParts.length} technical diagrams of different products

The diagrams are:
${labelList}

Compare the shape, outline, holes, notches, and tabs of the worn pad in the first photo against each diagram.

Respond ONLY with a valid JSON object in this exact format:
{
  "matchedProductId": <number or null>,
  "confidence": "high" | "medium" | "low",
  "reason": "<brief explanation of shape features matched>"
}

If no diagram matches, set matchedProductId to null.`;

    const wornPadImage = {
      inlineData: {
        data: photoBase64.replace(/^data:image\/\w+;base64,/, ""),
        mimeType: "image/jpeg",
      },
    };

    const contentParts: any[] = [wornPadImage, ...diagramParts, prompt];
    const result = await model.generateContent(contentParts);
    const text = result.response.text().trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: "Could not parse Gemini response" });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const matchedProduct = parsed.matchedProductId
      ? products.find((p) => p.id === parsed.matchedProductId) ?? null
      : null;

    res.json({
      matchedProductId: parsed.matchedProductId ?? null,
      confidence: parsed.confidence ?? "low",
      reason: parsed.reason ?? "",
      product: matchedProduct ? {
        id: matchedProduct.id,
        name: matchedProduct.name,
        points: matchedProduct.points,
        salesPrice: matchedProduct.salesPrice,
        category: matchedProduct.category,
        productNumber: matchedProduct.productNumber ?? null,
        vehicleManufacturer: matchedProduct.vehicleManufacturer ?? null,
        imageUrl: matchedProduct.imageUrl ?? null,
        diagramUrl: matchedProduct.diagramUrl ?? null,
      } : null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to identify pad" });
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
    if (imageBase64) {
      imageUrl = await uploadBase64ToStorage(imageBase64, `products/${id}/image`);
    }
    if (diagramBase64) {
      diagramUrl = await uploadBase64ToStorage(diagramBase64, `products/${id}/diagram`);
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
      diagramUrl,
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
      } else {
        await deleteFromStorage(`products/${id}/diagram`);
        updateData.diagramUrl = null;
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
