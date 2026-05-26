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

  const result = await authenticateUser(input.identifier, input.password);
  if (!result.ok) {
    if (result.error === "email_not_verified") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "E-mail не подтверждён. Войдите по логину или подтвердите адрес по ссылке из письма.",
        },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "Неверный логин, e-mail или пароль" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true, user: result.user });
  return attachUserSessionCookie(response, result.user.id);
}
