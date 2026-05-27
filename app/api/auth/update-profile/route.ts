import { NextResponse } from "next/server";
import { sendUserEmailVerification } from "@/lib/email-verification";
import { getCurrentUser } from "@/lib/get-current-user";
import { isResendConfigured } from "@/lib/resend-mail";
import { validateUpdateProfileInput } from "@/lib/user-credentials";
import { updateUserProfile } from "@/lib/users-store";
import { visitsStoreConfigured } from "@/lib/visits-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!visitsStoreConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase не настроен" }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { name?: string; phone?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const input = {
    name: String(body.name ?? ""),
    phone: body.phone?.trim() ? String(body.phone) : undefined,
    email: body.email?.trim() ? String(body.email) : undefined,
  };

  const validationError = validateUpdateProfileInput(input);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  const result = await updateUserProfile(user.id, input);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  let verificationSent = false;
  if (result.emailChanged && result.user.email && isResendConfigured()) {
    const emailResult = await sendUserEmailVerification(result.user.id);
    verificationSent = emailResult.ok;
    if (!emailResult.ok) {
      console.error("[update-profile] send verification email:", emailResult.error);
    }
  }

  return NextResponse.json({
    ok: true,
    user: result.user,
    emailChanged: result.emailChanged,
    verificationSent,
  });
}
