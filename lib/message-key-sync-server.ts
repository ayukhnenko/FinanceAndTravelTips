import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { getAuthSecret } from "@/lib/auth";

const BACKUP_VERSION = 2;
const MAX_PRIVATE_KEY_JWK_LENGTH = 16_384;

type ServerKeyBackupEnvelope = {
  v: typeof BACKUP_VERSION;
  iv: string;
  ct: string;
};

function deriveSyncKey(userId: string): Buffer {
  return createHmac("sha256", getAuthSecret())
    .update(`message-key-sync-v${BACKUP_VERSION}:${userId}`)
    .digest();
}

function isServerKeyBackupEnvelope(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as Partial<ServerKeyBackupEnvelope>;
    return parsed.v === BACKUP_VERSION && typeof parsed.iv === "string" && typeof parsed.ct === "string";
  } catch {
    return false;
  }
}

export function normalizePrivateKeyJwk(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_PRIVATE_KEY_JWK_LENGTH) return null;
  try {
    const jwk = JSON.parse(trimmed) as JsonWebKey;
    if (jwk.kty !== "RSA" || typeof jwk.n !== "string" || typeof jwk.d !== "string") {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

export function encryptPrivateKeyJwkForUser(userId: string, privateKeyJwk: string): string {
  const normalized = normalizePrivateKeyJwk(privateKeyJwk);
  if (!normalized) {
    throw new Error("invalid_private_key_jwk");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveSyncKey(userId), iv);
  const ciphertext = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const envelope: ServerKeyBackupEnvelope = {
    v: BACKUP_VERSION,
    iv: iv.toString("base64"),
    ct: Buffer.concat([ciphertext, tag]).toString("base64"),
  };

  return JSON.stringify(envelope);
}

export function decryptPrivateKeyJwkForUser(userId: string, backup: string): string | null {
  if (!isServerKeyBackupEnvelope(backup)) return null;

  try {
    const envelope = JSON.parse(backup) as ServerKeyBackupEnvelope;
    const payload = Buffer.from(envelope.ct, "base64");
    if (payload.length < 17) return null;

    const tag = payload.subarray(payload.length - 16);
    const ciphertext = payload.subarray(0, payload.length - 16);
    const iv = Buffer.from(envelope.iv, "base64");
    const decipher = createDecipheriv("aes-256-gcm", deriveSyncKey(userId), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      "utf8"
    );

    return normalizePrivateKeyJwk(plaintext);
  } catch {
    return null;
  }
}

export function isStoredPrivateKeyBackupSupported(backup: string): boolean {
  return isServerKeyBackupEnvelope(backup);
}
