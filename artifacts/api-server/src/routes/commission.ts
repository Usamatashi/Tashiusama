import { Router } from "express";
import { db, usersTable, ordersTable, orderItemsTable, commissionsTable } from "@workspace/db";
import { eq, and, gt, sql, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";

const router = Router();

// ─── GET /commission/salesman-sales/:salesmanId ───────────────────────────────
// Returns sales data since the last commission for this salesman (admin only)
router.get("/salesman-sales/:salesmanId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const salesmanId = parseInt(req.params.salesmanId, 10);
    if (isNaN(salesmanId)) {
      res.status(400).json({ error: "Invalid salesman ID" });
      return;
    }

    // Verify salesman exists
    const [salesman] = await db
      .select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.id, salesmanId))
      .limit(1);

    if (!salesman) {
      res.status(404).json({ error: "Salesman not found" });
      return;
    }

    // Find last commission date for this salesman
    const [lastCommission] = await db
      .select({ periodTo: commissionsTable.periodTo, createdAt: commissionsTable.createdAt })
      .from(commissionsTable)
      .where(eq(commissionsTable.salesmanId, salesmanId))
      .orderBy(desc(commissionsTable.createdAt))
      .limit(1);

    const periodFrom = lastCommission ? lastCommission.periodTo : null;
    const periodTo = new Date();

    // Build query for confirmed orders in this period
    const conditions = [
      eq(ordersTable.salesmanId, salesmanId),
      eq(ordersTable.status, "confirmed"),
    ];
    if (periodFrom) {
      conditions.push(gt(ordersTable.createdAt, periodFrom));
    }

    const orders = await db
      .select({
        id: ordersTable.id,
        createdAt: ordersTable.createdAt,
        retailerId: ordersTable.retailerId,
        retailerName: usersTable.name,
        retailerPhone: usersTable.phone,
      })
      .from(ordersTable)
      .leftJoin(usersTable, eq(ordersTable.retailerId, usersTable.id))
      .where(and(...conditions));

    if (orders.length === 0) {
      res.json({
        salesmanId,
        salesmanName: salesman.name,
        salesmanPhone: salesman.phone,
        lastCommissionAt: lastCommission?.createdAt ?? null,
        periodFrom,
        periodTo,
        salesAmount: 0,
        orderCount: 0,
        orders: [],
      });
      return;
    }

    // Fetch order items to calculate actual Rs value
    const orderIds = orders.map((o) => o.id);
    const items = await db
      .select({
        orderId: orderItemsTable.orderId,
        quantity: orderItemsTable.quantity,
        unitPrice: orderItemsTable.unitPrice,
      })
      .from(orderItemsTable)
      .where(
        orderIds.length === 1
          ? eq(orderItemsTable.orderId, orderIds[0])
          : sql`${orderItemsTable.orderId} = ANY(ARRAY[${sql.join(orderIds.map(id => sql`${id}`), sql`, `)}])`
      );

    // Build per-order totals
    const orderValueMap: Record<number, number> = {};
    for (const item of items) {
      orderValueMap[item.orderId] = (orderValueMap[item.orderId] ?? 0) + item.quantity * item.unitPrice;
    }

    let salesAmount = 0;
    const orderList = orders.map((o) => {
      const value = orderValueMap[o.id] ?? 0;
      salesAmount += value;
      return {
        id: o.id,
        createdAt: o.createdAt,
        retailerName: o.retailerName,
        retailerPhone: o.retailerPhone,
        totalValue: value,
      };
    });

    res.json({
      salesmanId,
      salesmanName: salesman.name,
      salesmanPhone: salesman.phone,
      lastCommissionAt: lastCommission?.createdAt ?? null,
      periodFrom,
      periodTo,
      salesAmount,
      orderCount: orders.length,
      orders: orderList,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /commission ──────────────────────────────────────────────────────────
// Admin approves commission for a salesman
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const admin = (req as any).user as JwtPayload;
    const { salesmanId, percentage, salesAmount, periodFrom, periodTo } = req.body;

    if (!salesmanId || percentage === undefined || salesAmount === undefined) {
      res.status(400).json({ error: "salesmanId, percentage, and salesAmount are required" });
      return;
    }

    const pct = Number(percentage);
    const sales = Number(salesAmount);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      res.status(400).json({ error: "percentage must be between 1 and 100" });
      return;
    }

    const commissionAmount = Math.round((sales * pct) / 100);

    const [record] = await db
      .insert(commissionsTable)
      .values({
        salesmanId: Number(salesmanId),
        adminId: admin.userId,
        periodFrom: periodFrom ? new Date(periodFrom) : null,
        periodTo: periodTo ? new Date(periodTo) : new Date(),
        salesAmount: Math.round(sales),
        percentage: Math.round(pct),
        commissionAmount,
      })
      .returning();

    res.json(record);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /commission/my-commissions ───────────────────────────────────────────
// Salesman's own commission history
router.get("/my-commissions", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    if (caller.role !== "salesman" && caller.role !== "admin" && caller.role !== "super_admin") {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const salesmanId = caller.role === "salesman" ? caller.userId : Number((req.query as any).salesmanId);
    if (!salesmanId) {
      res.status(400).json({ error: "salesmanId required" });
      return;
    }

    const records = await db
      .select({
        id: commissionsTable.id,
        salesmanId: commissionsTable.salesmanId,
        adminId: commissionsTable.adminId,
        adminName: usersTable.name,
        adminPhone: usersTable.phone,
        periodFrom: commissionsTable.periodFrom,
        periodTo: commissionsTable.periodTo,
        salesAmount: commissionsTable.salesAmount,
        percentage: commissionsTable.percentage,
        commissionAmount: commissionsTable.commissionAmount,
        createdAt: commissionsTable.createdAt,
      })
      .from(commissionsTable)
      .leftJoin(usersTable, eq(commissionsTable.adminId, usersTable.id))
      .where(eq(commissionsTable.salesmanId, salesmanId))
      .orderBy(desc(commissionsTable.createdAt));

    res.json(records);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
