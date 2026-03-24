import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function createAdmin() {
  const email = "kumetewala@gmail.com";
  const password = "khan0112";

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    console.log("User already exists, updating to admin role...");
    await db.update(usersTable)
      .set({ role: "admin", passwordHash: await bcrypt.hash(password, 10) })
      .where(eq(usersTable.email, email));
    console.log("Updated:", email);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(usersTable).values({
    email,
    passwordHash,
    role: "admin",
    points: 0,
  });
  console.log("Admin user created:");
  console.log("  Email:", email);
  console.log("  Password:", password);
  process.exit(0);
}

createAdmin().catch(console.error);
