import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "./logger";

const FIREBASE_PROJECT_ID = "tashi-9512b";
const FIREBASE_STORAGE_BUCKET = "tashi-9512b.firebasestorage.app";

function initFirebase() {
  if (getApps().length) return getApp();

  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!saJson) {
    logger.warn("FIREBASE_SERVICE_ACCOUNT not set — attempting Application Default Credentials");
    return initializeApp({
      projectId: FIREBASE_PROJECT_ID,
      storageBucket: FIREBASE_STORAGE_BUCKET,
    });
  }

  try {
    const serviceAccount = JSON.parse(saJson);
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: FIREBASE_PROJECT_ID,
      storageBucket: FIREBASE_STORAGE_BUCKET,
    });
  } catch (e) {
    logger.error({ err: e }, "Failed to parse FIREBASE_SERVICE_ACCOUNT");
    return initializeApp({
      projectId: FIREBASE_PROJECT_ID,
      storageBucket: FIREBASE_STORAGE_BUCKET,
    });
  }
}

const app = initFirebase();

export const fdb = getFirestore(app);
export const storageBucket = getStorage(app).bucket();

export async function nextId(collectionName: string): Promise<number> {
  const counterRef = fdb.collection("_counters").doc(collectionName);
  return fdb.runTransaction(async (t) => {
    const doc = await t.get(counterRef);
    const current = doc.exists ? (doc.data()!.count as number) : 0;
    const next = current + 1;
    t.set(counterRef, { count: next });
    return next;
  });
}

export function toISOString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof (val as any).toDate === "function") return (val as any).toDate().toISOString();
  if (val instanceof Date) return val.toISOString();
  return new Date(val as any).toISOString();
}

export function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (typeof (val as any).toDate === "function") return (val as any).toDate();
  if (val instanceof Date) return val;
  return new Date(val as any);
}

export function chunkArray<T>(arr: T[], n: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += n) chunks.push(arr.slice(i, i + n));
  return chunks;
}

export async function getDocsByIds(
  collectionName: string,
  ids: (string | number)[],
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  if (!ids.length) return map;
  const refs = ids.map((id) => fdb.collection(collectionName).doc(String(id)));
  const docs = await fdb.getAll(...refs);
  for (const doc of docs) {
    if (doc.exists) {
      map.set(doc.id, { ...doc.data(), id: Number(doc.id) || doc.id });
    }
  }
  return map;
}
