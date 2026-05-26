import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { sendUserEmailVerification } from "@/lib/email-verification";
import { isResendConfigured } from "@/lib/resend-mail";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isResendConfigured()) {
    return NextResponse.json({ ok: false, error: "Resend не настроен" }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const result = await sendUserEmailVerification(user.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
