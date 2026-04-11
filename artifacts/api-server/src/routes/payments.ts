import { Router } from "express";
import { fdb, nextId, toISOString, chunkArray } from "../lib/firebase";
import { requireAuth, requireSalesman, requireAdmin } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";
import { sendPushToUsers, sendPushToRole } from "../lib/push";

const router = Router();

async function computeOrderValues(orderIds: number[]): Promise<Record<number, number>> {
  if (!orderIds.length) return {};
  const itemMap: Record<number, number> = {};
  const batches = chunkArray(orderIds, 30);
  for (const batch of batches) {
    const itemsSnap = await fdb.collection("orderItems").where("orderId", "in", batch).get();
    itemsSnap.forEach((doc) => {
      const item = doc.data();
      const discountPercent = item.discountPercent ?? 0;
      const discountedValue = Math.round(item.quantity * item.unitPrice * (1 - discountPercent / 100));
      itemMap[item.orderId] = (itemMap[item.orderId] ?? 0) + discountedValue;
    });
  }
  return itemMap;
}

async function getBalances(retailerIds: number[]): Promise<Record<number, { totalOrdered: number; totalPaid: number; outstanding: number }>> {
  if (!retailerIds.length) return {};

  const batches = chunkArray(retailerIds, 30);
  const orders: any[] = [];
  const payments: any[] = [];

  for (const batch of batches) {
    const ordersSnap = await fdb.collection("orders")
      .where("status", "==", "dispatched")
      .where("retailerId", "in", batch)
      .get();
    ordersSnap.forEach((doc) => orders.push(doc.data()));

    const paymentsSnap = await fdb.collection("payments").where("retailerId", "in", batch).get();
    paymentsSnap.forEach((doc) => payments.push(doc.data()));
  }

  const orderIds = orders.map((o) => o.id as number);
  const valueMap = await computeOrderValues(orderIds);

  const debtByRetailer: Record<number, number> = {};
  for (const o of orders) {
    const itemsTotal = valueMap[o.id] ?? 0;
    const billDiscountPercent = o.billDiscountPercent ?? 0;
    const finalValue = Math.round(itemsTotal * (1 - billDiscountPercent / 100));
    debtByRetailer[o.retailerId] = (debtByRetailer[o.retailerId] ?? 0) + finalValue;
  }

  const paidByRetailer: Record<number, number> = {};
  for (const p of payments) {
    paidByRetailer[p.retailerId] = (paidByRetailer[p.retailerId] ?? 0) + (p.amount as number);
  }

  const result: Record<number, { totalOrdered: number; totalPaid: number; outstanding: number }> = {};
  for (const id of retailerIds) {
    const totalOrdered = debtByRetailer[id] ?? 0;
    const totalPaid = paidByRetailer[id] ?? 0;
    result[id] = { totalOrdered, totalPaid, outstanding: totalOrdered - totalPaid };
  }
  return result;
}

router.get("/salesman-summary", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;

    const ordersSnap = await fdb.collection("orders").where("salesmanId", "==", caller.userId).get();
    const retailerIds = [...new Set(ordersSnap.docs.map((d) => d.data().retailerId as number))];

    let totalOutstanding = 0;
    if (retailerIds.length) {
      const balances = await getBalances(retailerIds);
      totalOutstanding = Object.values(balances).reduce((s, b) => s + Math.max(0, b.outstanding), 0);
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);

    const todaySnap = await fdb.collection("payments")
      .where("receivedBy", "==", caller.userId)
      .where("createdAt", ">=", todayStart)
      .where("createdAt", "<", tomorrowStart)
      .get();
    const todayCollections = todaySnap.docs.reduce((s, d) => s + (d.data().amount as number), 0);

    const commissionsSnap = await fdb.collection("commissions").where("salesmanId", "==", caller.userId).get();
    const totalCommission = commissionsSnap.docs.reduce((s, d) => s + (d.data().commissionAmount as number), 0);

    res.json({ totalOutstanding, todayCollections, totalCommission });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/retailer-balances", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    let retailerIds: number[];

    if (caller.role === "admin" || caller.role === "super_admin") {
      const snap = await fdb.collection("users").where("role", "==", "retailer").get();
      retailerIds = snap.docs.map((d) => d.data().id as number);
    } else {
      const snap = await fdb.collection("orders").where("salesmanId", "==", caller.userId).get();
      retailerIds = [...new Set(snap.docs.map((d) => d.data().retailerId as number))];
    }

    if (!retailerIds.length) {
      res.json([]);
      return;
    }

    const [balances, retailerDocs] = await Promise.all([
      getBalances(retailerIds),
      fdb.getAll(...retailerIds.map((id) => fdb.collection("users").doc(String(id)))),
    ]);

    res.json(
      retailerDocs
        .filter((d) => d.exists)
        .map((d) => {
          const u = d.data()!;
          return {
            id: u.id,
            name: u.name ?? null,
            phone: u.phone,
            city: u.city ?? null,
            ...(balances[u.id as number] ?? { totalOrdered: 0, totalPaid: 0, outstanding: 0 }),
          };
        }),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/pending-count", requireAuth, requireAdmin, async (req, res) => {
  try {
    const snap = await fdb.collection("payments").where("status", "==", "pending").get();
    res.json({ count: snap.size });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/my-balance", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    if (caller.role !== "retailer") {
      res.status(403).json({ error: "Retailer access only" });
      return;
    }
    const [balances, paymentsSnap] = await Promise.all([
      getBalances([caller.userId]),
      fdb.collection("payments").where("retailerId", "==", caller.userId).orderBy("createdAt", "desc").get(),
    ]);

    const balance = balances[caller.userId] ?? { totalOrdered: 0, totalPaid: 0, outstanding: 0 };
    const collectorIds = [...new Set(paymentsSnap.docs.map((d) => d.data().receivedBy as number))];
    const collectorDocs = collectorIds.length
      ? await fdb.getAll(...collectorIds.map((id) => fdb.collection("users").doc(String(id))))
      : [];
    const collectorMap = new Map<number, any>();
    collectorDocs.forEach((d) => { if (d.exists) collectorMap.set(parseInt(d.id), d.data()); });

    res.json({
      ...balance,
      payments: paymentsSnap.docs.map((d) => {
        const p = d.data();
        const collector = collectorMap.get(p.receivedBy as number);
        return {
          id: p.id, amount: p.amount, notes: p.notes ?? null, status: p.status,
          verifiedAt: p.verifiedAt ? toISOString(p.verifiedAt) : null,
          createdAt: toISOString(p.createdAt),
          collectorName: collector?.name ?? null, collectorPhone: collector?.phone ?? null,
        };
      }),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const snap = await fdb.collection("payments").orderBy("createdAt", "desc").get();
    const all = snap.docs.map((d) => d.data());
    const filtered = all.filter((p) => {
      if (caller.role === "admin" || caller.role === "super_admin") return true;
      if (caller.role === "salesman") return p.receivedBy === caller.userId;
      if (caller.role === "retailer") return p.retailerId === caller.userId;
      return false;
    });
    if (!filtered.length) {
      res.json([]);
      return;
    }
    const allUserIds = [...new Set([
      ...filtered.map((p) => p.retailerId as number),
      ...filtered.map((p) => p.receivedBy as number),
      ...filtered.filter((p) => p.verifiedBy).map((p) => p.verifiedBy as number),
    ])];
    const userDocs = await fdb.getAll(...allUserIds.map((id) => fdb.collection("users").doc(String(id))));
    const userMap = new Map<number, any>();
    userDocs.forEach((d) => { if (d.exists) userMap.set(parseInt(d.id), d.data()); });

    res.json(
      filtered.map((p) => ({
        id: p.id, amount: p.amount, notes: p.notes ?? null, status: p.status,
        verifiedAt: p.verifiedAt ? toISOString(p.verifiedAt) : null,
        verifiedByName: p.verifiedBy ? (userMap.get(p.verifiedBy as number)?.name ?? null) : null,
        createdAt: toISOString(p.createdAt),
        retailerId: p.retailerId, retailerName: userMap.get(p.retailerId as number)?.name ?? null,
        retailerPhone: userMap.get(p.retailerId as number)?.phone ?? null,
        receivedBy: p.receivedBy, collectorName: userMap.get(p.receivedBy as number)?.name ?? null,
        collectorPhone: userMap.get(p.receivedBy as number)?.phone ?? null,
      })),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const { retailerId, amount, notes } = req.body;
    if (!retailerId || !amount || Number(amount) <= 0) {
      res.status(400).json({ error: "retailerId and a positive amount are required" });
      return;
    }
    const retailerDoc = await fdb.collection("users").doc(String(retailerId)).get();
    if (!retailerDoc.exists || retailerDoc.data()!.role !== "retailer") {
      res.status(400).json({ error: "Retailer not found" });
      return;
    }
    const retailer = retailerDoc.data()!;
    const id = await nextId("payments");
    const payment = {
      id, retailerId: Number(retailerId), receivedBy: caller.userId,
      amount: Math.round(Number(amount)), notes: notes ?? null,
      status: "pending", verifiedBy: null, verifiedAt: null, createdAt: new Date(),
    };
    await fdb.collection("payments").doc(String(id)).set(payment);

    const formattedAmount = `Rs. ${payment.amount.toLocaleString()}`;
    sendPushToUsers([payment.retailerId], "Payment Recorded",
      `A payment of ${formattedAmount} has been recorded for your account.`,
      { paymentId: id, type: "payment_recorded" });
    sendPushToRole("admin", "New Payment to Verify",
      `${retailer.name ?? "A retailer"} made a payment of ${formattedAmount}. Tap to verify.`,
      { paymentId: id, type: "payment_pending" });
    sendPushToRole("super_admin", "New Payment to Verify",
      `${retailer.name ?? "A retailer"} made a payment of ${formattedAmount}. Tap to verify.`,
      { paymentId: id, type: "payment_pending" });

    res.status(201).json({
      id: payment.id, retailerId: payment.retailerId, retailerName: retailer.name ?? null,
      retailerPhone: retailer.phone ?? null, receivedBy: payment.receivedBy,
      amount: payment.amount, notes: payment.notes, status: payment.status,
      verifiedAt: null, verifiedByName: null, createdAt: toISOString(payment.createdAt),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id/verify", requireAuth, requireAdmin, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const paymentId = Number(req.params.id);
    const paymentRef = fdb.collection("payments").doc(String(paymentId));
    const paymentDoc = await paymentRef.get();
    if (!paymentDoc.exists) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }
    const existing = paymentDoc.data()!;
    if (existing.status === "verified") {
      res.status(400).json({ error: "Payment already verified" });
      return;
    }
    const verifiedAt = new Date();
    await paymentRef.update({ status: "verified", verifiedBy: caller.userId, verifiedAt });
    const p = { ...existing, status: "verified", verifiedBy: caller.userId, verifiedAt };

    const allIds = [...new Set([p.retailerId as number, p.receivedBy as number, caller.userId])];
    const userDocs = await fdb.getAll(...allIds.map((id) => fdb.collection("users").doc(String(id))));
    const userMap = new Map<number, any>();
    userDocs.forEach((d) => { if (d.exists) userMap.set(parseInt(d.id), d.data()); });

    sendPushToUsers([p.retailerId as number], "Payment Verified",
      `Your payment of Rs. ${(p.amount as number).toLocaleString()} has been verified and credited to your account.`,
      { paymentId, type: "payment_verified" });

    res.json({
      id: p.id, amount: p.amount, notes: p.notes ?? null, status: p.status,
      verifiedAt: toISOString(p.verifiedAt), verifiedByName: userMap.get(caller.userId)?.name ?? null,
      createdAt: toISOString(p.createdAt), retailerId: p.retailerId,
      retailerName: userMap.get(p.retailerId as number)?.name ?? null,
      retailerPhone: userMap.get(p.retailerId as number)?.phone ?? null,
      receivedBy: p.receivedBy, collectorName: userMap.get(p.receivedBy as number)?.name ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
