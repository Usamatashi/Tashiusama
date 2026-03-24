import { Router } from "express";
import { db, claimsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

// POST /api/claims - user claims all their current points
router.post("/", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;

    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const user = users[0];
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.points <= 0) {
      res.status(400).json({ error: "No points to claim" });
      return;
    }

    const pointsToClaim = user.points;

    // Deduct points from user
    await db.update(usersTable).set({ points: 0 }).where(eq(usersTable.id, userId));

    // Create claim record
    const inserted = await db.insert(claimsTable).values({
      userId,
      pointsClaimed: pointsToClaim,
    }).returning();

    res.status(201).json({
      id: inserted[0].id,
      pointsClaimed: pointsToClaim,
      claimedAt: inserted[0].claimedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/claims - admin: all claims with user info; user: own claims
router.get("/", requireAuth, async (req, res) => {
  try {
    const { userId, role } = (req as any).user;

    if (role === "admin") {
      const claims = await db
        .select({
          id: claimsTable.id,
          pointsClaimed: claimsTable.pointsClaimed,
          claimedAt: claimsTable.claimedAt,
          userEmail: usersTable.email,
          userRole: usersTable.role,
          userId: usersTable.id,
        })
        .from(claimsTable)
        .leftJoin(usersTable, eq(claimsTable.userId, usersTable.id))
        .orderBy(desc(claimsTable.claimedAt));

      res.json(claims.map(c => ({
        id: c.id,
        pointsClaimed: c.pointsClaimed,
        claimedAt: c.claimedAt.toISOString(),
        userEmail: c.userEmail || "",
        userRole: c.userRole || "",
        userId: c.userId || 0,
      })));
    } else {
      const claims = await db
        .select()
        .from(claimsTable)
        .where(eq(claimsTable.userId, userId))
        .orderBy(desc(claimsTable.claimedAt));

      res.json(claims.map(c => ({
        id: c.id,
        pointsClaimed: c.pointsClaimed,
        claimedAt: c.claimedAt.toISOString(),
      })));
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
