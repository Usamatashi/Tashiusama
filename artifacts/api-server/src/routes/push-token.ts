import { Router } from "express";
import { fdb } from "../lib/firebase";
import { requireAuth } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as JwtPayload;
    const { token } = req.body;
    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "token is required" });
      return;
    }

    const tokenRef = fdb.collection("pushTokens").doc(token);
    const existing = await tokenRef.get();
    if (existing.exists) {
      if (existing.data()!.userId !== caller.userId) {
        await tokenRef.update({ userId: caller.userId });
      }
    } else {
      await tokenRef.set({ userId: caller.userId, token, createdAt: new Date() });
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
