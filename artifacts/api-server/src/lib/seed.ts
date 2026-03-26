import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export async function seedAdminUser() {
  try {
    const email = "kumetewala@gmail.com";
    const password = "khan0112";

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));

    if (existing.length > 0) {
      if (existing[0].role !== "admin") {
        await db.update(usersTable)
          .set({ role: "admin", passwordHash: await bcrypt.hash(password, 10) })
          .where(eq(usersTable.email, email));
        logger.info({ email }, "Admin user updated to admin role");
      } else {
        logger.info({ email }, "Admin user already exists");
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.insert(usersTable).values({
      email,
      passwordHash,
      role: "admin",
      points: 0,
    });
    logger.info({ email }, "Admin user created");
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}
