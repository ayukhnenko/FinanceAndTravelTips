import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/password-reset";
import { visitsStoreConfigured } from "@/lib/visits-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!visitsStoreConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase не настроен" }, { status: 503 });
  }

  let body: { token?: string; password?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const token = String(body.token ?? "");
  const password = String(body.password ?? "");

  if (!token) {
    return NextResponse.json({ ok: false, error: "Ссылка недействительна" }, { status: 400 });
  }

  const result = await resetPasswordWithToken(token, password);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
