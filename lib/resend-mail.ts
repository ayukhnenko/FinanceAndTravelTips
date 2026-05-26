import { Resend } from "resend";

let cachedClient: Resend | null = null;

function trimEnv(v: string | undefined): string | undefined {
  if (v == null) return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

export function isResendConfigured(): boolean {
  return Boolean(trimEnv(process.env.RESEND_API_KEY) && trimEnv(process.env.RESEND_FROM));
}

function getResendClient(): Resend | null {
  const apiKey = trimEnv(process.env.RESEND_API_KEY);
  if (!apiKey) return null;
  if (!cachedClient) cachedClient = new Resend(apiKey);
  return cachedClient;
}

export function getResendFromAddress(): string | null {
  return trimEnv(process.env.RESEND_FROM) ?? null;
}

export type SendVerificationEmailInput = {
  to: string;
  login: string;
  verifyUrl: string;
};

export async function sendVerificationEmail(
  input: SendVerificationEmailInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getResendClient();
  const from = getResendFromAddress();
  if (!client || !from) {
    return { ok: false, error: "Resend не настроен" };
  }

  const subject = "Подтверждение e-mail — Калькуляторы для жизни";
  const html = `
    <p>Здравствуйте${input.login ? `, ${escapeHtml(input.login)}` : ""}!</p>
    <p>Чтобы подтвердить адрес e-mail в личном кабинете, перейдите по ссылке:</p>
    <p><a href="${escapeHtml(input.verifyUrl)}">Подтвердить e-mail</a></p>
    <p>Если вы не регистрировались у нас, просто проигнорируйте это письмо.</p>
    <p style="color:#666;font-size:12px;">Ссылка действует 24 часа.</p>
  `.trim();

  const text = [
    "Здравствуйте!",
    "",
    "Чтобы подтвердить адрес e-mail в личном кабинете, перейдите по ссылке:",
    input.verifyUrl,
    "",
    "Если вы не регистрировались у нас, просто проигнорируйте это письмо.",
    "Ссылка действует 24 часа.",
  ].join("\n");

  const { error } = await client.emails.send({
    from,
    to: input.to,
    subject,
    html,
    text,
  });

  if (error) {
    console.error("[resend-mail] sendVerificationEmail:", error);
    return { ok: false, error: "Не удалось отправить письмо" };
  }

  return { ok: true };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
