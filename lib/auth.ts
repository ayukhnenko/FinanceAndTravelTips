const ADMIN_SESSION_PAYLOAD = "loan-admin-auth-v1";

export function getAuthSecret(): string {
  return (
    process.env.LOAN_AUTH_SECRET ??
    "loan-calculator-dev-secret-change-in-production"
  );
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createAdminSessionToken(): Promise<string> {
  return hmacSha256Hex(getAuthSecret(), ADMIN_SESSION_PAYLOAD);
}

export async function verifyAdminSessionToken(token: string): Promise<boolean> {
  const expected = await hmacSha256Hex(getAuthSecret(), ADMIN_SESSION_PAYLOAD);
  return timingSafeEqual(token, expected);
}

export const ADMIN_SESSION_COOKIE = "loan_admin_session";
export const USER_SESSION_COOKIE = "loan_user_session";

const USER_SESSION_PREFIX = "loan-user-auth-v1";
const USER_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

export async function createUserSessionToken(userId: string): Promise<string> {
  const expiresAt = Date.now() + USER_SESSION_MAX_AGE_SEC * 1000;
  const payload = `${userId}:${expiresAt}`;
  const signature = await hmacSha256Hex(getAuthSecret(), `${USER_SESSION_PREFIX}:${payload}`);
  return `${encodeURIComponent(payload)}.${signature}`;
}

export async function verifyUserSessionToken(token: string): Promise<string | null> {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex <= 0) return null;

  const payload = decodeURIComponent(token.slice(0, dotIndex));
  const signature = token.slice(dotIndex + 1);
  const expected = await hmacSha256Hex(getAuthSecret(), `${USER_SESSION_PREFIX}:${payload}`);
  if (!timingSafeEqual(signature, expected)) return null;

  const colonIndex = payload.indexOf(":");
  if (colonIndex <= 0) return null;

  const userId = payload.slice(0, colonIndex);
  const expiresAt = Number(payload.slice(colonIndex + 1));
  if (!userId || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  return userId;
}

export function getUserSessionMaxAgeSec(): number {
  return USER_SESSION_MAX_AGE_SEC;
}
