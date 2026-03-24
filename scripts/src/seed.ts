import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function seed() {
  const adminEmail = "admin@tashi.com";
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail));
  if (existing.length > 0) {
    console.log("Admin user already exists:", adminEmail);
    process.exit(0);
  }
  const passwordHash = await bcrypt.hash("admin123", 10);
  await db.insert(usersTable).values({
    email: adminEmail,
    passwordHash,
    role: "admin",
    points: 0,
  });
  console.log("Admin user created:");
  console.log("  Email:", adminEmail);
  console.log("  Password: admin123");
  process.exit(0);
}

seed().catch(console.error);
