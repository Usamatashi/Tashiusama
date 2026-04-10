import { Router } from "express";
import { db, pushTokensTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";

const router = Router();

// POST /api/push-token  — register or update a push token for the current user
router.post("/", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const { token } = req.body;

    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "token is required" });
      return;
    }

    // Upsert: if this token already exists (possibly for another user), reassign it.
    // If user already has this token, do nothing.
    const existing = await db
      .select()
      .from(pushTokensTable)
      .where(eq(pushTokensTable.token, token));

    if (existing.length) {
      if (existing[0].userId !== caller.userId) {
        await db
          .update(pushTokensTable)
          .set({ userId: caller.userId })
          .where(eq(pushTokensTable.token, token));
      }
    } else {
      await db.insert(pushTokensTable).values({
        userId: caller.userId,
        token,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
