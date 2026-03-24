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
