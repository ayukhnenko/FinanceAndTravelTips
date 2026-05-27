import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { isMissingColumnError } from "@/lib/supabase-errors";
import { isStoredPrivateKeyBackupSupported } from "@/lib/message-key-sync-server";

const KEYS_TIMEOUT_MS = Number(process.env.MESSAGES_TIMEOUT_MS ?? "5000");
const MAX_PRIVATE_KEY_BACKUP_LENGTH = 32_768;

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("message_keys_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function normalizeMessagePublicKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 4096) return null;
  if (!/^[A-Za-z0-9+/=]+$/.test(trimmed)) return null;
  return trimmed;
}

export function normalizeMessagePrivateKeyBackup(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_PRIVATE_KEY_BACKUP_LENGTH) return null;
  if (!isStoredPrivateKeyBackupSupported(trimmed)) return null;
  return trimmed;
}

export async function getUserMessagePrivateKeyBackup(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  try {
    const response = await withTimeout(
      supabase
        .from("app_users")
        .select("message_private_key_backup")
        .eq("id", userId)
        .maybeSingle()
        .then((r) => r),
      KEYS_TIMEOUT_MS
    );
    if (response.error) {
      if (isMissingColumnError(response.error)) return null;
      console.error("[message-keys] getUserMessagePrivateKeyBackup:", response.error);
      return null;
    }
    if (!response.data) return null;
    const backup = response.data.message_private_key_backup;
    return typeof backup === "string" && backup.trim() ? backup.trim() : null;
  } catch (err) {
    console.error("[message-keys] getUserMessagePrivateKeyBackup:", err);
    return null;
  }
}

export async function setUserMessagePrivateKeyBackup(
  userId: string,
  backup: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "База данных не настроена" };
  }

  const normalized = normalizeMessagePrivateKeyBackup(backup);
  if (!normalized) {
    return { ok: false, error: "Некорректная резервная копия ключа" };
  }

  try {
    const response = await withTimeout(
      supabase
        .from("app_users")
        .update({
          message_private_key_backup: normalized,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .then((r) => r),
      KEYS_TIMEOUT_MS
    );

    if (response.error) {
      if (isMissingColumnError(response.error)) {
        return {
          ok: false,
          error:
            "В базе нет колонки message_private_key_backup — выполните SQL-миграцию в Supabase",
        };
      }
      console.error("[message-keys] setUserMessagePrivateKeyBackup:", response.error);
      return { ok: false, error: "Не удалось сохранить резервную копию ключа" };
    }

    return { ok: true };
  } catch (err) {
    console.error("[message-keys] setUserMessagePrivateKeyBackup:", err);
    return { ok: false, error: "Не удалось сохранить резервную копию ключа" };
  }
}

export async function getUserMessagePublicKey(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  try {
    const response = await withTimeout(
      supabase
        .from("app_users")
        .select("message_public_key")
        .eq("id", userId)
        .maybeSingle()
        .then((r) => r),
      KEYS_TIMEOUT_MS
    );
    if (response.error) {
      if (isMissingColumnError(response.error)) return null;
      console.error("[message-keys] getUserMessagePublicKey:", response.error);
      return null;
    }
    if (!response.data) return null;
    const key = response.data.message_public_key;
    return typeof key === "string" && key.trim() ? key.trim() : null;
  } catch (err) {
    console.error("[message-keys] getUserMessagePublicKey:", err);
    return null;
  }
}

export async function setUserMessagePublicKey(
  userId: string,
  publicKey: string
): Promise<{ ok: true; keyChanged: boolean } | { ok: false; error: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "База данных не настроена" };
  }

  const normalized = normalizeMessagePublicKey(publicKey);
  if (!normalized) {
    return { ok: false, error: "Некорректный публичный ключ" };
  }

  const existing = await getUserMessagePublicKey(userId);
  const keyChanged = existing !== normalized;

  if (existing && existing !== normalized) {
    return {
      ok: false,
      error: "Ключ шифрования уже создан на другом устройстве",
    };
  }

  try {
    const response = await withTimeout(
      supabase
        .from("app_users")
        .update({
          message_public_key: normalized,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .then((r) => r),
      KEYS_TIMEOUT_MS
    );

    if (response.error) {
      if (isMissingColumnError(response.error)) {
        return {
          ok: false,
          error: "В базе нет колонки message_public_key — выполните SQL-миграцию в Supabase",
        };
      }
      console.error("[message-keys] setUserMessagePublicKey:", response.error);
      return { ok: false, error: "Не удалось сохранить публичный ключ" };
    }

    return { ok: true, keyChanged };
  } catch (err) {
    console.error("[message-keys] setUserMessagePublicKey:", err);
    return { ok: false, error: "Не удалось сохранить публичный ключ" };
  }
}
