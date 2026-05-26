import { createHash, randomBytes } from "node:crypto";
import { sendPasswordResetEmail } from "@/lib/resend-mail";
import { resolveSiteUrl } from "@/lib/site-url";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeEmail, validateNewPassword } from "@/lib/user-credentials";
import { findUserByVerifiedEmail, updateUserPassword } from "@/lib/users-store";

const RESET_TIMEOUT_MS = Number(process.env.PASSWORD_RESET_TIMEOUT_MS ?? "5000");
const RESET_TTL_MS = Number(process.env.PASSWORD_RESET_TTL_MS ?? `${60 * 60 * 1000}`);
const RESET_COOLDOWN_MS = Number(process.env.PASSWORD_RESET_COOLDOWN_MS ?? `${5 * 60 * 1000}`);

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("password_reset_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function createRawToken(): string {
  return randomBytes(32).toString("hex");
}

export type RequestPasswordResetResult = { ok: true } | { ok: false; error: string };

export async function requestPasswordReset(email: string): Promise<RequestPasswordResetResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "База данных не настроена" };
  }

  const user = await findUserByVerifiedEmail(email);
  if (!user?.email) {
    return { ok: true };
  }

  const normalizedEmail = normalizeEmail(user.email);
  const now = Date.now();
  const cooldownSince = new Date(now - RESET_COOLDOWN_MS).toISOString();

  try {
    const recent = await withTimeout(
      supabase
        .from("app_password_reset_tokens")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", cooldownSince)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => r),
      RESET_TIMEOUT_MS
    );

    if (recent.data) {
      return { ok: true };
    }

    await withTimeout(
      supabase.from("app_password_reset_tokens").delete().eq("user_id", user.id).then((r) => r),
      RESET_TIMEOUT_MS
    );

    const rawToken = createRawToken();
    const expiresAt = new Date(now + RESET_TTL_MS).toISOString();

    const insert = await withTimeout(
      supabase
        .from("app_password_reset_tokens")
        .insert({
          user_id: user.id,
          token_hash: hashToken(rawToken),
          email: normalizedEmail,
          expires_at: expiresAt,
        })
        .then((r) => r),
      RESET_TIMEOUT_MS
    );

    if (insert.error) {
      console.error("[password-reset] insert token:", insert.error);
      return { ok: false, error: "Не удалось подготовить восстановление пароля" };
    }

    const resetUrl = `${resolveSiteUrl()}/account/reset-password?token=${encodeURIComponent(rawToken)}`;
    const sent = await sendPasswordResetEmail({
      to: normalizedEmail,
      login: user.login,
      resetUrl,
    });

    if (!sent.ok) {
      await withTimeout(
        supabase.from("app_password_reset_tokens").delete().eq("user_id", user.id).then((r) => r),
        RESET_TIMEOUT_MS
      );
      return sent;
    }

    return { ok: true };
  } catch (err) {
    console.error("[password-reset] requestPasswordReset:", err);
    return { ok: false, error: "Не удалось отправить письмо" };
  }
}

export type ResetPasswordResult = { ok: true } | { ok: false; error: string };

export async function resetPasswordWithToken(
  rawToken: string,
  password: string
): Promise<ResetPasswordResult> {
  const passwordError = validateNewPassword(password);
  if (passwordError) {
    return { ok: false, error: passwordError };
  }

  const token = rawToken.trim();
  if (!token) {
    return { ok: false, error: "Ссылка недействительна" };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "База данных не настроена" };
  }

  const tokenHash = hashToken(token);
  const nowIso = new Date().toISOString();

  try {
    const tokenRow = await withTimeout(
      supabase
        .from("app_password_reset_tokens")
        .select("id,user_id,email,expires_at")
        .eq("token_hash", tokenHash)
        .gt("expires_at", nowIso)
        .maybeSingle()
        .then((r) => r),
      RESET_TIMEOUT_MS
    );

    if (tokenRow.error || !tokenRow.data) {
      return { ok: false, error: "Ссылка недействительна или срок её действия истёк" };
    }

    const row = tokenRow.data as {
      id: string;
      user_id: string;
      email: string;
      expires_at: string;
    };

    const user = await findUserByVerifiedEmail(row.email);
    if (!user || user.id !== row.user_id) {
      return { ok: false, error: "Ссылка недействительна" };
    }

    const updated = await updateUserPassword(row.user_id, password);
    if (!updated.ok) {
      return updated;
    }

    await withTimeout(
      supabase.from("app_password_reset_tokens").delete().eq("user_id", row.user_id).then((r) => r),
      RESET_TIMEOUT_MS
    );

    return { ok: true };
  } catch (err) {
    console.error("[password-reset] resetPasswordWithToken:", err);
    return { ok: false, error: "Не удалось обновить пароль" };
  }
}
