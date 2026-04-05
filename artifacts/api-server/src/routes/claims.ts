import { Router } from "express";
import { db, claimsTable, usersTable, scansTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
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

    if (role === "admin" || role === "super_admin") {
      const claims = await db
        .select({
          id: claimsTable.id,
          pointsClaimed: claimsTable.pointsClaimed,
          status: claimsTable.status,
          claimedAt: claimsTable.claimedAt,
          userName: usersTable.name,
          userPhone: usersTable.phone,
          userRole: usersTable.role,
          userId: usersTable.id,
        })
        .from(claimsTable)
        .leftJoin(usersTable, eq(claimsTable.userId, usersTable.id))
        .orderBy(desc(claimsTable.claimedAt));

      res.json(claims.map(c => ({
        id: c.id,
        pointsClaimed: c.pointsClaimed,
        status: c.status,
        claimedAt: c.claimedAt.toISOString(),
        userName: c.userName || "",
        userPhone: c.userPhone || null,
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
        status: c.status,
        claimedAt: c.claimedAt.toISOString(),
      })));
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/claims/:id - admin marks claim as received
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const claimId = Number(req.params.id);
    if (isNaN(claimId)) {
      res.status(400).json({ error: "Invalid claim id" });
      return;
    }

    const updated = await db
      .update(claimsTable)
      .set({ status: "received" })
      .where(eq(claimsTable.id, claimId))
      .returning();

    if (!updated.length) {
      res.status(404).json({ error: "Claim not found" });
      return;
    }

    res.json({
      id: updated[0].id,
      status: updated[0].status,
      pointsClaimed: updated[0].pointsClaimed,
      claimedAt: updated[0].claimedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/claims/:id/mark-received - admin marks claim as received (alias)
router.post("/:id/mark-received", requireAuth, requireAdmin, async (req, res) => {
  try {
    const claimId = Number(req.params.id);
    if (isNaN(claimId)) {
      res.status(400).json({ error: "Invalid claim id" });
      return;
    }

    const updated = await db
      .update(claimsTable)
      .set({ status: "received" })
      .where(eq(claimsTable.id, claimId))
      .returning();

    if (!updated.length) {
      res.status(404).json({ error: "Claim not found" });
      return;
    }

    res.json({
      id: updated[0].id,
      status: updated[0].status,
      pointsClaimed: updated[0].pointsClaimed,
      claimedAt: updated[0].claimedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/claims/from-scan - admin creates a claim for a mechanic based on a specific scan
router.post("/from-scan", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { scanId } = req.body;
    if (!scanId || isNaN(Number(scanId))) {
      res.status(400).json({ error: "scanId is required" });
      return;
    }

    const scanIdNum = Number(scanId);

    // Check scan exists
    const scanRows = await db
      .select()
      .from(scansTable)
      .where(eq(scansTable.id, scanIdNum));

    const scan = scanRows[0];
    if (!scan) {
      res.status(404).json({ error: "Scan not found" });
      return;
    }

    // Check not already claimed via this scan
    const existingClaims = await db
      .select()
      .from(claimsTable)
      .where(eq(claimsTable.scanId, scanIdNum));

    if (existingClaims.length > 0) {
      res.status(400).json({ error: "This scan has already been claimed" });
      return;
    }

    // Get mechanic info
    const userRows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, scan.userId));

    const mechanic = userRows[0];
    if (!mechanic) {
      res.status(404).json({ error: "Mechanic user not found" });
      return;
    }

    const pointsToClaim = scan.pointsEarned;

    // Deduct points from mechanic
    await db
      .update(usersTable)
      .set({ points: sql`GREATEST(${usersTable.points} - ${pointsToClaim}, 0)` })
      .where(eq(usersTable.id, mechanic.id));

    // Create claim linked to this scan
    const inserted = await db
      .insert(claimsTable)
      .values({
        userId: mechanic.id,
        pointsClaimed: pointsToClaim,
        scanId: scanIdNum,
        status: "pending",
      })
      .returning();

    res.status(201).json({
      id: inserted[0].id,
      pointsClaimed: pointsToClaim,
      scanId: scanIdNum,
      claimedAt: inserted[0].claimedAt.toISOString(),
      mechanicName: mechanic.name || "",
      mechanicPhone: mechanic.phone || null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
