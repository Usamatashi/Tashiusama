import { Router } from "express";
import { db, vehiclesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const vehicles = await db.select().from(vehiclesTable);
    res.json(vehicles.map(v => ({ ...v, createdAt: v.createdAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, points, salesPrice } = req.body;
    if (!name || points === undefined) {
      res.status(400).json({ error: "Name and points are required" });
      return;
    }
    const inserted = await db.insert(vehiclesTable).values({ name, points: Number(points), salesPrice: Number(salesPrice) || 0 }).returning();
    const vehicle = inserted[0];
    res.status(201).json({ ...vehicle, createdAt: vehicle.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, points, salesPrice } = req.body;
    if (!name || points === undefined) {
      res.status(400).json({ error: "Name and points are required" });
      return;
    }
    const updated = await db.update(vehiclesTable).set({ name, points: Number(points), salesPrice: Number(salesPrice) || 0 }).where(eq(vehiclesTable.id, id)).returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Vehicle not found" });
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
    await db.delete(vehiclesTable).where(eq(vehiclesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
