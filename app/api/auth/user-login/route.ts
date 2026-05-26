import { NextResponse } from "next/server";
import { validateLoginInput } from "@/lib/user-credentials";
import { attachUserSessionCookie } from "@/lib/user-session-cookie";
import { authenticateUser } from "@/lib/users-store";
import { visitsStoreConfigured } from "@/lib/visits-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!visitsStoreConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase не настроен" }, { status: 503 });
  }

  let body: { identifier?: string; password?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const input = {
    identifier: String(body.identifier ?? ""),
    password: String(body.password ?? ""),
  };

  const validationError = validateLoginInput(input);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  const user = await authenticateUser(input.identifier, input.password);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Неверный логин, телефон или пароль" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, user });
  return attachUserSessionCookie(response, user.id);
}
