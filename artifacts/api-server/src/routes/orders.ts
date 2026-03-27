import { Router } from "express";
import { db, usersTable, vehiclesTable, ordersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSalesman, requireAdmin } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";

const router = Router();

// GET /orders — salesman sees their own orders; admin sees all
router.get("/", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const rows = await db
      .select({
        id: ordersTable.id,
        quantity: ordersTable.quantity,
        totalPoints: ordersTable.totalPoints,
        bonusPoints: ordersTable.bonusPoints,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
        vehicleName: vehiclesTable.name,
        salesPrice: vehiclesTable.salesPrice,
        retailerName: usersTable.name,
        retailerPhone: usersTable.phone,
        retailerId: ordersTable.retailerId,
        vehicleId: ordersTable.vehicleId,
        salesmanId: ordersTable.salesmanId,
      })
      .from(ordersTable)
      .leftJoin(vehiclesTable, eq(ordersTable.vehicleId, vehiclesTable.id))
      .leftJoin(usersTable, eq(ordersTable.retailerId, usersTable.id))
      .where(caller.role === "admin" ? undefined : eq(ordersTable.salesmanId, caller.userId));

    res.json(rows.map(r => ({
      ...r,
      totalValue: (r.quantity ?? 0) * (r.salesPrice ?? 0),
      createdAt: r.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /orders — salesman places a new order
router.post("/", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const { retailerId, vehicleId, quantity } = req.body;
    if (!retailerId || !vehicleId || !quantity || quantity < 1) {
      res.status(400).json({ error: "retailerId, vehicleId and quantity (≥1) are required" });
      return;
    }

    // Verify retailer exists and is a retailer
    const retailer = await db.select().from(usersTable).where(eq(usersTable.id, Number(retailerId)));
    if (!retailer.length || retailer[0].role !== "retailer") {
      res.status(400).json({ error: "Retailer not found" });
      return;
    }

    // Get vehicle for points calc
    const vehicle = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, Number(vehicleId)));
    if (!vehicle.length) {
      res.status(400).json({ error: "Vehicle not found" });
      return;
    }

    const totalPoints = Number(quantity) * vehicle[0].points;
    const bonusPoints = Math.round(totalPoints * 0.1); // 10% bonus for salesman

    const inserted = await db.insert(ordersTable).values({
      salesmanId: caller.userId,
      retailerId: Number(retailerId),
      vehicleId: Number(vehicleId),
      quantity: Number(quantity),
      totalPoints,
      bonusPoints,
      status: "pending",
    }).returning();

    const order = inserted[0];
    res.status(201).json({
      id: order.id,
      salesmanId: order.salesmanId,
      retailerId: order.retailerId,
      vehicleId: order.vehicleId,
      quantity: order.quantity,
      totalPoints: order.totalPoints,
      bonusPoints: order.bonusPoints,
      status: order.status,
      vehicleName: vehicle[0].name,
      retailerName: retailer[0].name,
      retailerPhone: retailer[0].phone,
      createdAt: order.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /orders/:id/status — admin can confirm or cancel
router.put("/:id/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    const updated = await db.update(ordersTable).set({ status }).where(eq(ordersTable.id, id)).returning();
    if (!updated.length) { res.status(404).json({ error: "Order not found" }); return; }
    res.json({ ...updated[0], createdAt: updated[0].createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /orders/retailers — search retailers (for salesman dropdown)
router.get("/retailers", requireAuth, requireSalesman, async (req, res) => {
  try {
    const search = (req.query.search as string || "").toLowerCase();
    const rows = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      phone: usersTable.phone,
      city: usersTable.city,
    }).from(usersTable).where(eq(usersTable.role, "retailer"));

    const filtered = search
      ? rows.filter(r =>
          (r.name?.toLowerCase().includes(search)) ||
          r.phone.toLowerCase().includes(search)
        )
      : rows;

    res.json(filtered);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /orders/my-retail-orders — retailer sees their own orders
router.get("/my-retail-orders", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    if (caller.role !== "retailer" && caller.role !== "admin") {
      res.status(403).json({ error: "Retailer access required" });
      return;
    }
    const rows = await db
      .select({
        id: ordersTable.id,
        quantity: ordersTable.quantity,
        totalPoints: ordersTable.totalPoints,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
        vehicleName: vehiclesTable.name,
        salesPrice: vehiclesTable.salesPrice,
        salesmanId: ordersTable.salesmanId,
        retailerId: ordersTable.retailerId,
        vehicleId: ordersTable.vehicleId,
      })
      .from(ordersTable)
      .leftJoin(vehiclesTable, eq(ordersTable.vehicleId, vehiclesTable.id))
      .where(eq(ordersTable.retailerId, caller.userId));
    res.json(rows.map(r => ({
      ...r,
      totalValue: (r.quantity ?? 0) * (r.salesPrice ?? 0),
      createdAt: r.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /orders/my-bonus — salesman financial summary
router.get("/my-bonus", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const rows = await db
      .select({
        id: ordersTable.id,
        bonusPoints: ordersTable.bonusPoints,
        totalPoints: ordersTable.totalPoints,
        quantity: ordersTable.quantity,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
        vehicleName: vehiclesTable.name,
        salesPrice: vehiclesTable.salesPrice,
        retailerName: usersTable.name,
        retailerPhone: usersTable.phone,
      })
      .from(ordersTable)
      .leftJoin(vehiclesTable, eq(ordersTable.vehicleId, vehiclesTable.id))
      .leftJoin(usersTable, eq(ordersTable.retailerId, usersTable.id))
      .where(eq(ordersTable.salesmanId, caller.userId));

    const totalBonus = rows.reduce((sum, r) => sum + (r.status !== "cancelled" ? r.bonusPoints : 0), 0);
    const confirmedBonus = rows.reduce((sum, r) => sum + (r.status === "confirmed" ? r.bonusPoints : 0), 0);
    const totalSalesValue = rows.reduce((sum, r) => sum + (r.status !== "cancelled" ? (r.quantity ?? 0) * (r.salesPrice ?? 0) : 0), 0);
    const confirmedSalesValue = rows.reduce((sum, r) => sum + (r.status === "confirmed" ? (r.quantity ?? 0) * (r.salesPrice ?? 0) : 0), 0);
    const totalOrders = rows.filter(r => r.status !== "cancelled").length;

    res.json({
      totalBonus,
      confirmedBonus,
      totalSalesValue,
      confirmedSalesValue,
      totalOrders,
      orders: rows.map(r => ({
        ...r,
        totalValue: (r.quantity ?? 0) * (r.salesPrice ?? 0),
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
