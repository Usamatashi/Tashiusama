import { Router } from "express";
import { fdb, nextId, toISOString, chunkArray } from "../lib/firebase";
import { requireAuth, requireSalesman, requireAdmin } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";
import { sendPushToUsers } from "../lib/push";

const router = Router();

interface OrderItemRow {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPoints: number;
  bonusPoints: number;
  totalValue: number;
  discountPercent: number;
  discountedValue: number;
}

async function getItemsForOrders(orderIds: number[]): Promise<Record<number, OrderItemRow[]>> {
  if (!orderIds.length) return {};
  const map: Record<number, OrderItemRow[]> = {};
  const batches = chunkArray(orderIds, 30);
  for (const batch of batches) {
    const snap = await fdb.collection("orderItems").where("orderId", "in", batch).get();
    snap.forEach((doc) => {
      const item = doc.data();
      if (!map[item.orderId]) map[item.orderId] = [];
      const totalValue = item.quantity * item.unitPrice;
      const discountPercent = item.discountPercent ?? 0;
      const discountedValue = Math.round(totalValue * (1 - discountPercent / 100));
      map[item.orderId].push({
        productId: item.productId,
        productName: item.productName ?? "—",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPoints: item.totalPoints,
        bonusPoints: item.bonusPoints,
        totalValue,
        discountPercent,
        discountedValue,
      });
    });
  }
  return map;
}

function computeOrderTotals(items: OrderItemRow[], billDiscountPercent: number) {
  const originalTotal = items.reduce((s, i) => s + i.totalValue, 0);
  const subtotal = items.reduce((s, i) => s + i.discountedValue, 0);
  const billDiscountAmount = Math.round(subtotal * (billDiscountPercent / 100));
  const finalAmount = subtotal - billDiscountAmount;
  return { originalTotal, subtotal, billDiscountAmount, finalAmount };
}

function buildOrderItems(
  order: { productId?: number | null; productName?: string | null; quantity?: number | null; salesPrice?: number | null; totalPoints: number; bonusPoints: number },
  itemsMap: Record<number, OrderItemRow[]>,
  orderId: number,
): OrderItemRow[] {
  const items = itemsMap[orderId];
  if (items && items.length > 0) return items;
  if (order.productId && order.quantity) {
    const unitPrice = order.salesPrice ?? 0;
    const totalValue = order.quantity * unitPrice;
    return [{
      productId: order.productId,
      productName: order.productName ?? "—",
      quantity: order.quantity,
      unitPrice,
      totalPoints: order.totalPoints,
      bonusPoints: order.bonusPoints,
      totalValue,
      discountPercent: 0,
      discountedValue: totalValue,
    }];
  }
  return [];
}

async function getUsersMap(userIds: number[]): Promise<Map<number, any>> {
  const map = new Map<number, any>();
  if (!userIds.length) return map;
  const unique = [...new Set(userIds)];
  const refs = unique.map((id) => fdb.collection("users").doc(String(id)));
  const docs = await fdb.getAll(...refs);
  docs.forEach((doc) => {
    if (doc.exists) map.set(parseInt(doc.id), doc.data());
  });
  return map;
}

router.get("/", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const isAdmin = caller.role === "admin" || caller.role === "super_admin";

    let ordersSnap;
    if (isAdmin) {
      ordersSnap = await fdb.collection("orders").orderBy("createdAt", "desc").get();
    } else {
      ordersSnap = await fdb.collection("orders").where("salesmanId", "==", caller.userId).orderBy("createdAt", "desc").get();
    }

    const orders = ordersSnap.docs.map((d) => d.data());
    if (!orders.length) {
      res.json([]);
      return;
    }

    const orderIds = orders.map((o) => o.id as number);
    const retailerIds = [...new Set(orders.map((o) => o.retailerId as number))];

    const [itemsMap, usersMap] = await Promise.all([
      getItemsForOrders(orderIds),
      getUsersMap(retailerIds),
    ]);

    res.json(
      orders.map((r) => {
        const retailer = usersMap.get(r.retailerId as number);
        const items = buildOrderItems(r as any, itemsMap, r.id as number);
        const billDiscountPercent = (r.billDiscountPercent as number) ?? 0;
        const { originalTotal, subtotal, billDiscountAmount, finalAmount } = computeOrderTotals(items, billDiscountPercent);
        return {
          id: r.id,
          salesmanId: r.salesmanId,
          retailerId: r.retailerId,
          status: r.status,
          createdAt: toISOString(r.createdAt),
          retailerName: retailer?.name ?? null,
          retailerPhone: retailer?.phone ?? null,
          totalPoints: r.totalPoints,
          bonusPoints: r.bonusPoints,
          billDiscountPercent,
          totalValue: originalTotal,
          subtotal,
          billDiscountAmount,
          finalAmount,
          items,
        };
      }),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const { retailerId, items, productId, quantity, billDiscountPercent: rawBillDiscount } = req.body;
    const billDiscountPercent = Math.min(100, Math.max(0, Number(rawBillDiscount ?? 0)));

    let orderItems: Array<{ productId: number; quantity: number; discountPercent?: number }> = [];
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

    const retailerDoc = await fdb.collection("users").doc(String(retailerId)).get();
    if (!retailerDoc.exists || retailerDoc.data()!.role !== "retailer") {
      res.status(400).json({ error: "Retailer not found" });
      return;
    }
    const retailer = retailerDoc.data()!;

    let orderTotalPoints = 0;
    let orderBonusPoints = 0;
    const resolvedItems: Array<{
      productId: number; productName: string; quantity: number; unitPrice: number;
      totalPoints: number; bonusPoints: number; totalValue: number; discountPercent: number; discountedValue: number;
    }> = [];

    for (const item of orderItems) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        res.status(400).json({ error: "Each item needs productId and quantity ≥ 1" });
        return;
      }
      const productDoc = await fdb.collection("products").doc(String(item.productId)).get();
      if (!productDoc.exists) {
        res.status(400).json({ error: `Product ${item.productId} not found` });
        return;
      }
      const p = productDoc.data()!;
      const discountPercent = Math.min(100, Math.max(0, Number(item.discountPercent ?? 0)));
      const itemTotalPoints = Number(item.quantity) * p.points;
      const itemBonusPoints = Math.round(itemTotalPoints * 0.1);
      orderTotalPoints += itemTotalPoints;
      orderBonusPoints += itemBonusPoints;
      const totalValue = Number(item.quantity) * p.salesPrice;
      const discountedValue = Math.round(totalValue * (1 - discountPercent / 100));
      resolvedItems.push({
        productId: p.id, productName: p.name, quantity: Number(item.quantity),
        unitPrice: p.salesPrice, totalPoints: itemTotalPoints, bonusPoints: itemBonusPoints,
        totalValue, discountPercent, discountedValue,
      });
    }

    const orderId = await nextId("orders");
    const isMultiItem = resolvedItems.length > 1;
    const order = {
      id: orderId,
      salesmanId: caller.userId,
      retailerId: Number(retailerId),
      productId: isMultiItem ? null : resolvedItems[0].productId,
      quantity: isMultiItem ? null : resolvedItems[0].quantity,
      totalPoints: orderTotalPoints,
      bonusPoints: orderBonusPoints,
      billDiscountPercent,
      status: "pending",
      createdAt: new Date(),
    };

    const batch = fdb.batch();
    batch.set(fdb.collection("orders").doc(String(orderId)), order);
    for (const item of resolvedItems) {
      const itemRef = fdb.collection("orderItems").doc();
      batch.set(itemRef, {
        orderId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPoints: item.totalPoints,
        bonusPoints: item.bonusPoints,
        discountPercent: item.discountPercent,
      });
    }
    await batch.commit();

    const { originalTotal, subtotal, billDiscountAmount, finalAmount } = computeOrderTotals(resolvedItems, billDiscountPercent);
    res.status(201).json({
      id: order.id, salesmanId: order.salesmanId, retailerId: order.retailerId,
      status: order.status, totalPoints: order.totalPoints, bonusPoints: order.bonusPoints,
      billDiscountPercent, totalValue: originalTotal, subtotal, billDiscountAmount, finalAmount,
      createdAt: toISOString(order.createdAt),
      retailerName: retailer.name ?? null, retailerPhone: retailer.phone ?? null,
      items: resolvedItems,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
    if (status === "dispatched" && !isAdmin) {
      res.status(403).json({ error: "Only admins can dispatch orders" });
      return;
    }

    const orderRef = fdb.collection("orders").doc(String(id));
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const order = orderDoc.data()!;

    if (status === "dispatched" && isAdmin) {
      if (order.status !== "confirmed" && order.status !== "pending") {
        res.status(400).json({ error: "Only pending or confirmed orders can be dispatched" });
        return;
      }
    }
    if (isRetailer) {
      if (status !== "confirmed") {
        res.status(403).json({ error: "Retailers may only confirm orders" });
        return;
      }
      if (order.retailerId !== caller.userId) {
        res.status(403).json({ error: "Not your order" });
        return;
      }
    }
    if (isSalesman) {
      if (status !== "cancelled") {
        res.status(403).json({ error: "Salesmen may only cancel orders" });
        return;
      }
      if (order.salesmanId !== caller.userId) {
        res.status(403).json({ error: "Not your order" });
        return;
      }
      if (order.status !== "pending") {
        res.status(400).json({ error: "Only pending orders can be cancelled" });
        return;
      }
    }

    await orderRef.update({ status });

    if (status === "dispatched") {
      const retailerDoc = await fdb.collection("users").doc(String(order.retailerId)).get();
      const label = retailerDoc.data()?.name ? `for ${retailerDoc.data()?.name}` : "";
      sendPushToUsers(
        [order.retailerId as number, order.salesmanId as number],
        "Order Dispatched",
        `Your order ${label} has been dispatched and is on its way.`.trim(),
        { orderId: id, type: "dispatch" },
      );
    }

    res.json({ ...order, status, createdAt: toISOString(order.createdAt) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
    const orderRef = fdb.collection("orders").doc(String(id));
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const order = orderDoc.data()!;
    if (isAdmin && order.status !== "confirmed") {
      res.status(400).json({ error: "Admins can only edit confirmed orders" });
      return;
    }
    if (isSalesman) {
      if (order.salesmanId !== caller.userId) {
        res.status(403).json({ error: "Not your order" });
        return;
      }
      if (order.status !== "pending") {
        res.status(400).json({ error: "Salesmen can only edit pending orders" });
        return;
      }
    }

    let orderTotalPoints = 0;
    let orderBonusPoints = 0;
    const resolvedItems: Array<{ productId: number; productName: string; quantity: number; unitPrice: number; totalPoints: number; bonusPoints: number; discountPercent: number }> = [];

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        res.status(400).json({ error: "Each item needs productId and quantity ≥ 1" });
        return;
      }
      const productDoc = await fdb.collection("products").doc(String(item.productId)).get();
      if (!productDoc.exists) {
        res.status(400).json({ error: `Product ${item.productId} not found` });
        return;
      }
      const p = productDoc.data()!;
      const discountPercent = Math.min(100, Math.max(0, Number(item.discountPercent ?? 0)));
      const itemTotalPoints = Number(item.quantity) * p.points;
      const itemBonusPoints = Math.round(itemTotalPoints * 0.1);
      orderTotalPoints += itemTotalPoints;
      orderBonusPoints += itemBonusPoints;
      resolvedItems.push({
        productId: p.id, productName: p.name, quantity: Number(item.quantity),
        unitPrice: p.salesPrice, totalPoints: itemTotalPoints, bonusPoints: itemBonusPoints,
        discountPercent,
      });
    }

    const existingItemsSnap = await fdb.collection("orderItems").where("orderId", "==", id).get();
    const batch = fdb.batch();
    existingItemsSnap.forEach((doc) => batch.delete(doc.ref));
    for (const item of resolvedItems) {
      const itemRef = fdb.collection("orderItems").doc();
      batch.set(itemRef, { orderId: id, ...item });
    }
    const isMultiItem = resolvedItems.length > 1;
    batch.update(orderRef, {
      totalPoints: orderTotalPoints,
      bonusPoints: orderBonusPoints,
      productId: isMultiItem ? null : resolvedItems[0].productId,
      quantity: isMultiItem ? null : resolvedItems[0].quantity,
    });
    await batch.commit();

    res.json({ success: true, totalPoints: orderTotalPoints, bonusPoints: orderBonusPoints });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/retailers", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const search = (req.query.search as string || "").toLowerCase();

    let regionId: number | null = null;
    if (caller.role === "salesman") {
      const smDoc = await fdb.collection("users").doc(String(caller.userId)).get();
      regionId = smDoc.data()?.regionId ?? null;
    }

    let snap;
    if (regionId !== null) {
      snap = await fdb.collection("users").where("role", "==", "retailer").where("regionId", "==", regionId).get();
    } else {
      snap = await fdb.collection("users").where("role", "==", "retailer").get();
    }

    let rows = snap.docs.map((d) => {
      const u = d.data();
      return { id: u.id, name: u.name ?? null, phone: u.phone, city: u.city ?? null, regionId: u.regionId ?? null };
    });

    if (search) {
      rows = rows.filter(
        (r) => (r.name?.toLowerCase().includes(search)) || r.phone.toLowerCase().includes(search),
      );
    }
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/my-retail-orders", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    if (caller.role !== "retailer" && caller.role !== "admin") {
      res.status(403).json({ error: "Retailer access required" });
      return;
    }
    const snap = await fdb.collection("orders").where("retailerId", "==", caller.userId).orderBy("createdAt", "desc").get();
    const orders = snap.docs.map((d) => d.data());
    const orderIds = orders.map((o) => o.id as number);
    const itemsMap = await getItemsForOrders(orderIds);

    res.json(
      orders.map((r) => {
        const items = buildOrderItems(r as any, itemsMap, r.id as number);
        const billDiscountPercent = (r.billDiscountPercent as number) ?? 0;
        const { originalTotal, subtotal, billDiscountAmount, finalAmount } = computeOrderTotals(items, billDiscountPercent);
        return {
          id: r.id, status: r.status, createdAt: toISOString(r.createdAt),
          totalPoints: r.totalPoints, billDiscountPercent,
          totalValue: originalTotal, subtotal, billDiscountAmount, finalAmount, items,
        };
      }),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/my-bonus", requireAuth, requireSalesman, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const snap = await fdb.collection("orders").where("salesmanId", "==", caller.userId).orderBy("createdAt", "desc").get();
    const orders = snap.docs.map((d) => d.data());
    const orderIds = orders.map((o) => o.id as number);
    const retailerIds = [...new Set(orders.map((o) => o.retailerId as number))];

    const [itemsMap, usersMap] = await Promise.all([
      getItemsForOrders(orderIds),
      getUsersMap(retailerIds),
    ]);

    res.json(
      orders.map((r) => {
        const retailer = usersMap.get(r.retailerId as number);
        const items = buildOrderItems(r as any, itemsMap, r.id as number);
        const billDiscountPercent = (r.billDiscountPercent as number) ?? 0;
        const { originalTotal, subtotal, billDiscountAmount, finalAmount } = computeOrderTotals(items, billDiscountPercent);
        return {
          id: r.id, status: r.status, createdAt: toISOString(r.createdAt),
          totalPoints: r.totalPoints, bonusPoints: r.bonusPoints, billDiscountPercent,
          retailerName: retailer?.name ?? null, retailerPhone: retailer?.phone ?? null,
          totalValue: originalTotal, subtotal, billDiscountAmount, finalAmount, items,
        };
      }),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
