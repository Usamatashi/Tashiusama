import bcrypt from "bcryptjs";
import { fdb, nextId } from "./firebase";
import { logger } from "./logger";

export async function seedAdminUser() {
  try {
    const phone = process.env.SUPER_ADMIN_PHONE ?? "03055198651";
    const password = process.env.SUPER_ADMIN_PASSWORD ?? "khan0112";

    const snap = await fdb.collection("users").where("phone", "==", phone).limit(1).get();

    if (!snap.empty) {
      const doc = snap.docs[0];
      const data = doc.data();
      if (data.role !== "super_admin") {
        await doc.ref.update({ role: "super_admin" });
        logger.info({ phone }, "User upgraded to super_admin");
      } else {
        logger.info({ phone }, "Super admin user already exists");
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = await nextId("users");
    await fdb.collection("users").doc(String(id)).set({
      id,
      phone,
      name: "Super Admin",
      passwordHash,
      role: "super_admin",
      points: 0,
      createdAt: new Date(),
    });
    logger.info({ phone }, "Super admin user created");
  } catch (err) {
    logger.error({ err }, "Failed to seed super admin user");
  }
}
