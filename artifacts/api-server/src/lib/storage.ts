import { randomUUID } from "crypto";
import { storageBucket } from "./firebase";

export async function uploadBase64ToStorage(
  base64DataUrl: string,
  filePath: string,
): Promise<string> {
  const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error("Invalid base64 data URL format");

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  return uploadBufferToStorage(buffer, mimeType, filePath);
}

export async function uploadBufferToStorage(
  buffer: Buffer,
  mimeType: string,
  filePath: string,
): Promise<string> {
  const token = randomUUID();
  const file = storageBucket.file(filePath);
  await file.save(buffer, {
    contentType: mimeType,
    metadata: {
      cacheControl: "public, max-age=31536000",
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });
  const encodedPath = encodeURIComponent(filePath);
  return `https://firebasestorage.googleapis.com/v0/b/${storageBucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}

export async function deleteFromStorage(filePath: string): Promise<void> {
  try {
    await storageBucket.file(filePath).delete();
  } catch {
  }
}
