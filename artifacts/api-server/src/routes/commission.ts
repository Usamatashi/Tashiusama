import { Router } from "express";
import { db, usersTable, ordersTable, orderItemsTable, commissionsTable } from "@workspace/db";
import { eq, and, gte, lt, ne, desc, inArray } from "drizzle-orm";
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
      .select({
        id: commissionsTable.id,
        createdAt: commissionsTable.createdAt,
        salesAmount: commissionsTable.salesAmount,
        commissionAmount: commissionsTable.commissionAmount,
        percentage: commissionsTable.percentage,
      })
      .from(commissionsTable)
      .where(
        and(
          eq(commissionsTable.salesmanId, salesmanId),
          gte(commissionsTable.periodFrom as any, periodFrom),
          lt(commissionsTable.periodFrom as any, periodTo),
        )
      )
      .limit(1);

    // Fetch all non-cancelled orders in this calendar month (always, approved or not)
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

    // Compute order values (commission base = sum of unit sales prices, not quantity × price)
    let salesAmount = 0;
    let orderList: Array<{ id: number; createdAt: Date; retailerName: string | null; retailerPhone: string | null; totalValue: number }> = [];

    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id);
      const items = await db
        .select({ orderId: orderItemsTable.orderId, quantity: orderItemsTable.quantity, unitPrice: orderItemsTable.unitPrice })
        .from(orderItemsTable)
        .where(inArray(orderItemsTable.orderId, orderIds));

      const orderValueMap: Record<number, number> = {};
      for (const item of items) {
        orderValueMap[item.orderId] = (orderValueMap[item.orderId] ?? 0) + item.unitPrice;
      }

      for (const o of orders) {
        const value = orderValueMap[o.id] ?? 0;
        salesAmount += value;
        orderList.push({ id: o.id, createdAt: o.createdAt, retailerName: o.retailerName, retailerPhone: o.retailerPhone, totalValue: value });
      }
    }

    if (existing) {
      res.json({
        salesmanId,
        salesmanName: salesman.name,
        salesmanPhone: salesman.phone,
        periodFrom: periodFrom.toISOString(),
        periodTo: periodToInclusive.toISOString(),
        salesAmount: existing.salesAmount ?? salesAmount,
        orderCount: orders.length,
        orders: orderList,
        alreadyApproved: true,
        approvedAt: existing.createdAt,
        commissionAmount: existing.commissionAmount,
        commissionPercentage: existing.percentage,
      });
      return;
    }

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

    // Guard: commission can only be approved for months that have fully passed
    const now2 = new Date();
    const nowMonthStart = new Date(now2.getFullYear(), now2.getMonth(), 1);
    if (monthStart >= nowMonthStart) {
      res.status(400).json({ error: "Commission can only be approved after the month has ended" });
      return;
    }

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

// ─── GET /commission/monthly-totals ──────────────────────────────────────────
// Returns month-by-month totals across ALL salesmen with per-salesman % contribution
router.get("/monthly-totals", requireAuth, requireAdmin, async (req, res) => {
  try {
    // All non-cancelled orders
    const orders = await db
      .select({ id: ordersTable.id, salesmanId: ordersTable.salesmanId, createdAt: ordersTable.createdAt })
      .from(ordersTable)
      .where(ne(ordersTable.status, "cancelled"));

    if (orders.length === 0) { res.json({ months: [] }); return; }

    // All salesmen for name lookup
    const salesmen = await db
      .select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.role, "salesman"));
    const smMap: Record<number, { name: string | null; phone: string }> = {};
    for (const sm of salesmen) smMap[sm.id] = { name: sm.name, phone: sm.phone! };

    // Items for all orders
    const orderIds = orders.map((o) => o.id);
    const items = await db
      .select({ orderId: orderItemsTable.orderId, quantity: orderItemsTable.quantity, unitPrice: orderItemsTable.unitPrice })
      .from(orderItemsTable)
      .where(inArray(orderItemsTable.orderId, orderIds));

    const valueMap: Record<number, number> = {};
    for (const item of items) {
      valueMap[item.orderId] = (valueMap[item.orderId] ?? 0) + item.unitPrice;
    }

    type MonthKey = string;
    type SmSales = { salesmanId: number; name: string | null; phone: string; salesAmount: number; orderCount: number };
    const monthData: Record<MonthKey, { year: number; month: number; totalSales: number; orderCount: number; salesmen: Record<number, SmSales> }> = {};

    for (const order of orders) {
      const d = new Date(order.createdAt);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key: MonthKey = `${year}-${String(month).padStart(2, "0")}`;
      const value = valueMap[order.id] ?? 0;

      if (!monthData[key]) monthData[key] = { year, month, totalSales: 0, orderCount: 0, salesmen: {} };
      monthData[key].totalSales += value;
      monthData[key].orderCount += 1;

      const smInfo = smMap[order.salesmanId] ?? { name: null, phone: String(order.salesmanId) };
      if (!monthData[key].salesmen[order.salesmanId]) {
        monthData[key].salesmen[order.salesmanId] = { salesmanId: order.salesmanId, name: smInfo.name, phone: smInfo.phone, salesAmount: 0, orderCount: 0 };
      }
      monthData[key].salesmen[order.salesmanId].salesAmount += value;
      monthData[key].salesmen[order.salesmanId].orderCount += 1;
    }

    const months = Object.values(monthData)
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
      .map((m) => ({
        year: m.year,
        month: m.month,
        label: new Date(m.year, m.month - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        totalSales: m.totalSales,
        orderCount: m.orderCount,
        salesmen: Object.values(m.salesmen)
          .sort((a, b) => b.salesAmount - a.salesAmount)
          .map((sm) => ({
            ...sm,
            pct: m.totalSales > 0 ? Math.round((sm.salesAmount / m.totalSales) * 100) : 0,
          })),
      }));

    res.json({ months });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /commission/salesman-months/:salesmanId ─────────────────────────────
// Returns a month-by-month breakdown of a salesman's sales and commission status
router.get("/salesman-months/:salesmanId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const salesmanId = parseInt(req.params.salesmanId, 10);
    if (isNaN(salesmanId)) { res.status(400).json({ error: "Invalid salesman ID" }); return; }

    const [salesman] = await db
      .select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.id, salesmanId))
      .limit(1);

    if (!salesman) { res.status(404).json({ error: "Salesman not found" }); return; }

    // All non-cancelled orders for this salesman
    const orders = await db
      .select({ id: ordersTable.id, createdAt: ordersTable.createdAt })
      .from(ordersTable)
      .where(and(eq(ordersTable.salesmanId, salesmanId), ne(ordersTable.status, "cancelled")));

    // All approved commissions for this salesman
    const commissions = await db
      .select({ periodFrom: commissionsTable.periodFrom, commissionAmount: commissionsTable.commissionAmount, createdAt: commissionsTable.createdAt })
      .from(commissionsTable)
      .where(eq(commissionsTable.salesmanId, salesmanId));

    // Compute order values via items
    type MonthKey = string; // "YYYY-MM"
    const monthData: Record<MonthKey, { year: number; month: number; orderCount: number; salesAmount: number; alreadyApproved: boolean; approvedAt?: string; commissionAmount?: number }> = {};

    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id);
      const items = await db
        .select({ orderId: orderItemsTable.orderId, quantity: orderItemsTable.quantity, unitPrice: orderItemsTable.unitPrice })
        .from(orderItemsTable)
        .where(inArray(orderItemsTable.orderId, orderIds));

      const orderValueMap: Record<number, number> = {};
      for (const item of items) {
        orderValueMap[item.orderId] = (orderValueMap[item.orderId] ?? 0) + item.unitPrice;
      }

      for (const order of orders) {
        const d = new Date(order.createdAt);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const key: MonthKey = `${year}-${String(month).padStart(2, "0")}`;
        if (!monthData[key]) monthData[key] = { year, month, orderCount: 0, salesAmount: 0, alreadyApproved: false };
        monthData[key].orderCount += 1;
        monthData[key].salesAmount += orderValueMap[order.id] ?? 0;
      }
    }

    // Overlay commission approval data
    for (const comm of commissions) {
      if (!comm.periodFrom) continue;
      const d = new Date(comm.periodFrom);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key: MonthKey = `${year}-${String(month).padStart(2, "0")}`;
      if (!monthData[key]) monthData[key] = { year, month, orderCount: 0, salesAmount: 0, alreadyApproved: false };
      monthData[key].alreadyApproved = true;
      monthData[key].approvedAt = new Date(comm.createdAt).toISOString();
      monthData[key].commissionAmount = comm.commissionAmount;
    }

    // Sort newest first; annotate whether the month has fully passed (can be approved)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const months = Object.values(monthData)
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
      .map((m) => ({
        ...m,
        canApprove: m.year < currentYear || (m.year === currentYear && m.month < currentMonth),
      }));

    res.json({ salesmanId, salesmanName: salesman.name, salesmanPhone: salesman.phone, months });
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
