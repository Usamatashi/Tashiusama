import bcrypt from "bcryptjs";
import { fdb } from "./firebase";
import { logger } from "./logger";

export async function seedAdminUser() {
  try {
    const phone = process.env.SUPER_ADMIN_PHONE ?? "03055198651";
    const password = process.env.SUPER_ADMIN_PASSWORD ?? "khan0112";

    const seedLockRef = fdb.collection("_locks").doc("super_admin_seed");

    await fdb.runTransaction(async (t) => {
      const lockDoc = await t.get(seedLockRef);
      if (lockDoc.exists) {
        const data = lockDoc.data()!;
        if (data.role !== "super_admin") {
          t.update(fdb.collection("users").doc(String(data.userId)), { role: "super_admin" });
          t.update(seedLockRef, { role: "super_admin" });
        }
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const counterRef = fdb.collection("_counters").doc("users");
      const counterDoc = await t.get(counterRef);
      const current = counterDoc.exists ? (counterDoc.data()!.count as number) : 0;
      const id = current + 1;
      t.set(counterRef, { count: id });

      t.set(fdb.collection("users").doc(String(id)), {
        id,
        phone,
        name: "Super Admin",
        passwordHash,
        role: "super_admin",
        points: 0,
        createdAt: new Date(),
      });

      t.set(seedLockRef, { userId: id, phone, role: "super_admin", createdAt: new Date() });
    });

    const lockDoc = await seedLockRef.get();
    if (lockDoc.exists) {
      logger.info({ phone }, "Super admin seed complete");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed super admin user");
  }
}
