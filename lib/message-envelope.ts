export const MESSAGE_ENVELOPE_VERSION = 1;
export const MESSAGE_ENVELOPE_ALG = "RSA-OAEP-256+A256GCM";

export type MessageEnvelope = {
  v: typeof MESSAGE_ENVELOPE_VERSION;
  alg: typeof MESSAGE_ENVELOPE_ALG;
  iv: string;
  ct: string;
  ek: string;
};

export function isEncryptedMessageEnvelope(body: string): boolean {
  try {
    const parsed = JSON.parse(body) as Partial<MessageEnvelope>;
    return (
      parsed.v === MESSAGE_ENVELOPE_VERSION &&
      parsed.alg === MESSAGE_ENVELOPE_ALG &&
      typeof parsed.iv === "string" &&
      parsed.iv.length > 0 &&
      typeof parsed.ct === "string" &&
      parsed.ct.length > 0 &&
      typeof parsed.ek === "string" &&
      parsed.ek.length > 0
    );
  } catch {
    return false;
  }
}

export function validatePlainMessageBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return "Сообщение не может быть пустым";
  if (trimmed.length > 4000) {
    return "Сообщение не должно быть длиннее 4000 символов";
  }
  if (isEncryptedMessageEnvelope(trimmed)) {
    return "Некорректный формат сообщения";
  }
  return null;
}

export function validateEncryptedMessageBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return "Сообщение не может быть пустым";
  if (trimmed.length > 4000) {
    return "Сообщение не должно быть длиннее 4000 символов";
  }
  if (!isEncryptedMessageEnvelope(trimmed)) {
    return "Сообщение должно быть зашифровано";
  }
  return null;
}

export function validateMessageBodyForSend(
  body: string,
  options: { recipientHasPublicKey: boolean }
): string | null {
  const trimmed = body.trim();
  if (!trimmed) return "Сообщение не может быть пустым";
  if (trimmed.length > 4000) {
    return "Сообщение не должно быть длиннее 4000 символов";
  }

  const encrypted = isEncryptedMessageEnvelope(trimmed);
  if (options.recipientHasPublicKey) {
    return encrypted ? null : "Сообщение должно быть зашифровано";
  }

  return encrypted ? "Сообщение должно быть текстом без шифрования" : null;
}

export function previewEncryptedMessageBody(body: string): string {
  if (isEncryptedMessageEnvelope(body)) {
    return "🔒 Зашифрованное сообщение";
  }
  return body;
}
