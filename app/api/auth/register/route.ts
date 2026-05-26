import { NextResponse } from "next/server";
import { validateRegisterInput } from "@/lib/user-credentials";
import { sendUserEmailVerification } from "@/lib/email-verification";
import { isResendConfigured } from "@/lib/resend-mail";
import { attachUserSessionCookie } from "@/lib/user-session-cookie";
import { createUser } from "@/lib/users-store";
import { visitsStoreConfigured } from "@/lib/visits-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!visitsStoreConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase не настроен" }, { status: 503 });
  }

  let body: {
    login?: string;
    password?: string;
    phone?: string;
    email?: string;
    name?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const input = {
    login: String(body.login ?? ""),
    password: String(body.password ?? ""),
    phone: String(body.phone ?? ""),
    email: body.email != null ? String(body.email) : undefined,
    name: body.name != null ? String(body.name) : undefined,
  };

  const validationError = validateRegisterInput(input);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  const result = await createUser(input);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, user: result.user });
  const sessionResponse = attachUserSessionCookie(response, result.user.id);

  if (result.user.email && isResendConfigured()) {
    const emailResult = await sendUserEmailVerification(result.user.id);
    if (!emailResult.ok) {
      console.error("[register] send verification email:", emailResult.error);
    }
  }

  return sessionResponse;
}
