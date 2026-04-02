const SESSION_PAYLOAD = "loan-auth-v1";

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

export async function createSessionToken(): Promise<string> {
  return hmacSha256Hex(getAuthSecret(), SESSION_PAYLOAD);
}

export async function verifySessionToken(token: string): Promise<boolean> {
  const expected = await createSessionToken();
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export const SESSION_COOKIE = "loan_session";
