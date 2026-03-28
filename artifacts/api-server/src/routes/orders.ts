import { Router } from "express";
import { db, usersTable, vehiclesTable, ordersTable, orderItemsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth, requireSalesman, requireAdmin } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";

const router = Router();

// ─── Helper: fetch items for a set of order IDs ──────────────────────────────
async function getItemsForOrders(orderIds: number[]) {
  if (orderIds.length === 0) return {} as Record<number, OrderItemRow[]>;

  const rows = await db
    .select({
      orderId: orderItemsTable.orderId,
      vehicleId: orderItemsTable.vehicleId,
      vehicleName: vehiclesTable.name,
      quantity: orderItemsTable.quantity,
      unitPrice: orderItemsTable.unitPrice,
      totalPoints: orderItemsTable.totalPoints,
      bonusPoints: orderItemsTable.bonusPoints,
    })
    .from(orderItemsTable)
    .leftJoin(vehiclesTable, eq(orderItemsTable.vehicleId, vehiclesTable.id))
    .where(inArray(orderItemsTable.orderId, orderIds));

  const map: Record<number, OrderItemRow[]> = {};
  for (const r of rows) {
    if (!map[r.orderId]) map[r.orderId] = [];
    map[r.orderId].push({
      vehicleId: r.vehicleId,
      vehicleName: r.vehicleName ?? "—",
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      totalPoints: r.totalPoints,
      bonusPoints: r.bonusPoints,
      totalValue: r.quantity * r.unitPrice,
    });
  }
  return map;
}

interface OrderItemRow {
  vehicleId: number;
  vehicleName: string;
  quantity: number;
  unitPrice: number;
  totalPoints: number;
  bonusPoints: number;
  totalValue: number;
}

// ─── Helper: build unified items array (handles old single-vehicle orders) ────
function buildOrderItems(
  order: {
    vehicleId: number | null;
    vehicleName: string | null;
    quantity: number | null;
    salesPrice: number | null;
    totalPoints: number;
    bonusPoints: number;
  },
  itemsMap: Record<number, OrderItemRow[]>,
  orderId: number,
): OrderItemRow[] {
  const items = itemsMap[orderId];
  if (items && items.length > 0) return items;

  // Backward-compat: old single-vehicle order
  if (order.vehicleId && order.quantity) {
    const unitPrice = order.salesPrice ?? 0;
    return [{
      vehicleId: order.vehicleId,
      vehicleName: order.vehicleName ?? "—",
      quantity: order.quantity,
      unitPrice,
      totalPoints: order.totalPoints,
      bonusPoints: order.bonusPoints,
      totalValue: order.quantity * unitPrice,
    }];
  }
  return [];
}

// ─── GET /orders ──────────────────────────────────────────────────────────────
router.get("/", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const rows = await db
      .select({
        id: ordersTable.id,
        salesmanId: ordersTable.salesmanId,
        retailerId: ordersTable.retailerId,
        vehicleId: ordersTable.vehicleId,
        quantity: ordersTable.quantity,
        totalPoints: ordersTable.totalPoints,
        bonusPoints: ordersTable.bonusPoints,
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
      .where(caller.role === "admin" ? undefined : eq(ordersTable.salesmanId, caller.userId));

    const itemsMap = await getItemsForOrders(rows.map(r => r.id));

    res.json(rows.map(r => {
      const items = buildOrderItems(r, itemsMap, r.id);
      const totalValue = items.reduce((s, i) => s + i.totalValue, 0);
      return {
        id: r.id,
        salesmanId: r.salesmanId,
        retailerId: r.retailerId,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        retailerName: r.retailerName,
        retailerPhone: r.retailerPhone,
        totalPoints: r.totalPoints,
        bonusPoints: r.bonusPoints,
        totalValue,
        items,
      };
    }));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /orders ─────────────────────────────────────────────────────────────
router.post("/", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const { retailerId, items, vehicleId, quantity } = req.body;

    // Support both new format (items array) and old format (vehicleId + quantity)
    let orderItems: Array<{ vehicleId: number; quantity: number }> = [];
    if (Array.isArray(items) && items.length > 0) {
      orderItems = items;
    } else if (vehicleId && quantity) {
      orderItems = [{ vehicleId: Number(vehicleId), quantity: Number(quantity) }];
    } else {
      res.status(400).json({ error: "Provide items array or vehicleId+quantity" });
      return;
    }

    if (!retailerId) {
      res.status(400).json({ error: "retailerId is required" });
      return;
    }

    // Validate retailer
    const retailer = await db.select().from(usersTable).where(eq(usersTable.id, Number(retailerId)));
    if (!retailer.length || retailer[0].role !== "retailer") {
      res.status(400).json({ error: "Retailer not found" });
      return;
    }

    // Validate all vehicles and compute totals
    let orderTotalPoints = 0;
    let orderBonusPoints = 0;
    const resolvedItems: Array<{
      vehicleId: number;
      vehicleName: string;
      quantity: number;
      unitPrice: number;
      totalPoints: number;
      bonusPoints: number;
      totalValue: number;
    }> = [];

    for (const item of orderItems) {
      if (!item.vehicleId || !item.quantity || item.quantity < 1) {
        res.status(400).json({ error: "Each item needs vehicleId and quantity ≥ 1" });
        return;
      }
      const vehicle = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, Number(item.vehicleId)));
      if (!vehicle.length) {
        res.status(400).json({ error: `Vehicle ${item.vehicleId} not found` });
        return;
      }
      const v = vehicle[0];
      const itemTotalPoints = Number(item.quantity) * v.points;
      const itemBonusPoints = Math.round(itemTotalPoints * 0.1);
      orderTotalPoints += itemTotalPoints;
      orderBonusPoints += itemBonusPoints;
      resolvedItems.push({
        vehicleId: v.id,
        vehicleName: v.name,
        quantity: Number(item.quantity),
        unitPrice: v.salesPrice,
        totalPoints: itemTotalPoints,
        bonusPoints: itemBonusPoints,
        totalValue: Number(item.quantity) * v.salesPrice,
      });
    }

    // Insert order (no vehicleId for multi-item orders)
    const isMultiItem = resolvedItems.length > 1;
    const inserted = await db.insert(ordersTable).values({
      salesmanId: caller.userId,
      retailerId: Number(retailerId),
      vehicleId: isMultiItem ? null : resolvedItems[0].vehicleId,
      quantity: isMultiItem ? null : resolvedItems[0].quantity,
      totalPoints: orderTotalPoints,
      bonusPoints: orderBonusPoints,
      status: "pending",
    }).returning();

    const order = inserted[0];

    // Insert order items (always, for consistency)
    await db.insert(orderItemsTable).values(
      resolvedItems.map(item => ({
        orderId: order.id,
        vehicleId: item.vehicleId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPoints: item.totalPoints,
        bonusPoints: item.bonusPoints,
      }))
    );

    const totalValue = resolvedItems.reduce((s, i) => s + i.totalValue, 0);

    res.status(201).json({
      id: order.id,
      salesmanId: order.salesmanId,
      retailerId: order.retailerId,
      status: order.status,
      totalPoints: order.totalPoints,
      bonusPoints: order.bonusPoints,
      totalValue,
      createdAt: order.createdAt.toISOString(),
      retailerName: retailer[0].name,
      retailerPhone: retailer[0].phone,
      items: resolvedItems,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PUT /orders/:id/status ───────────────────────────────────────────────────
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

// ─── GET /orders/retailers ────────────────────────────────────────────────────
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

// ─── GET /orders/my-retail-orders ────────────────────────────────────────────
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
        vehicleId: ordersTable.vehicleId,
        quantity: ordersTable.quantity,
        totalPoints: ordersTable.totalPoints,
        bonusPoints: ordersTable.bonusPoints,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
        vehicleName: vehiclesTable.name,
        salesPrice: vehiclesTable.salesPrice,
        salesmanId: ordersTable.salesmanId,
        retailerId: ordersTable.retailerId,
      })
      .from(ordersTable)
      .leftJoin(vehiclesTable, eq(ordersTable.vehicleId, vehiclesTable.id))
      .where(eq(ordersTable.retailerId, caller.userId));

    const itemsMap = await getItemsForOrders(rows.map(r => r.id));

    res.json(rows.map(r => {
      const items = buildOrderItems(r, itemsMap, r.id);
      const totalValue = items.reduce((s, i) => s + i.totalValue, 0);
      return {
        id: r.id,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        totalPoints: r.totalPoints,
        totalValue,
        items,
      };
    }));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /orders/my-bonus ─────────────────────────────────────────────────────
router.get("/my-bonus", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const rows = await db
      .select({
        id: ordersTable.id,
        vehicleId: ordersTable.vehicleId,
        quantity: ordersTable.quantity,
        bonusPoints: ordersTable.bonusPoints,
        totalPoints: ordersTable.totalPoints,
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

    const itemsMap = await getItemsForOrders(rows.map(r => r.id));

    const ordersWithItems = rows.map(r => {
      const items = buildOrderItems(r, itemsMap, r.id);
      const totalValue = items.reduce((s, i) => s + i.totalValue, 0);
      return {
        id: r.id,
        bonusPoints: r.bonusPoints,
        totalPoints: r.totalPoints,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        retailerName: r.retailerName,
        retailerPhone: r.retailerPhone,
        totalValue,
        items,
      };
    });

    const totalBonus = ordersWithItems.reduce((s, r) => s + (r.status !== "cancelled" ? r.bonusPoints : 0), 0);
    const confirmedBonus = ordersWithItems.reduce((s, r) => s + (r.status === "confirmed" ? r.bonusPoints : 0), 0);
    const totalSalesValue = ordersWithItems.reduce((s, r) => s + (r.status !== "cancelled" ? r.totalValue : 0), 0);
    const confirmedSalesValue = ordersWithItems.reduce((s, r) => s + (r.status === "confirmed" ? r.totalValue : 0), 0);
    const totalOrders = ordersWithItems.filter(r => r.status !== "cancelled").length;

    res.json({
      totalBonus,
      confirmedBonus,
      totalSalesValue,
      confirmedSalesValue,
      totalOrders,
      orders: ordersWithItems,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
