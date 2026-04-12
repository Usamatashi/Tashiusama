import { randomUUID } from "crypto";
import { getApp } from "firebase-admin/app";

const BUCKET = "tashi-9512b.firebasestorage.app";

async function getAccessToken(): Promise<string> {
  const app = getApp();
  const cred = app.options.credential;
  if (!cred) throw new Error("No Firebase credential available");
  const token = await cred.getAccessToken();
  return token.access_token;
}

export async function uploadBase64ToStorage(
  base64DataUrl: string,
  filePath: string,
): Promise<string> {
  const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  const mimeType = match ? match[1] : "image/jpeg";
  const base64Data = match ? match[2] : base64DataUrl;
  const buffer = Buffer.from(base64Data, "base64");
  return uploadBufferToStorage(buffer, mimeType, filePath);
}

export async function uploadBufferToStorage(
  buffer: Buffer,
  mimeType: string,
  filePath: string,
): Promise<string> {
  const accessToken = await getAccessToken();
  const encodedPath = encodeURIComponent(filePath);

  const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?uploadType=media&name=${encodedPath}`;
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": mimeType,
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Firebase Storage upload failed: ${uploadRes.status} ${text}`);
  }

  const responseData = await uploadRes.json() as { downloadTokens?: string };
  const downloadToken = responseData.downloadTokens ?? randomUUID();

  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}?alt=media&token=${downloadToken}`;
}

export async function deleteFromStorage(filePath: string): Promise<void> {
  try {
    const accessToken = await getAccessToken();
    const encodedPath = encodeURIComponent(filePath);
    await fetch(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
  }
}
