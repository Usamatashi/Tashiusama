import aiplatform from "@google-cloud/aiplatform";
import sharp from "sharp";
import { logger } from "./logger";

const { PredictionServiceClient } = aiplatform.v1;
const { helpers } = aiplatform;

const PROJECT_ID = "tashi-9512b";
const LOCATION = "us-central1";
const MODEL = "multimodalembedding@001";
const EMBEDDING_DIMENSION = 1408;

let client: InstanceType<typeof PredictionServiceClient> | null = null;

function getClient(): InstanceType<typeof PredictionServiceClient> {
  if (client) return client;

  const apiEndpoint = `${LOCATION}-aiplatform.googleapis.com`;
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (saJson) {
    try {
      const sa = JSON.parse(saJson);
      client = new PredictionServiceClient({
        apiEndpoint,
        projectId: PROJECT_ID,
        credentials: {
          client_email: sa.client_email,
          private_key: sa.private_key,
        },
      });
      return client;
    } catch (e) {
      logger.error({ err: e }, "Failed to parse FIREBASE_SERVICE_ACCOUNT for Vertex AI client");
    }
  }

  client = new PredictionServiceClient({ apiEndpoint, projectId: PROJECT_ID });
  return client;
}

export async function preprocessForMatching(input: Buffer): Promise<Buffer> {
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  const base = await sharp(input)
    .rotate()
    .resize(512, 512, { fit: "inside", background: { r: 255, g: 255, b: 255 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .grayscale()
    .normalize()
    .blur(1)
    .toBuffer();

  const ex = await sharp(base).convolve({ width: 3, height: 3, kernel: sobelX }).toBuffer();
  const ey = await sharp(base).convolve({ width: 3, height: 3, kernel: sobelY }).toBuffer();

  const { data: dx, info } = await sharp(ex).raw().toBuffer({ resolveWithObject: true });
  const { data: dy } = await sharp(ey).raw().toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(dx.length);
  for (let i = 0; i < dx.length; i++) {
    const m = Math.min(255, Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]));
    out[i] = m > 40 ? 0 : 255;
  }

  return sharp(out, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .toBuffer();
}

export async function getImageEmbedding(input: Buffer | string): Promise<number[]> {
  const c = getClient();
  const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}`;

  let bytesBase64Encoded: string;
  if (Buffer.isBuffer(input)) {
    bytesBase64Encoded = input.toString("base64");
  } else if (input.startsWith("data:")) {
    const m = input.match(/^data:[^;]+;base64,(.+)$/s);
    bytesBase64Encoded = m ? m[1] : input;
  } else if (input.startsWith("http://") || input.startsWith("https://")) {
    const resp = await fetch(input);
    if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
    bytesBase64Encoded = Buffer.from(await resp.arrayBuffer()).toString("base64");
  } else {
    bytesBase64Encoded = input;
  }

  const instance = helpers.toValue({
    image: { bytesBase64Encoded },
  });
  const parameters = helpers.toValue({ dimension: EMBEDDING_DIMENSION });

  const [response] = await c.predict({
    endpoint,
    instances: instance ? [instance] : [],
    parameters,
  });

  const predictions = response.predictions ?? [];
  if (!predictions.length) throw new Error("Vertex AI returned no predictions");

  const pred = helpers.fromValue(predictions[0] as any) as { imageEmbedding?: number[] };
  if (!pred?.imageEmbedding || !Array.isArray(pred.imageEmbedding)) {
    throw new Error("Vertex AI response missing imageEmbedding");
  }
  return pred.imageEmbedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function getImageEmbeddingFromUrl(url: string): Promise<number[]> {
  return getImageEmbedding(url);
}
