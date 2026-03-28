import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export async function seedAdminUser() {
  try {
    const phone = "03055198651";
    const password = "khan0112";

    const existing = await db.select().from(usersTable).where(eq(usersTable.phone, phone));

    if (existing.length > 0) {
      if (existing[0].role !== "super_admin") {
        await db.update(usersTable)
          .set({ role: "super_admin" })
          .where(eq(usersTable.phone, phone));
        logger.info({ phone }, "User upgraded to super_admin");
      } else {
        logger.info({ phone }, "Super admin user already exists");
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.insert(usersTable).values({
      phone,
      name: "Super Admin",
      passwordHash,
      role: "super_admin",
      points: 0,
    });
    logger.info({ phone }, "Super admin user created");
  } catch (err) {
    logger.error({ err }, "Failed to seed super admin user");
  }
}
