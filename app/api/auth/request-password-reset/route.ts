import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/password-reset";
import { isResendConfigured } from "@/lib/resend-mail";
import { validatePasswordResetEmail } from "@/lib/user-credentials";
import { visitsStoreConfigured } from "@/lib/visits-store";

export const dynamic = "force-dynamic";

const SUCCESS_MESSAGE =
  "Если аккаунт с таким подтверждённым e-mail существует, мы отправили ссылку для смены пароля.";

export async function POST(request: Request) {
  if (!visitsStoreConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase не настроен" }, { status: 503 });
  }

  if (!isResendConfigured()) {
    return NextResponse.json({ ok: false, error: "Resend не настроен" }, { status: 503 });
  }

  let body: { email?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const email = String(body.email ?? "");
  const validationError = validatePasswordResetEmail(email);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  const result = await requestPasswordReset(email);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: SUCCESS_MESSAGE });
}
