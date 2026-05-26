import { createHash, randomBytes } from "node:crypto";
import { sendVerificationEmail } from "@/lib/resend-mail";
import { resolveSiteUrl } from "@/lib/site-url";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeEmail } from "@/lib/user-credentials";
import { findUserById } from "@/lib/users-store";

const VERIFICATION_TIMEOUT_MS = Number(process.env.EMAIL_VERIFICATION_TIMEOUT_MS ?? "5000");
const VERIFICATION_TTL_MS = Number(process.env.EMAIL_VERIFICATION_TTL_MS ?? `${24 * 60 * 60 * 1000}`);
const RESEND_COOLDOWN_MS = Number(process.env.EMAIL_VERIFICATION_COOLDOWN_MS ?? "60000");

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("email_verification_timeout")), timeoutMs);
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

export type SendUserEmailVerificationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendUserEmailVerification(
  userId: string
): Promise<SendUserEmailVerificationResult> {
  const user = await findUserById(userId);
  if (!user) {
    return { ok: false, error: "Пользователь не найден" };
  }
  if (!user.email) {
    return { ok: false, error: "E-mail не указан в профиле" };
  }
  if (user.emailVerifiedAt) {
    return { ok: false, error: "E-mail уже подтверждён" };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "База данных не настроена" };
  }

  const email = normalizeEmail(user.email);
  const now = Date.now();
  const cooldownSince = new Date(now - RESEND_COOLDOWN_MS).toISOString();

  try {
    const recent = await withTimeout(
      supabase
        .from("app_email_verification_tokens")
        .select("created_at")
        .eq("user_id", userId)
        .gte("created_at", cooldownSince)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => r),
      VERIFICATION_TIMEOUT_MS
    );

    if (recent.data) {
      return { ok: false, error: "Письмо уже отправлено. Подождите минуту и попробуйте снова." };
    }

    await withTimeout(
      supabase.from("app_email_verification_tokens").delete().eq("user_id", userId).then((r) => r),
      VERIFICATION_TIMEOUT_MS
    );

    const rawToken = createRawToken();
    const expiresAt = new Date(now + VERIFICATION_TTL_MS).toISOString();

    const insert = await withTimeout(
      supabase
        .from("app_email_verification_tokens")
        .insert({
          user_id: userId,
          token_hash: hashToken(rawToken),
          email,
          expires_at: expiresAt,
        })
        .then((r) => r),
      VERIFICATION_TIMEOUT_MS
    );

    if (insert.error) {
      console.error("[email-verification] insert token:", insert.error);
      return { ok: false, error: "Не удалось подготовить подтверждение" };
    }

    const verifyUrl = `${resolveSiteUrl()}/account/verify-email?token=${encodeURIComponent(rawToken)}`;
    const sent = await sendVerificationEmail({
      to: email,
      login: user.login,
      verifyUrl,
    });

    if (!sent.ok) {
      await withTimeout(
        supabase.from("app_email_verification_tokens").delete().eq("user_id", userId).then((r) => r),
        VERIFICATION_TIMEOUT_MS
      );
      return sent;
    }

    return { ok: true };
  } catch (err) {
    console.error("[email-verification] sendUserEmailVerification:", err);
    return { ok: false, error: "Не удалось отправить письмо" };
  }
}

export type VerifyEmailTokenResult =
  | { ok: true }
  | { ok: false; error: string };

export async function verifyEmailToken(rawToken: string): Promise<VerifyEmailTokenResult> {
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
        .from("app_email_verification_tokens")
        .select("id,user_id,email,expires_at")
        .eq("token_hash", tokenHash)
        .gt("expires_at", nowIso)
        .maybeSingle()
        .then((r) => r),
      VERIFICATION_TIMEOUT_MS
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

    const user = await findUserById(row.user_id);
    if (!user?.email || normalizeEmail(user.email) !== normalizeEmail(row.email)) {
      return { ok: false, error: "Ссылка недействительна" };
    }

    const verifiedAt = new Date().toISOString();
    const update = await withTimeout(
      supabase
        .from("app_users")
        .update({ email_verified_at: verifiedAt, updated_at: verifiedAt })
        .eq("id", row.user_id)
        .then((r) => r),
      VERIFICATION_TIMEOUT_MS
    );

    if (update.error) {
      console.error("[email-verification] mark verified:", update.error);
      return { ok: false, error: "Не удалось подтвердить e-mail" };
    }

    await withTimeout(
      supabase.from("app_email_verification_tokens").delete().eq("user_id", row.user_id).then((r) => r),
      VERIFICATION_TIMEOUT_MS
    );

    return { ok: true };
  } catch (err) {
    console.error("[email-verification] verifyEmailToken:", err);
    return { ok: false, error: "Не удалось подтвердить e-mail" };
  }
}
