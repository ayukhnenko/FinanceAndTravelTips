"use client";

import {
  MESSAGE_ENVELOPE_ALG,
  MESSAGE_ENVELOPE_VERSION,
  type MessageEnvelope,
} from "@/lib/message-envelope";

const PRIVATE_KEY_STORAGE = "app_message_private_key_jwk_v1";
const PUBLIC_KEY_STORAGE = "app_message_public_key_spki_v1";
const SENT_MESSAGE_CACHE_KEY = "app_message_sent_cache_v1";

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

async function savePrivateKey(privateKey: CryptoKey): Promise<void> {
  const jwk = await getSubtleCrypto().exportKey("jwk", privateKey);
  localStorage.setItem(PRIVATE_KEY_STORAGE, JSON.stringify(jwk));
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

async function uploadPublicKey(
  publicKeySpki: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const resp = await fetch("/api/auth/messages/keys", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicKey: publicKeySpki }),
  });
  const data = (await resp.json().catch(() => ({}))) as { error?: string };
  if (!resp.ok) {
    return { ok: false, error: data.error ?? "Не удалось сохранить публичный ключ" };
  }
  return { ok: true };
}

export async function ensureLocalMessageKeys(): Promise<{
  publicKeySpki: string;
  privateKey: CryptoKey;
  keysStoredOnServer: boolean;
  keysStoreError: string | null;
}> {
  const existingPrivate = await importPrivateKeyFromStorage();
  const storedPublic = localStorage.getItem(PUBLIC_KEY_STORAGE);
  if (existingPrivate && storedPublic) {
    const upload = await uploadPublicKey(storedPublic).catch(() => ({
      ok: false as const,
      error: "Не удалось сохранить публичный ключ",
    }));
    return {
      publicKeySpki: storedPublic,
      privateKey: existingPrivate,
      keysStoredOnServer: upload.ok,
      keysStoreError: upload.ok ? null : upload.error,
    };
  }

  const pair = await generateMessageKeyPair();
  await savePrivateKey(pair.privateKey);
  const publicKeySpki = await exportPublicKeySpki(pair.publicKey);
  localStorage.setItem(PUBLIC_KEY_STORAGE, publicKeySpki);
  const upload = await uploadPublicKey(publicKeySpki);
  if (!upload.ok) {
    return {
      publicKeySpki,
      privateKey: pair.privateKey,
      keysStoredOnServer: false,
      keysStoreError: upload.error,
    };
  }

  return {
    publicKeySpki,
    privateKey: pair.privateKey,
    keysStoredOnServer: true,
    keysStoreError: null,
  };
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
