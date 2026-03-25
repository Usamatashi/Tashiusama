import { Router } from "express";
import { db } from "@workspace/db";
import { tickerTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const router = Router();

// GET /api/ticker — public: returns all ticker texts
router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const rows = await db.select().from(tickerTable).orderBy(desc(tickerTable.createdAt));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/ticker — admin: create a new ticker text
router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { text } = req.body as { text: string };
    if (!text?.trim()) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    const [row] = await db.insert(tickerTable).values({ text: text.trim() }).returning();
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ticker/:id — admin: delete a ticker text
router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.delete(tickerTable).where(
      (await import("drizzle-orm")).eq(tickerTable.id, id)
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
