import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function createAdmin() {
  const phone = "03055198651";
  const password = "khan0112";

  const existing = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (existing.length > 0) {
    console.log("User already exists, updating to admin role and resetting password...");
    await db.update(usersTable)
      .set({ role: "admin", passwordHash: await bcrypt.hash(password, 10) })
      .where(eq(usersTable.phone, phone));
    console.log("Updated phone:", phone);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(usersTable).values({
    phone,
    passwordHash,
    role: "admin",
    points: 0,
  });
  console.log("Admin user created:");
  console.log("  Phone:", phone);
  console.log("  Password:", password);
  process.exit(0);
}

createAdmin().catch(console.error);
