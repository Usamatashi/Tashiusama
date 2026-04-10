import { db, pushTokensTable, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
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
    const tokenRows = await db
      .select({ token: pushTokensTable.token })
      .from(pushTokensTable)
      .where(inArray(pushTokensTable.userId, userIds));

    if (!tokenRows.length) return;

    const messages: PushMessage[] = tokenRows
      .filter((r) => r.token.startsWith("ExponentPushToken["))
      .map((r) => ({
        to: r.token,
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
    const users = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, role));

    const ids = users.map((u) => u.id);
    await sendPushToUsers(ids, title, body, data);
  } catch (err) {
    logger.error({ err }, "Failed to send push to role");
  }
}
