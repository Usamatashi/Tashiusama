import { Router } from "express";
import { fdb, nextId, toISOString, chunkArray } from "../lib/firebase";
import { requireAuth, requireAdmin } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";

const router = Router();

async function computeFinalAmounts(orderIds: number[]): Promise<Record<number, number>> {
  if (!orderIds.length) return {};
  const subtotalMap: Record<number, number> = {};
  const billDiscountMap: Record<number, number> = {};

  const batches = chunkArray(orderIds, 30);
  for (const batch of batches) {
    const [itemsSnap, ordersSnap] = await Promise.all([
      fdb.collection("orderItems").where("orderId", "in", batch).get(),
      fdb.collection("orders").where("id", "in", batch).get(),
    ]);
    ordersSnap.forEach((doc) => {
      const o = doc.data();
      billDiscountMap[o.id as number] = o.billDiscountPercent ?? 0;
    });
    itemsSnap.forEach((doc) => {
      const item = doc.data();
      const discountedValue = Math.round(item.quantity * item.unitPrice * (1 - (item.discountPercent ?? 0) / 100));
      subtotalMap[item.orderId] = (subtotalMap[item.orderId] ?? 0) + discountedValue;
    });
  }

  const finalMap: Record<number, number> = {};
  for (const orderId of orderIds) {
    const subtotal = subtotalMap[orderId] ?? 0;
    const billDiscount = billDiscountMap[orderId] ?? 0;
    finalMap[orderId] = Math.round(subtotal * (1 - billDiscount / 100));
  }
  return finalMap;
}

router.get("/salesman-sales/:salesmanId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const salesmanId = parseInt(req.params.salesmanId, 10);
    if (isNaN(salesmanId)) {
      res.status(400).json({ error: "Invalid salesman ID" });
      return;
    }
    const salesmanDoc = await fdb.collection("users").doc(String(salesmanId)).get();
    if (!salesmanDoc.exists) {
      res.status(404).json({ error: "Salesman not found" });
      return;
    }
    const salesman = salesmanDoc.data()!;

    const now = new Date();
    const targetYear = parseInt((req.query as any).year as string, 10) || now.getFullYear();
    const targetMonth = parseInt((req.query as any).month as string, 10) || (now.getMonth() + 1);
    const periodFrom = new Date(targetYear, targetMonth - 1, 1);
    const periodTo = new Date(targetYear, targetMonth, 1);
    const periodToInclusive = new Date(periodTo.getTime() - 1);

    const [existingSnap, ordersSnap] = await Promise.all([
      fdb.collection("commissions")
        .where("salesmanId", "==", salesmanId)
        .where("periodFrom", ">=", periodFrom)
        .where("periodFrom", "<", periodTo)
        .limit(1)
        .get(),
      fdb.collection("orders")
        .where("salesmanId", "==", salesmanId)
        .where("createdAt", ">=", periodFrom)
        .where("createdAt", "<", periodTo)
        .get(),
    ]);

    const orders = ordersSnap.docs.map((d) => d.data()).filter((o) => o.status !== "cancelled");
    let salesAmount = 0;
    type OrderListItem = { id: number; createdAt: string; retailerName: string | null; retailerPhone: string | null; totalValue: number };
    let orderList: OrderListItem[] = [];

    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id as number);
      const retailerIds = [...new Set(orders.map((o) => o.retailerId as number))];
      const [finalMap, retailerDocs] = await Promise.all([
        computeFinalAmounts(orderIds),
        fdb.getAll(...retailerIds.map((id) => fdb.collection("users").doc(String(id)))),
      ]);
      const retailerMap = new Map<number, any>();
      retailerDocs.forEach((d) => { if (d.exists) retailerMap.set(parseInt(d.id), d.data()); });
      for (const o of orders) {
        const value = finalMap[o.id as number] ?? 0;
        salesAmount += value;
        const r = retailerMap.get(o.retailerId as number);
        orderList.push({ id: o.id as number, createdAt: toISOString(o.createdAt), retailerName: r?.name ?? null, retailerPhone: r?.phone ?? null, totalValue: value });
      }
    }

    const existingCommission = existingSnap.empty ? null : existingSnap.docs[0].data();
    if (existingCommission) {
      res.json({
        salesmanId, salesmanName: salesman.name, salesmanPhone: salesman.phone,
        periodFrom: periodFrom.toISOString(), periodTo: periodToInclusive.toISOString(),
        salesAmount: existingCommission.salesAmount ?? salesAmount, orderCount: orders.length, orders: orderList,
        alreadyApproved: true, approvedAt: toISOString(existingCommission.createdAt),
        commissionAmount: existingCommission.commissionAmount, commissionPercentage: existingCommission.percentage,
      });
      return;
    }
    if (orders.length === 0) {
      res.json({
        salesmanId, salesmanName: salesman.name, salesmanPhone: salesman.phone,
        periodFrom: periodFrom.toISOString(), periodTo: periodToInclusive.toISOString(),
        salesAmount: 0, orderCount: 0, orders: [], alreadyApproved: false,
      });
      return;
    }
    res.json({
      salesmanId, salesmanName: salesman.name, salesmanPhone: salesman.phone,
      periodFrom: periodFrom.toISOString(), periodTo: periodToInclusive.toISOString(),
      salesAmount, orderCount: orders.length, orders: orderList, alreadyApproved: false,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
    const now = new Date();
    const nowMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (monthStart >= nowMonthStart) {
      res.status(400).json({ error: "Commission can only be approved after the month has ended" });
      return;
    }
    const dupSnap = await fdb.collection("commissions")
      .where("salesmanId", "==", Number(salesmanId))
      .where("periodFrom", ">=", monthStart)
      .where("periodFrom", "<", monthEnd)
      .limit(1)
      .get();
    if (!dupSnap.empty) {
      res.status(409).json({ error: "Commission for this month has already been approved" });
      return;
    }
    const commissionAmount = Math.round((sales * pct) / 100);
    const id = await nextId("commissions");
    const record = {
      id, salesmanId: Number(salesmanId), adminId: admin.userId,
      periodFrom: monthStart,
      periodTo: periodTo ? new Date(periodTo) : new Date(monthEnd.getTime() - 1),
      salesAmount: Math.round(sales), percentage: Math.round(pct), commissionAmount, createdAt: new Date(),
    };
    await fdb.collection("commissions").doc(String(id)).set(record);
    res.json({ ...record, periodFrom: record.periodFrom.toISOString(), periodTo: record.periodTo.toISOString(), createdAt: toISOString(record.createdAt) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/monthly-totals", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [ordersSnap, salesmenSnap] = await Promise.all([
      fdb.collection("orders").get(),
      fdb.collection("users").where("role", "==", "salesman").get(),
    ]);
    const orders = ordersSnap.docs.map((d) => d.data()).filter((o) => o.status !== "cancelled");
    if (!orders.length) { res.json({ months: [] }); return; }

    const smMap: Record<number, { name: string | null; phone: string }> = {};
    salesmenSnap.forEach((d) => { const u = d.data(); smMap[u.id as number] = { name: u.name ?? null, phone: u.phone }; });

    const orderIds = orders.map((o) => o.id as number);
    const valueMap = await computeFinalAmounts(orderIds);

    type MonthKey = string;
    type SmSales = { salesmanId: number; name: string | null; phone: string; salesAmount: number; orderCount: number };
    const monthData: Record<MonthKey, { year: number; month: number; totalSales: number; orderCount: number; salesmen: Record<number, SmSales> }> = {};

    for (const order of orders) {
      const d = new Date(typeof order.createdAt?.toDate === "function" ? order.createdAt.toDate() : order.createdAt);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, "0")}`;
      const value = valueMap[order.id as number] ?? 0;
      if (!monthData[key]) monthData[key] = { year, month, totalSales: 0, orderCount: 0, salesmen: {} };
      monthData[key].totalSales += value;
      monthData[key].orderCount += 1;
      const smInfo = smMap[order.salesmanId as number] ?? { name: null, phone: String(order.salesmanId) };
      if (!monthData[key].salesmen[order.salesmanId as number]) {
        monthData[key].salesmen[order.salesmanId as number] = { salesmanId: order.salesmanId as number, name: smInfo.name, phone: smInfo.phone, salesAmount: 0, orderCount: 0 };
      }
      monthData[key].salesmen[order.salesmanId as number].salesAmount += value;
      monthData[key].salesmen[order.salesmanId as number].orderCount += 1;
    }

    const months = Object.values(monthData)
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
      .map((m) => ({
        year: m.year, month: m.month,
        label: new Date(m.year, m.month - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        totalSales: m.totalSales, orderCount: m.orderCount,
        salesmen: Object.values(m.salesmen).sort((a, b) => b.salesAmount - a.salesAmount)
          .map((sm) => ({ ...sm, pct: m.totalSales > 0 ? Math.round((sm.salesAmount / m.totalSales) * 100) : 0 })),
      }));

    res.json({ months });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/salesman-months/:salesmanId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const salesmanId = parseInt(req.params.salesmanId, 10);
    if (isNaN(salesmanId)) { res.status(400).json({ error: "Invalid salesman ID" }); return; }
    const salesmanDoc = await fdb.collection("users").doc(String(salesmanId)).get();
    if (!salesmanDoc.exists) { res.status(404).json({ error: "Salesman not found" }); return; }
    const salesman = salesmanDoc.data()!;

    const [ordersSnap, commissionsSnap] = await Promise.all([
      fdb.collection("orders").where("salesmanId", "==", salesmanId).get(),
      fdb.collection("commissions").where("salesmanId", "==", salesmanId).get(),
    ]);

    const orders = ordersSnap.docs.map((d) => d.data()).filter((o) => o.status !== "cancelled");
    type MonthKey = string;
    const monthData: Record<MonthKey, { year: number; month: number; orderCount: number; salesAmount: number; alreadyApproved: boolean; approvedAt?: string; commissionAmount?: number }> = {};

    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id as number);
      const orderValueMap = await computeFinalAmounts(orderIds);
      for (const order of orders) {
        const d = new Date(typeof order.createdAt?.toDate === "function" ? order.createdAt.toDate() : order.createdAt);
        const key: MonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!monthData[key]) monthData[key] = { year: d.getFullYear(), month: d.getMonth() + 1, orderCount: 0, salesAmount: 0, alreadyApproved: false };
        monthData[key].orderCount += 1;
        monthData[key].salesAmount += orderValueMap[order.id as number] ?? 0;
      }
    }

    commissionsSnap.forEach((doc) => {
      const comm = doc.data();
      if (!comm.periodFrom) return;
      const d = new Date(typeof comm.periodFrom?.toDate === "function" ? comm.periodFrom.toDate() : comm.periodFrom);
      const key: MonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthData[key]) monthData[key] = { year: d.getFullYear(), month: d.getMonth() + 1, orderCount: 0, salesAmount: 0, alreadyApproved: false };
      monthData[key].alreadyApproved = true;
      monthData[key].approvedAt = toISOString(comm.createdAt);
      monthData[key].commissionAmount = comm.commissionAmount as number;
    });

    const now = new Date();
    const months = Object.values(monthData)
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
      .map((m) => ({ ...m, canApprove: m.year < now.getFullYear() || (m.year === now.getFullYear() && m.month < now.getMonth() + 1) }));

    res.json({ salesmanId, salesmanName: salesman.name, salesmanPhone: salesman.phone, months });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/my-commissions", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    if (caller.role !== "salesman" && caller.role !== "admin" && caller.role !== "super_admin") {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const salesmanId = caller.role === "salesman" ? caller.userId : Number((req.query as any).salesmanId);
    if (!salesmanId) { res.status(400).json({ error: "salesmanId required" }); return; }

    const snap = await fdb.collection("commissions").where("salesmanId", "==", salesmanId).orderBy("createdAt", "desc").get();
    const adminIds = [...new Set(snap.docs.map((d) => d.data().adminId as number))];
    const adminDocs = adminIds.length ? await fdb.getAll(...adminIds.map((id) => fdb.collection("users").doc(String(id)))) : [];
    const adminMap = new Map<number, any>();
    adminDocs.forEach((d) => { if (d.exists) adminMap.set(parseInt(d.id), d.data()); });

    res.json(
      snap.docs.map((d) => {
        const c = d.data();
        const adm = adminMap.get(c.adminId as number);
        return {
          id: c.id, salesmanId: c.salesmanId, adminId: c.adminId,
          adminName: adm?.name ?? null, adminPhone: adm?.phone ?? null,
          periodFrom: toISOString(c.periodFrom), periodTo: toISOString(c.periodTo),
          salesAmount: c.salesAmount, percentage: c.percentage, commissionAmount: c.commissionAmount,
          createdAt: toISOString(c.createdAt),
        };
      }),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
