import { Router } from "express";
import { db, regionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const regions = await db.select({
      id: regionsTable.id,
      name: regionsTable.name,
    }).from(regionsTable).orderBy(regionsTable.name);
    res.json(regions);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: "Region name is required" });
      return;
    }
    const inserted = await db.insert(regionsTable).values({ name: name.trim() }).returning();
    res.status(201).json(inserted[0]);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(400).json({ error: "Region name already exists" });
      return;
    }
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(regionsTable).where(eq(regionsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
