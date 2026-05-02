const RAILWAY_URL = process.env.EXPO_PUBLIC_RAILWAY_URL ?? "";
const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";

function resolveOrigin(): string {
  if (RAILWAY_URL) {
    return RAILWAY_URL.startsWith("http") ? RAILWAY_URL : `https://${RAILWAY_URL}`;
  }
  if (DOMAIN) {
    return `https://${DOMAIN}`;
  }
  return "";
}

export const apiOrigin = resolveOrigin();
export const apiBase = apiOrigin ? `${apiOrigin}/api` : "";
