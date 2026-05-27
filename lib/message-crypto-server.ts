import { webcrypto } from "node:crypto";
import {
  MESSAGE_ENVELOPE_ALG,
  MESSAGE_ENVELOPE_VERSION,
  type MessageEnvelope,
} from "@/lib/message-envelope";

const subtle = webcrypto.subtle;

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(value, "base64"));
}

async function importPublicKeySpki(spkiBase64: string): Promise<CryptoKey> {
  return subtle.importKey(
    "spki",
    base64ToBytes(spkiBase64),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

export async function encryptMessageForRecipientServer(
  plaintext: string,
  publicKeySpkiBase64: string
): Promise<string> {
  const recipientPublicKey = await importPublicKeySpki(publicKeySpkiBase64);
  const aesKey = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv }, aesKey, encoded);
  const rawAesKey = await subtle.exportKey("raw", aesKey);
  const encryptedAesKey = await subtle.encrypt(
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
