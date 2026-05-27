"use client";

import {
  MESSAGE_ENVELOPE_ALG,
  MESSAGE_ENVELOPE_VERSION,
  type MessageEnvelope,
} from "@/lib/message-envelope";

const PRIVATE_KEY_STORAGE = "app_message_private_key_jwk_v1";
const PUBLIC_KEY_STORAGE = "app_message_public_key_spki_v1";
const SENT_MESSAGE_CACHE_KEY = "app_message_sent_cache_v1";

export type MessageKeysSetupResult =
  | {
      status: "ready";
      publicKeySpki: string;
      privateKey: CryptoKey;
      keysStoredOnServer: boolean;
      keysStoreError: string | null;
    }
  | { status: "blocked"; error: string };

type ServerKeysResponse = {
  ok?: boolean;
  publicKey?: string | null;
  hasKeys?: boolean;
  hasPrivateKeyBackup?: boolean;
  privateKeyJwk?: string | null;
  error?: string;
};

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto?.subtle === "undefined") {
    throw new Error("Web Crypto недоступен");
  }
  return globalThis.crypto.subtle;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function readSentCache(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(SENT_MESSAGE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSentCache(cache: Record<string, string>): void {
  sessionStorage.setItem(SENT_MESSAGE_CACHE_KEY, JSON.stringify(cache));
}

export function cacheSentMessagePlaintext(messageId: string, plaintext: string): void {
  const cache = readSentCache();
  cache[messageId] = plaintext;
  writeSentCache(cache);
}

export function readSentMessagePlaintext(messageId: string): string | null {
  const cache = readSentCache();
  const value = cache[messageId];
  return typeof value === "string" ? value : null;
}

async function exportPublicKeySpki(publicKey: CryptoKey): Promise<string> {
  const spki = await getSubtleCrypto().exportKey("spki", publicKey);
  return bytesToBase64(new Uint8Array(spki));
}

async function exportPrivateKeyJwk(privateKey: CryptoKey): Promise<string> {
  const jwk = await getSubtleCrypto().exportKey("jwk", privateKey);
  return JSON.stringify(jwk);
}

async function importPublicKeySpki(spkiBase64: string): Promise<CryptoKey> {
  return getSubtleCrypto().importKey(
    "spki",
    base64ToBytes(spkiBase64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

async function importPrivateKeyFromStorage(): Promise<CryptoKey | null> {
  const raw = localStorage.getItem(PRIVATE_KEY_STORAGE);
  if (!raw) return null;
  try {
    const jwk = JSON.parse(raw) as JsonWebKey;
    return getSubtleCrypto().importKey(
      "jwk",
      jwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"]
    );
  } catch {
    return null;
  }
}

async function importPrivateKeyFromJwkString(privateKeyJwk: string): Promise<CryptoKey> {
  const jwk = JSON.parse(privateKeyJwk) as JsonWebKey;
  return getSubtleCrypto().importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );
}

async function publicKeySpkiFromPrivateKey(privateKey: CryptoKey): Promise<string> {
  const jwk = await getSubtleCrypto().exportKey("jwk", privateKey);
  if (!jwk.n || !jwk.e) {
    throw new Error("Не удалось получить публичный ключ");
  }
  const publicJwk: JsonWebKey = { kty: jwk.kty, n: jwk.n, e: jwk.e };
  const publicKey = await getSubtleCrypto().importKey(
    "jwk",
    publicJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
  return exportPublicKeySpki(publicKey);
}

async function saveLocalMessageKeys(privateKey: CryptoKey, publicKeySpki: string): Promise<void> {
  const jwk = await exportPrivateKeyJwk(privateKey);
  localStorage.setItem(PRIVATE_KEY_STORAGE, jwk);
  localStorage.setItem(PUBLIC_KEY_STORAGE, publicKeySpki);
}

async function fetchServerKeys(): Promise<ServerKeysResponse> {
  const resp = await fetch("/api/auth/messages/keys");
  return (await resp.json().catch(() => ({}))) as ServerKeysResponse;
}

async function syncKeysToServer(
  publicKeySpki: string,
  privateKey: CryptoKey
): Promise<{ ok: true } | { ok: false; error: string }> {
  const privateKeyJwk = await exportPrivateKeyJwk(privateKey);
  const resp = await fetch("/api/auth/messages/keys", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicKey: publicKeySpki, privateKeyJwk }),
  });
  const data = (await resp.json().catch(() => ({}))) as { error?: string };
  if (!resp.ok) {
    return { ok: false, error: data.error ?? "Не удалось синхронизировать ключи" };
  }
  return { ok: true };
}

async function restoreKeysFromServer(
  server: ServerKeysResponse
): Promise<{ privateKey: CryptoKey; publicKeySpki: string } | null> {
  if (!server.privateKeyJwk) return null;

  const privateKey = await importPrivateKeyFromJwkString(server.privateKeyJwk);
  const publicKeySpki = server.publicKey ?? (await publicKeySpkiFromPrivateKey(privateKey));
  await saveLocalMessageKeys(privateKey, publicKeySpki);
  return { privateKey, publicKeySpki };
}

export async function generateMessageKeyPair(): Promise<CryptoKeyPair> {
  return getSubtleCrypto().generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

function readyResult(input: {
  publicKeySpki: string;
  privateKey: CryptoKey;
  keysStoredOnServer: boolean;
  keysStoreError: string | null;
}): MessageKeysSetupResult {
  return { status: "ready", ...input };
}

export async function ensureLocalMessageKeys(): Promise<MessageKeysSetupResult> {
  const server = await fetchServerKeys();
  let existingPrivate = await importPrivateKeyFromStorage();
  let storedPublic = localStorage.getItem(PUBLIC_KEY_STORAGE);

  const serverPublic = server.publicKey ?? null;
  const localMatchesServer = Boolean(
    existingPrivate && storedPublic && serverPublic && storedPublic === serverPublic
  );

  if (!localMatchesServer && server.privateKeyJwk) {
    const restored = await restoreKeysFromServer(server);
    if (restored) {
      existingPrivate = restored.privateKey;
      storedPublic = restored.publicKeySpki;
    }
  }

  if (existingPrivate && storedPublic) {
    if (serverPublic && storedPublic !== serverPublic && !server.privateKeyJwk) {
      localStorage.removeItem(PRIVATE_KEY_STORAGE);
      localStorage.removeItem(PUBLIC_KEY_STORAGE);
      return {
        status: "blocked",
        error:
          "Ключ шифрования создан на другом устройстве. Откройте «Сообщения» там один раз для синхронизации.",
      };
    }

    const upload = await syncKeysToServer(storedPublic, existingPrivate).catch(() => ({
      ok: false as const,
      error: "Не удалось синхронизировать ключи",
    }));

    if (
      !upload.ok &&
      serverPublic &&
      storedPublic !== serverPublic
    ) {
      return {
        status: "blocked",
        error:
          "Ключ шифрования создан на другом устройстве. Откройте «Сообщения» там один раз для синхронизации.",
      };
    }

    return readyResult({
      publicKeySpki: storedPublic,
      privateKey: existingPrivate,
      keysStoredOnServer: upload.ok,
      keysStoreError: upload.ok ? null : upload.error,
    });
  }

  if (server.hasKeys) {
    return {
      status: "blocked",
      error:
        "Ключ шифрования создан на другом устройстве. Откройте «Сообщения» там один раз для синхронизации.",
    };
  }

  const pair = await generateMessageKeyPair();
  const publicKeySpki = await exportPublicKeySpki(pair.publicKey);
  await saveLocalMessageKeys(pair.privateKey, publicKeySpki);

  const upload = await syncKeysToServer(publicKeySpki, pair.privateKey);
  return readyResult({
    publicKeySpki,
    privateKey: pair.privateKey,
    keysStoredOnServer: upload.ok,
    keysStoreError: upload.ok ? null : upload.error,
  });
}

export async function encryptMessageForRecipient(
  plaintext: string,
  recipientPublicKeySpki: string
): Promise<string> {
  const recipientPublicKey = await importPublicKeySpki(recipientPublicKeySpki);
  const aesKey = await getSubtleCrypto().generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await getSubtleCrypto().encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoded
  );
  const rawAesKey = await getSubtleCrypto().exportKey("raw", aesKey);
  const encryptedAesKey = await getSubtleCrypto().encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    rawAesKey
  );

  const envelope: MessageEnvelope = {
    v: MESSAGE_ENVELOPE_VERSION,
    alg: MESSAGE_ENVELOPE_ALG,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ciphertext)),
    ek: bytesToBase64(new Uint8Array(encryptedAesKey)),
  };

  return JSON.stringify(envelope);
}

export async function decryptMessageForRecipient(
  envelopeJson: string,
  privateKey: CryptoKey
): Promise<string> {
  const envelope = JSON.parse(envelopeJson) as MessageEnvelope;
  if (envelope.v !== MESSAGE_ENVELOPE_VERSION || envelope.alg !== MESSAGE_ENVELOPE_ALG) {
    throw new Error("Неподдерживаемый формат сообщения");
  }

  const rawAesKey = await getSubtleCrypto().decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToBytes(envelope.ek)
  );
  const aesKey = await getSubtleCrypto().importKey(
    "raw",
    rawAesKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const plaintext = await getSubtleCrypto().decrypt(
    { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
    aesKey,
    base64ToBytes(envelope.ct)
  );

  return new TextDecoder().decode(plaintext);
}

export async function resolveMessagePlaintext(input: {
  id: string;
  body: string;
  isOwn: boolean;
  privateKey: CryptoKey | null;
}): Promise<string> {
  const { body, isOwn, privateKey, id } = input;

  if (isOwn) {
    const cached = readSentMessagePlaintext(id);
    if (cached) return cached;
  }

  let encrypted = false;
  try {
    const parsed = JSON.parse(body) as Partial<MessageEnvelope>;
    encrypted =
      parsed.v === MESSAGE_ENVELOPE_VERSION && parsed.alg === MESSAGE_ENVELOPE_ALG;
  } catch {
    encrypted = false;
  }

  if (!encrypted) return body;

  if (isOwn) {
    return "🔒 Зашифрованное сообщение";
  }

  if (!privateKey) {
    return "🔒 Не удалось расшифровать";
  }

  try {
    return await decryptMessageForRecipient(body, privateKey);
  } catch {
    return "🔒 Не удалось расшифровать";
  }
}
