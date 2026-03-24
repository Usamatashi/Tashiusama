import { Router } from "express";
import { db, qrCodesTable, vehiclesTable, usersTable, scansTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const qrs = await db
      .select({
        id: qrCodesTable.id,
        qrNumber: qrCodesTable.qrNumber,
        vehicleId: qrCodesTable.vehicleId,
        vehicleName: vehiclesTable.name,
        points: qrCodesTable.points,
        status: qrCodesTable.status,
        createdAt: qrCodesTable.createdAt,
      })
      .from(qrCodesTable)
      .leftJoin(vehiclesTable, eq(qrCodesTable.vehicleId, vehiclesTable.id));
    res.json(qrs.map(q => ({ ...q, createdAt: q.createdAt!.toISOString(), vehicleName: q.vehicleName || "" })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { qrNumber, vehicleId } = req.body;
    if (!qrNumber || !vehicleId) {
      res.status(400).json({ error: "QR number and vehicle ID are required" });
      return;
    }
    const vehicles = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, Number(vehicleId)));
    const vehicle = vehicles[0];
    if (!vehicle) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }
    const inserted = await db.insert(qrCodesTable).values({
      qrNumber: String(qrNumber),
      vehicleId: Number(vehicleId),
      points: vehicle.points,
      status: "unused",
    }).returning();
    const qr = inserted[0];
    res.status(201).json({
      id: qr.id,
      qrNumber: qr.qrNumber,
      vehicleId: qr.vehicleId,
      vehicleName: vehicle.name,
      points: qr.points,
      status: qr.status,
      createdAt: qr.createdAt.toISOString(),
    });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(400).json({ error: "QR number already exists" });
      return;
    }
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/scan", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { qrNumber } = req.body;
    if (!qrNumber) {
      res.status(400).json({ error: "QR number required" });
      return;
    }
    const qrs = await db
      .select({
        id: qrCodesTable.id,
        qrNumber: qrCodesTable.qrNumber,
        vehicleId: qrCodesTable.vehicleId,
        vehicleName: vehiclesTable.name,
        points: qrCodesTable.points,
        status: qrCodesTable.status,
      })
      .from(qrCodesTable)
      .leftJoin(vehiclesTable, eq(qrCodesTable.vehicleId, vehiclesTable.id))
      .where(eq(qrCodesTable.qrNumber, String(qrNumber)));
    const qr = qrs[0];
    if (!qr) {
      res.status(400).json({ error: "QR code not found" });
      return;
    }
    if (qr.status === "used") {
      res.status(400).json({ error: "QR code has already been used" });
      return;
    }
    await db.update(qrCodesTable).set({ status: "used" }).where(eq(qrCodesTable.id, qr.id));
    const updatedUsers = await db
      .update(usersTable)
      .set({ points: sql`${usersTable.points} + ${qr.points}` })
      .where(eq(usersTable.id, userId))
      .returning();
    await db.insert(scansTable).values({
      userId,
      qrId: qr.id,
      pointsEarned: qr.points,
    });
    res.json({
      pointsEarned: qr.points,
      totalPoints: updatedUsers[0]?.points || 0,
      vehicleName: qr.vehicleName || "",
      message: `You earned ${qr.points} points for ${qr.vehicleName}!`,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
