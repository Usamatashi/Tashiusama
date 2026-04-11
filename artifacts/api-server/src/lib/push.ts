import { fdb, chunkArray } from "./firebase";
import { logger } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  priority?: "default" | "normal" | "high";
}

export async function sendPushToUsers(
  userIds: number[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!userIds.length) return;

  try {
    const tokens: string[] = [];
    const batches = chunkArray(userIds, 30);
    for (const batch of batches) {
      const snap = await fdb.collection("pushTokens").where("userId", "in", batch).get();
      snap.forEach((doc) => {
        const token = doc.data().token as string;
        if (token) tokens.push(token);
      });
    }

    if (!tokens.length) return;

    const messages: PushMessage[] = tokens
      .filter((t) => t.startsWith("ExponentPushToken["))
      .map((t) => ({
        to: t,
        title,
        body,
        sound: "default",
        priority: "high",
        data: data ?? {},
      }));

    if (!messages.length) return;

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "Expo push API returned non-OK status");
    }
  } catch (err) {
    logger.error({ err }, "Failed to send push notification");
  }
}

export async function sendPushToRole(
  role: "admin" | "super_admin",
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    const snap = await fdb.collection("users").where("role", "==", role).get();
    const ids = snap.docs.map((d) => d.data().id as number);
    await sendPushToUsers(ids, title, body, data);
  } catch (err) {
    logger.error({ err }, "Failed to send push to role");
  }
}
