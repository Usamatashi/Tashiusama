import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export async function seedAdminUser() {
  try {
    const phone = "01231231231";
    const password = "khan0112";

    const existing = await db.select().from(usersTable).where(eq(usersTable.phone, phone));

    if (existing.length > 0) {
      if (existing[0].role !== "admin") {
        await db.update(usersTable)
          .set({ role: "admin", passwordHash: await bcrypt.hash(password, 10) })
          .where(eq(usersTable.phone, phone));
        logger.info({ phone }, "Admin user updated to admin role");
      } else {
        logger.info({ phone }, "Admin user already exists");
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.insert(usersTable).values({
      phone,
      name: "Admin",
      passwordHash,
      role: "admin",
      points: 0,
    });
    logger.info({ phone }, "Admin user created");
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}
