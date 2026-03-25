import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("role", ["admin", "salesman", "mechanic", "retailer"]);
export const qrStatusEnum = pgEnum("qr_status", ["unused", "used"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("retailer"),
  points: integer("points").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vehiclesTable = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  points: integer("points").notNull().default(0),
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
