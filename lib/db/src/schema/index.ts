import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("role", ["admin", "salesman", "mechanic", "retailer"]);
export const qrStatusEnum = pgEnum("qr_status", ["unused", "used"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("retailer"),
  name: text("name"),
  email: text("email"),
  city: text("city"),
  points: integer("points").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vehiclesTable = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  points: integer("points").notNull().default(0),
  salesPrice: integer("sales_price").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const qrCodesTable = pgTable("qr_codes", {
  id: serial("id").primaryKey(),
  qrNumber: text("qr_number").notNull().unique(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id),
  points: integer("points").notNull().default(0),
  status: qrStatusEnum("status").notNull().default("unused"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scansTable = pgTable("scans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  qrId: integer("qr_id").notNull().references(() => qrCodesTable.id),
  pointsEarned: integer("points_earned").notNull().default(0),
  scannedAt: timestamp("scanned_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({ id: true, createdAt: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehiclesTable.$inferSelect;

export const insertQRCodeSchema = createInsertSchema(qrCodesTable).omit({ id: true, createdAt: true });
export type InsertQRCode = z.infer<typeof insertQRCodeSchema>;
export type QRCode = typeof qrCodesTable.$inferSelect;

export const insertScanSchema = createInsertSchema(scansTable).omit({ id: true, scannedAt: true });
export type InsertScan = z.infer<typeof insertScanSchema>;
export type Scan = typeof scansTable.$inferSelect;

export const claimStatusEnum = pgEnum("claim_status", ["pending", "received"]);

export const claimsTable = pgTable("claims", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  pointsClaimed: integer("points_claimed").notNull(),
  status: claimStatusEnum("status").notNull().default("pending"),
  claimedAt: timestamp("claimed_at").notNull().defaultNow(),
});

export const insertClaimSchema = createInsertSchema(claimsTable).omit({ id: true, claimedAt: true });
export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type Claim = typeof claimsTable.$inferSelect;

export const adsTable = pgTable("ads", {
  id: serial("id").primaryKey(),
  imageBase64: text("image_base64").notNull(),
  title: text("title"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAdSchema = createInsertSchema(adsTable).omit({ id: true, createdAt: true });
export type InsertAd = z.infer<typeof insertAdSchema>;
export type Ad = typeof adsTable.$inferSelect;

export const tickerTable = pgTable("ticker", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTickerSchema = createInsertSchema(tickerTable).omit({ id: true, createdAt: true });
export type InsertTicker = z.infer<typeof insertTickerSchema>;
export type Ticker = typeof tickerTable.$inferSelect;

export const orderStatusEnum = pgEnum("order_status", ["pending", "confirmed", "cancelled"]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  salesmanId: integer("salesman_id").notNull().references(() => usersTable.id),
  retailerId: integer("retailer_id").notNull().references(() => usersTable.id),
  vehicleId: integer("vehicle_id").references(() => vehiclesTable.id),
  quantity: integer("quantity"),
  totalPoints: integer("total_points").notNull().default(0),
  bonusPoints: integer("bonus_points").notNull().default(0),
  status: orderStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull().default(0),
  totalPoints: integer("total_points").notNull().default(0),
  bonusPoints: integer("bonus_points").notNull().default(0),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;

export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true });
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItemsTable.$inferSelect;

// ─── Payments ─────────────────────────────────────────────────────────────────
export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  retailerId: integer("retailer_id").notNull().references(() => usersTable.id),
  receivedBy: integer("received_by").notNull().references(() => usersTable.id),
  amount: integer("amount").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
