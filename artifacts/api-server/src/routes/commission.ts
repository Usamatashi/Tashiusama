import { Router } from "express";
import { db, usersTable, ordersTable, orderItemsTable, commissionsTable } from "@workspace/db";
import { eq, and, gte, lt, ne, sql, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";

const router = Router();

// ─── GET /commission/salesman-sales/:salesmanId ───────────────────────────────
// Returns sales for the requested calendar month (defaults to current month).
// If a commission was already approved for that month, returns alreadyApproved=true.
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

    // Resolve target month (optional ?month=4&year=2026, defaults to current)
    const now = new Date();
    const targetYear  = parseInt((req.query as any).year  as string, 10) || now.getFullYear();
    const targetMonth = parseInt((req.query as any).month as string, 10) || (now.getMonth() + 1);

    const periodFrom = new Date(targetYear, targetMonth - 1, 1);          // 1st of month 00:00
    const periodTo   = new Date(targetYear, targetMonth, 1);               // 1st of next month (exclusive)
    const periodToInclusive = new Date(periodTo.getTime() - 1);            // last ms of month

    // Check if commission already approved for this month
    const [existing] = await db
      .select({ id: commissionsTable.id, createdAt: commissionsTable.createdAt })
      .from(commissionsTable)
      .where(
        and(
          eq(commissionsTable.salesmanId, salesmanId),
          gte(commissionsTable.periodFrom as any, periodFrom),
          lt(commissionsTable.periodFrom as any, periodTo),
        )
      )
      .limit(1);

    if (existing) {
      res.json({
        salesmanId,
        salesmanName: salesman.name,
        salesmanPhone: salesman.phone,
        periodFrom: periodFrom.toISOString(),
        periodTo: periodToInclusive.toISOString(),
        salesAmount: 0,
        orderCount: 0,
        orders: [],
        alreadyApproved: true,
        approvedAt: existing.createdAt,
      });
      return;
    }

    // Fetch all non-cancelled orders in this calendar month
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
      .where(
        and(
          eq(ordersTable.salesmanId, salesmanId),
          ne(ordersTable.status, "cancelled"),
          gte(ordersTable.createdAt, periodFrom),
          lt(ordersTable.createdAt, periodTo),
        )
      );

    if (orders.length === 0) {
      res.json({
        salesmanId,
        salesmanName: salesman.name,
        salesmanPhone: salesman.phone,
        periodFrom: periodFrom.toISOString(),
        periodTo: periodToInclusive.toISOString(),
        salesAmount: 0,
        orderCount: 0,
        orders: [],
        alreadyApproved: false,
      });
      return;
    }

    // Fetch order items for value calculation
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
      periodFrom: periodFrom.toISOString(),
      periodTo: periodToInclusive.toISOString(),
      salesAmount,
      orderCount: orders.length,
      orders: orderList,
      alreadyApproved: false,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /commission ──────────────────────────────────────────────────────────
// Admin approves commission for a salesman (one per calendar month)
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const admin = (req as any).user as JwtPayload;
    const { salesmanId, percentage, salesAmount, periodFrom, periodTo } = req.body;

    if (!salesmanId || percentage === undefined || salesAmount === undefined || !periodFrom) {
      res.status(400).json({ error: "salesmanId, percentage, salesAmount, and periodFrom are required" });
      return;
    }

    const pct = Number(percentage);
    const sales = Number(salesAmount);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      res.status(400).json({ error: "percentage must be between 1 and 100" });
      return;
    }
    if (sales <= 0) {
      res.status(400).json({ error: "No sales available for this period" });
      return;
    }

    const monthStart = new Date(periodFrom);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

    // Guard: prevent duplicate commission for the same month
    const [duplicate] = await db
      .select({ id: commissionsTable.id })
      .from(commissionsTable)
      .where(
        and(
          eq(commissionsTable.salesmanId, Number(salesmanId)),
          gte(commissionsTable.periodFrom as any, monthStart),
          lt(commissionsTable.periodFrom as any, monthEnd),
        )
      )
      .limit(1);

    if (duplicate) {
      res.status(409).json({ error: "Commission for this month has already been approved" });
      return;
    }

    const commissionAmount = Math.round((sales * pct) / 100);

    const [record] = await db
      .insert(commissionsTable)
      .values({
        salesmanId: Number(salesmanId),
        adminId: admin.userId,
        periodFrom: monthStart,
        periodTo: periodTo ? new Date(periodTo) : new Date(monthEnd.getTime() - 1),
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
