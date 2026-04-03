import { Router } from "express";
import { db, usersTable, productsTable, ordersTable, orderItemsTable } from "@workspace/db";
import { eq, inArray, and, gte, lt, ne } from "drizzle-orm";
import { requireAuth, requireSalesman, requireAdmin } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";

const router = Router();

// ─── Helper: fetch items for a set of order IDs ──────────────────────────────
async function getItemsForOrders(orderIds: number[]) {
  if (orderIds.length === 0) return {} as Record<number, OrderItemRow[]>;

  const rows = await db
    .select({
      orderId: orderItemsTable.orderId,
      productId: orderItemsTable.productId,
      productName: productsTable.name,
      quantity: orderItemsTable.quantity,
      unitPrice: orderItemsTable.unitPrice,
      totalPoints: orderItemsTable.totalPoints,
      bonusPoints: orderItemsTable.bonusPoints,
    })
    .from(orderItemsTable)
    .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
    .where(inArray(orderItemsTable.orderId, orderIds));

  const map: Record<number, OrderItemRow[]> = {};
  for (const r of rows) {
    if (!map[r.orderId]) map[r.orderId] = [];
    map[r.orderId].push({
      productId: r.productId,
      productName: r.productName ?? "—",
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
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPoints: number;
  bonusPoints: number;
  totalValue: number;
}

// ─── Helper: build unified items array (handles old single-product orders) ────
function buildOrderItems(
  order: {
    productId: number | null;
    productName: string | null;
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

  // Backward-compat: old single-product order
  if (order.productId && order.quantity) {
    const unitPrice = order.salesPrice ?? 0;
    return [{
      productId: order.productId,
      productName: order.productName ?? "—",
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
        productId: ordersTable.productId,
        quantity: ordersTable.quantity,
        totalPoints: ordersTable.totalPoints,
        bonusPoints: ordersTable.bonusPoints,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
        productName: productsTable.name,
        salesPrice: productsTable.salesPrice,
        retailerName: usersTable.name,
        retailerPhone: usersTable.phone,
      })
      .from(ordersTable)
      .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
      .leftJoin(usersTable, eq(ordersTable.retailerId, usersTable.id))
      .where(
        (caller.role === "admin" || caller.role === "super_admin")
          ? undefined
          : eq(ordersTable.salesmanId, caller.userId)
      );

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
    const { retailerId, items, productId, quantity } = req.body;

    // Support both new format (items array) and old format (productId + quantity)
    let orderItems: Array<{ productId: number; quantity: number }> = [];
    if (Array.isArray(items) && items.length > 0) {
      orderItems = items;
    } else if (productId && quantity) {
      orderItems = [{ productId: Number(productId), quantity: Number(quantity) }];
    } else {
      res.status(400).json({ error: "Provide items array or productId+quantity" });
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

    // Validate all products and compute totals
    let orderTotalPoints = 0;
    let orderBonusPoints = 0;
    const resolvedItems: Array<{
      productId: number;
      productName: string;
      quantity: number;
      unitPrice: number;
      totalPoints: number;
      bonusPoints: number;
      totalValue: number;
    }> = [];

    for (const item of orderItems) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        res.status(400).json({ error: "Each item needs productId and quantity ≥ 1" });
        return;
      }
      const product = await db.select().from(productsTable).where(eq(productsTable.id, Number(item.productId)));
      if (!product.length) {
        res.status(400).json({ error: `Product ${item.productId} not found` });
        return;
      }
      const p = product[0];
      const itemTotalPoints = Number(item.quantity) * p.points;
      const itemBonusPoints = Math.round(itemTotalPoints * 0.1);
      orderTotalPoints += itemTotalPoints;
      orderBonusPoints += itemBonusPoints;
      resolvedItems.push({
        productId: p.id,
        productName: p.name,
        quantity: Number(item.quantity),
        unitPrice: p.salesPrice,
        totalPoints: itemTotalPoints,
        bonusPoints: itemBonusPoints,
        totalValue: Number(item.quantity) * p.salesPrice,
      });
    }

    // Insert order (no productId for multi-item orders)
    const isMultiItem = resolvedItems.length > 1;
    const inserted = await db.insert(ordersTable).values({
      salesmanId: caller.userId,
      retailerId: Number(retailerId),
      productId: isMultiItem ? null : resolvedItems[0].productId,
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
        productId: item.productId,
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
router.put("/:id/status", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const id = parseInt(req.params.id);
    const { status } = req.body;

    const isAdmin = caller.role === "admin" || caller.role === "super_admin";
    const isRetailer = caller.role === "retailer";
    const isSalesman = caller.role === "salesman";

    if (!isAdmin && !isRetailer && !isSalesman) {
      res.status(403).json({ error: "Not authorised to update order status" });
      return;
    }

    if (!["pending", "confirmed", "dispatched", "cancelled"].includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    // Only admins can dispatch
    if (status === "dispatched" && !isAdmin) {
      res.status(403).json({ error: "Only admins can dispatch orders" });
      return;
    }

    // Validate dispatch transition: must be pending or confirmed → dispatched
    if (status === "dispatched" && isAdmin) {
      const order = await db.select({ status: ordersTable.status })
        .from(ordersTable).where(eq(ordersTable.id, id));
      if (!order.length) { res.status(404).json({ error: "Order not found" }); return; }
      if (order[0].status !== "confirmed" && order[0].status !== "pending") {
        res.status(400).json({ error: "Only pending or confirmed orders can be dispatched" });
        return;
      }
    }

    if (isRetailer) {
      // Retailers may only confirm orders that belong to them
      if (status !== "confirmed") {
        res.status(403).json({ error: "Retailers may only confirm orders" });
        return;
      }
      const order = await db.select({ retailerId: ordersTable.retailerId })
        .from(ordersTable).where(eq(ordersTable.id, id));
      if (!order.length) { res.status(404).json({ error: "Order not found" }); return; }
      if (order[0].retailerId !== caller.userId) {
        res.status(403).json({ error: "Not your order" });
        return;
      }
    }

    if (isSalesman) {
      // Salesmen may only cancel their own pending orders
      if (status !== "cancelled") {
        res.status(403).json({ error: "Salesmen may only cancel orders" });
        return;
      }
      const order = await db.select({ salesmanId: ordersTable.salesmanId, status: ordersTable.status })
        .from(ordersTable).where(eq(ordersTable.id, id));
      if (!order.length) { res.status(404).json({ error: "Order not found" }); return; }
      if (order[0].salesmanId !== caller.userId) {
        res.status(403).json({ error: "Not your order" });
        return;
      }
      if (order[0].status !== "pending") {
        res.status(400).json({ error: "Only pending orders can be cancelled" });
        return;
      }
    }

    const updated = await db.update(ordersTable).set({ status }).where(eq(ordersTable.id, id)).returning();
    if (!updated.length) { res.status(404).json({ error: "Order not found" }); return; }
    res.json({ ...updated[0], createdAt: updated[0].createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PUT /orders/:id/items — admin: confirmed orders, salesman: own pending ───
router.put("/:id/items", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const isAdmin = caller.role === "admin" || caller.role === "super_admin";
    const isSalesman = caller.role === "salesman";

    if (!isAdmin && !isSalesman) {
      res.status(403).json({ error: "Not authorised to edit order items" });
      return;
    }

    const id = parseInt(req.params.id);
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items array is required" });
      return;
    }

    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order.length) { res.status(404).json({ error: "Order not found" }); return; }

    if (isAdmin) {
      if (order[0].status !== "confirmed") {
        res.status(400).json({ error: "Admins can only edit confirmed orders" });
        return;
      }
    }

    if (isSalesman) {
      if (order[0].salesmanId !== caller.userId) {
        res.status(403).json({ error: "Not your order" });
        return;
      }
      if (order[0].status !== "pending") {
        res.status(400).json({ error: "Salesmen can only edit pending orders" });
        return;
      }
    }

    // Validate items and compute new totals
    let orderTotalPoints = 0;
    let orderBonusPoints = 0;
    const resolvedItems: Array<{
      productId: number;
      quantity: number;
      unitPrice: number;
      totalPoints: number;
      bonusPoints: number;
    }> = [];

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        res.status(400).json({ error: "Each item needs productId and quantity ≥ 1" });
        return;
      }
      const product = await db.select().from(productsTable).where(eq(productsTable.id, Number(item.productId)));
      if (!product.length) {
        res.status(400).json({ error: `Product ${item.productId} not found` });
        return;
      }
      const p = product[0];
      const itemTotalPoints = Number(item.quantity) * p.points;
      const itemBonusPoints = Math.round(itemTotalPoints * 0.1);
      orderTotalPoints += itemTotalPoints;
      orderBonusPoints += itemBonusPoints;
      resolvedItems.push({
        productId: p.id,
        quantity: Number(item.quantity),
        unitPrice: p.salesPrice,
        totalPoints: itemTotalPoints,
        bonusPoints: itemBonusPoints,
      });
    }

    // Replace order items
    await db.delete(orderItemsTable).where(eq(orderItemsTable.orderId, id));
    await db.insert(orderItemsTable).values(
      resolvedItems.map(item => ({ orderId: id, ...item }))
    );

    // Update order totals (keep single-item legacy fields null for multi-item)
    const isMultiItem = resolvedItems.length > 1;
    await db.update(ordersTable).set({
      totalPoints: orderTotalPoints,
      bonusPoints: orderBonusPoints,
      productId: isMultiItem ? null : resolvedItems[0].productId,
      quantity: isMultiItem ? null : resolvedItems[0].quantity,
    }).where(eq(ordersTable.id, id));

    res.json({ success: true, totalPoints: orderTotalPoints, bonusPoints: orderBonusPoints });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /orders/retailers ────────────────────────────────────────────────────
router.get("/retailers", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const search = (req.query.search as string || "").toLowerCase();

    // If salesman has a region, fetch only their region's retailers
    let salesmanRegionId: number | null = null;
    if (caller.role === "salesman") {
      const sm = await db.select({ regionId: usersTable.regionId })
        .from(usersTable).where(eq(usersTable.id, caller.userId));
      salesmanRegionId = sm[0]?.regionId ?? null;
    }

    const whereClause = salesmanRegionId !== null
      ? and(eq(usersTable.role, "retailer"), eq(usersTable.regionId, salesmanRegionId))
      : eq(usersTable.role, "retailer");

    const rows = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      phone: usersTable.phone,
      city: usersTable.city,
      regionId: usersTable.regionId,
    }).from(usersTable).where(whereClause);

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
        productId: ordersTable.productId,
        quantity: ordersTable.quantity,
        totalPoints: ordersTable.totalPoints,
        bonusPoints: ordersTable.bonusPoints,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
        productName: productsTable.name,
        salesPrice: productsTable.salesPrice,
        salesmanId: ordersTable.salesmanId,
        retailerId: ordersTable.retailerId,
      })
      .from(ordersTable)
      .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
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
        productId: ordersTable.productId,
        quantity: ordersTable.quantity,
        bonusPoints: ordersTable.bonusPoints,
        totalPoints: ordersTable.totalPoints,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
        productName: productsTable.name,
        salesPrice: productsTable.salesPrice,
        retailerName: usersTable.name,
        retailerPhone: usersTable.phone,
      })
      .from(ordersTable)
      .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
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

    // Current-month window: from the 1st of this month (midnight) to now
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonthDispatched = ordersWithItems.filter(r => {
      if (r.status !== "dispatched") return false;
      const d = new Date(r.createdAt);
      return d >= monthStart && d <= now;
    });

    const totalBonus = ordersWithItems.reduce((s, r) => s + (r.status !== "cancelled" ? r.bonusPoints : 0), 0);
    const confirmedBonus = ordersWithItems.reduce((s, r) => s + (r.status === "confirmed" ? r.bonusPoints : 0), 0);
    const totalSalesValue = thisMonthDispatched.reduce((s, r) => s + r.totalValue, 0);
    const confirmedSalesValue = ordersWithItems.reduce((s, r) => s + (r.status === "confirmed" ? r.totalValue : 0), 0);
    const totalOrders = thisMonthDispatched.length;

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

// ─── GET /orders/salesman-commissions — admin only ────────────────────────────
router.get("/salesman-commissions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Fetch ALL salesmen regardless of whether they have orders
    const allSalesmen = await db
      .select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.role, "salesman"));

    const rows = await db
      .select({
        id: ordersTable.id,
        salesmanId: ordersTable.salesmanId,
        productId: ordersTable.productId,
        quantity: ordersTable.quantity,
        bonusPoints: ordersTable.bonusPoints,
        totalPoints: ordersTable.totalPoints,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
        salesPrice: productsTable.salesPrice,
        salesmanName: usersTable.name,
        salesmanPhone: usersTable.phone,
      })
      .from(ordersTable)
      .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
      .leftJoin(usersTable, eq(ordersTable.salesmanId, usersTable.id))
      .where(ne(ordersTable.status, "cancelled"));

    const itemsMap = await getItemsForOrders(rows.map((r) => r.id));

    type SmEntry = {
      salesmanId: number;
      name: string | null;
      phone: string;
      orders: Array<{ id: number; status: string; bonusPoints: number; totalValue: number; createdAt: Date }>;
    };

    // Seed map with all salesmen (ensures those with no orders are included)
    const byId: Record<number, SmEntry> = {};
    for (const sm of allSalesmen) {
      byId[sm.id] = { salesmanId: sm.id, name: sm.name, phone: sm.phone!, orders: [] };
    }

    for (const r of rows) {
      if (!byId[r.salesmanId]) {
        byId[r.salesmanId] = { salesmanId: r.salesmanId, name: r.salesmanName, phone: r.salesmanPhone!, orders: [] };
      }
      const items = buildOrderItems(r, itemsMap, r.id);
      const totalValue = items.reduce((s, i) => s + i.totalValue, 0);
      byId[r.salesmanId].orders.push({ id: r.id, status: r.status, bonusPoints: r.bonusPoints, totalValue, createdAt: r.createdAt });
    }

    const result = Object.values(byId).map((sm) => {
      const active    = sm.orders;
      const confirmed = sm.orders.filter((o) => o.status === "confirmed");
      const curMonth  = sm.orders.filter((o) => o.createdAt >= monthStart && o.createdAt < monthEnd);
      return {
        salesmanId: sm.salesmanId,
        name: sm.name,
        phone: sm.phone,
        totalOrders: active.length,
        confirmedOrders: confirmed.length,
        totalSalesValue: active.reduce((s, o) => s + o.totalValue, 0),
        confirmedSalesValue: confirmed.reduce((s, o) => s + o.totalValue, 0),
        totalBonus: active.reduce((s, o) => s + o.bonusPoints, 0),
        confirmedBonus: confirmed.reduce((s, o) => s + o.bonusPoints, 0),
        currentMonthOrders: curMonth.length,
        currentMonthSalesValue: curMonth.reduce((s, o) => s + o.totalValue, 0),
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
