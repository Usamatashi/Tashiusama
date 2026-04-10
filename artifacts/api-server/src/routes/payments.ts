import { Router } from "express";
import { db, usersTable, ordersTable, orderItemsTable, paymentsTable, commissionsTable } from "@workspace/db";
import { eq, and, inArray, sql, gte, lt, sum } from "drizzle-orm";
import { requireAuth, requireSalesman, requireAdmin } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";

const router = Router();

// ─── Helper: compute totalValue for a set of orders ──────────────────────────
async function computeOrderValues(orderRows: {
  id: number; vehicleId: number | null; quantity: number | null; salesPrice: number | null;
}[]): Promise<Record<number, number>> {
  if (!orderRows.length) return {};
  const ids = orderRows.map(o => o.id);
  const items = await db
    .select({
      orderId: orderItemsTable.orderId,
      qty: orderItemsTable.quantity,
      price: orderItemsTable.unitPrice,
      discountPercent: orderItemsTable.discountPercent,
    })
    .from(orderItemsTable)
    .where(inArray(orderItemsTable.orderId, ids));

  const itemMap: Record<number, number> = {};
  for (const r of items) {
    const discountPercent = r.discountPercent ?? 0;
    const discountedValue = Math.round(r.qty * r.price * (1 - discountPercent / 100));
    itemMap[r.orderId] = (itemMap[r.orderId] ?? 0) + discountedValue;
  }
  for (const o of orderRows) {
    if (!itemMap[o.id] && o.quantity && o.salesPrice) {
      itemMap[o.id] = o.quantity * o.salesPrice;
    }
  }
  return itemMap;
}

// ─── Helper: get balance for a list of retailer IDs ──────────────────────────
async function getBalances(retailerIds: number[]) {
  if (!retailerIds.length) return {} as Record<number, { totalOrdered: number; totalPaid: number; outstanding: number }>;

  // Outstanding balance accrues when an order is dispatched (goods delivered)
  const orders = await db
    .select({
      id: ordersTable.id,
      retailerId: ordersTable.retailerId,
      productId: ordersTable.productId,
      quantity: ordersTable.quantity,
      billDiscountPercent: ordersTable.billDiscountPercent,
    })
    .from(ordersTable)
    .where(and(eq(ordersTable.status, "dispatched"), inArray(ordersTable.retailerId, retailerIds)));

  const valueMap = await computeOrderValues(orders.map(o => ({
    id: o.id,
    vehicleId: o.productId,
    quantity: o.quantity,
    salesPrice: null,
  })));

  const debtByRetailer: Record<number, number> = {};
  for (const o of orders) {
    const itemsTotal = valueMap[o.id] ?? 0;
    const billDiscountPercent = o.billDiscountPercent ?? 0;
    const finalValue = Math.round(itemsTotal * (1 - billDiscountPercent / 100));
    debtByRetailer[o.retailerId] = (debtByRetailer[o.retailerId] ?? 0) + finalValue;
  }

  const payments = await db
    .select({ retailerId: paymentsTable.retailerId, amount: paymentsTable.amount })
    .from(paymentsTable)
    .where(inArray(paymentsTable.retailerId, retailerIds));

  const paidByRetailer: Record<number, number> = {};
  for (const p of payments) {
    paidByRetailer[p.retailerId] = (paidByRetailer[p.retailerId] ?? 0) + p.amount;
  }

  const result: Record<number, { totalOrdered: number; totalPaid: number; outstanding: number }> = {};
  for (const id of retailerIds) {
    const totalOrdered = debtByRetailer[id] ?? 0;
    const totalPaid = paidByRetailer[id] ?? 0;
    result[id] = { totalOrdered, totalPaid, outstanding: totalOrdered - totalPaid };
  }
  return result;
}

// ─── GET /payments/salesman-summary ──────────────────────────────────────────
// Returns 3 figures for the salesman accounts summary bar:
//   totalOutstanding  – sum of outstanding balances for retailers this salesman has orders with
//   todayCollections  – sum of payments collected by this salesman today
//   totalCommission   – total commission amount recorded for this salesman
router.get("/salesman-summary", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;

    // ── 1. Total outstanding for retailers this salesman has orders with ───
    const orderRows = await db
      .select({ retailerId: ordersTable.retailerId })
      .from(ordersTable)
      .where(eq(ordersTable.salesmanId, caller.userId));

    const retailerIds = [...new Set(orderRows.map(r => r.retailerId))];

    let totalOutstanding = 0;
    if (retailerIds.length) {
      const balances = await getBalances(retailerIds);
      totalOutstanding = Object.values(balances).reduce((s, b) => s + Math.max(0, b.outstanding), 0);
    }

    // ── 2. Today's collections by this salesman ────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const todayRows = await db
      .select({ amount: paymentsTable.amount })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.receivedBy, caller.userId),
          gte(paymentsTable.createdAt, todayStart),
          lt(paymentsTable.createdAt, tomorrowStart),
        ),
      );
    const todayCollections = todayRows.reduce((s, r) => s + r.amount, 0);

    // ── 3. Total commission for this salesman ──────────────────────────────
    const commissionRows = await db
      .select({ commissionAmount: commissionsTable.commissionAmount })
      .from(commissionsTable)
      .where(eq(commissionsTable.salesmanId, caller.userId));
    const totalCommission = commissionRows.reduce((s, r) => s + r.commissionAmount, 0);

    res.json({ totalOutstanding, todayCollections, totalCommission });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /payments/retailer-balances ─────────────────────────────────────────
router.get("/retailer-balances", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;

    let retailerIds: number[];
    if (caller.role === "admin" || caller.role === "super_admin") {
      const rows = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "retailer"));
      retailerIds = rows.map(r => r.id);
    } else {
      const rows = await db
        .select({ retailerId: ordersTable.retailerId })
        .from(ordersTable)
        .where(eq(ordersTable.salesmanId, caller.userId));
      retailerIds = [...new Set(rows.map(r => r.retailerId))];
    }

    if (!retailerIds.length) { res.json([]); return; }

    const retailers = await db
      .select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone, city: usersTable.city })
      .from(usersTable)
      .where(inArray(usersTable.id, retailerIds));

    const balances = await getBalances(retailerIds);

    res.json(retailers.map(r => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      city: r.city,
      ...balances[r.id] ?? { totalOrdered: 0, totalPaid: 0, outstanding: 0 },
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /payments/pending-count ──────────────────────────────────────────────
// Admin only: count of payments awaiting verification
router.get("/pending-count", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "pending"));
    res.json({ count: Number(rows[0]?.count ?? 0) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /payments/my-balance ─────────────────────────────────────────────────
router.get("/my-balance", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    if (caller.role !== "retailer") { res.status(403).json({ error: "Retailer access only" }); return; }

    const balances = await getBalances([caller.userId]);
    const balance = balances[caller.userId] ?? { totalOrdered: 0, totalPaid: 0, outstanding: 0 };

    const payments = await db
      .select({
        id: paymentsTable.id,
        amount: paymentsTable.amount,
        notes: paymentsTable.notes,
        status: paymentsTable.status,
        verifiedAt: paymentsTable.verifiedAt,
        createdAt: paymentsTable.createdAt,
        collectorName: usersTable.name,
        collectorPhone: usersTable.phone,
      })
      .from(paymentsTable)
      .leftJoin(usersTable, eq(paymentsTable.receivedBy, usersTable.id))
      .where(eq(paymentsTable.retailerId, caller.userId));

    res.json({
      ...balance,
      payments: payments.map(p => ({
        id: p.id,
        amount: p.amount,
        notes: p.notes,
        status: p.status,
        verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
        collectorName: p.collectorName,
        collectorPhone: p.collectorPhone,
      })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /payments ─────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;

    const rows = await db
      .select({
        id: paymentsTable.id,
        amount: paymentsTable.amount,
        notes: paymentsTable.notes,
        status: paymentsTable.status,
        verifiedBy: paymentsTable.verifiedBy,
        verifiedAt: paymentsTable.verifiedAt,
        createdAt: paymentsTable.createdAt,
        retailerId: paymentsTable.retailerId,
        receivedBy: paymentsTable.receivedBy,
      })
      .from(paymentsTable);

    const filtered = rows.filter(p => {
      if (caller.role === "admin" || caller.role === "super_admin") return true;
      if (caller.role === "salesman") return p.receivedBy === caller.userId;
      if (caller.role === "retailer") return p.retailerId === caller.userId;
      return false;
    });

    if (!filtered.length) { res.json([]); return; }

    const allUserIds = [...new Set([
      ...filtered.map(p => p.retailerId),
      ...filtered.map(p => p.receivedBy),
      ...filtered.filter(p => p.verifiedBy).map(p => p.verifiedBy!),
    ])];
    const users = await db.select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone })
      .from(usersTable).where(inArray(usersTable.id, allUserIds));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    res.json(filtered.map(p => ({
      id: p.id,
      amount: p.amount,
      notes: p.notes,
      status: p.status,
      verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
      verifiedByName: p.verifiedBy ? (userMap[p.verifiedBy]?.name ?? null) : null,
      createdAt: p.createdAt.toISOString(),
      retailerId: p.retailerId,
      retailerName: userMap[p.retailerId]?.name ?? null,
      retailerPhone: userMap[p.retailerId]?.phone ?? null,
      receivedBy: p.receivedBy,
      collectorName: userMap[p.receivedBy]?.name ?? null,
      collectorPhone: userMap[p.receivedBy]?.phone ?? null,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /payments ────────────────────────────────────────────────────────────
router.post("/", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const { retailerId, amount, notes } = req.body;

    if (!retailerId || !amount || Number(amount) <= 0) {
      res.status(400).json({ error: "retailerId and a positive amount are required" });
      return;
    }

    const retailer = await db.select().from(usersTable).where(eq(usersTable.id, Number(retailerId)));
    if (!retailer.length || retailer[0].role !== "retailer") {
      res.status(400).json({ error: "Retailer not found" });
      return;
    }

    const inserted = await db.insert(paymentsTable).values({
      retailerId: Number(retailerId),
      receivedBy: caller.userId,
      amount: Math.round(Number(amount)),
      notes: notes ?? null,
      status: "pending",
    }).returning();

    const p = inserted[0];
    res.status(201).json({
      id: p.id,
      retailerId: p.retailerId,
      retailerName: retailer[0].name,
      retailerPhone: retailer[0].phone,
      receivedBy: p.receivedBy,
      amount: p.amount,
      notes: p.notes,
      status: p.status,
      verifiedAt: null,
      verifiedByName: null,
      createdAt: p.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PATCH /payments/:id/verify ───────────────────────────────────────────────
// Admin only: verify (approve) a pending payment
router.patch("/:id/verify", requireAuth, requireAdmin, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const paymentId = Number(req.params.id);

    const existing = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
    if (!existing.length) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }
    if (existing[0].status === "verified") {
      res.status(400).json({ error: "Payment already verified" });
      return;
    }

    const updated = await db
      .update(paymentsTable)
      .set({ status: "verified", verifiedBy: caller.userId, verifiedAt: new Date() })
      .where(eq(paymentsTable.id, paymentId))
      .returning();

    const p = updated[0];

    const allIds = [p.retailerId, p.receivedBy, caller.userId];
    const users = await db.select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone })
      .from(usersTable).where(inArray(usersTable.id, allIds));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    res.json({
      id: p.id,
      amount: p.amount,
      notes: p.notes,
      status: p.status,
      verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
      verifiedByName: userMap[caller.userId]?.name ?? null,
      createdAt: p.createdAt.toISOString(),
      retailerId: p.retailerId,
      retailerName: userMap[p.retailerId]?.name ?? null,
      retailerPhone: userMap[p.retailerId]?.phone ?? null,
      receivedBy: p.receivedBy,
      collectorName: userMap[p.receivedBy]?.name ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
