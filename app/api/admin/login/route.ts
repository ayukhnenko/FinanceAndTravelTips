import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "@/lib/auth";

type Body = { password?: string };

function safeNextPath(from: string | null): string {
  if (from && from.startsWith("/") && !from.startsWith("//")) return from;
  return "/admin/settings";
}

function loginRedirect(request: Request, params: Record<string, string>): NextResponse {
  const url = new URL("/admin/login", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

async function attachSessionCookie(res: NextResponse): Promise<NextResponse> {
  const token = await createAdminSessionToken();
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  let provided = "";
  let from: string | null = null;

  if (isJson) {
    let body: Body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    provided = String(body.password ?? "").trim();
  } else {
    const form = await request.formData();
    provided = String(form.get("password") ?? "").trim();
    from = String(form.get("from") ?? "").trim() || null;
  }

  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected) {
    if (!isJson) {
      return loginRedirect(request, {
        error: "ADMIN_PASSWORD не задан на сервере",
        ...(from ? { from } : {}),
      });
    }
    return NextResponse.json(
      { error: "ADMIN_PASSWORD не задан на сервере" },
      { status: 503 }
    );
  }

  if (provided !== expected) {
    if (!isJson) {
      return loginRedirect(request, {
        error: "Неверный пароль",
        ...(from ? { from } : {}),
      });
    }
    return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  }

  const nextPath = safeNextPath(from);

  if (!isJson) {
    const res = NextResponse.redirect(new URL(nextPath, request.url), 303);
    return await attachSessionCookie(res);
  }

  const res = NextResponse.json({ ok: true });
  return await attachSessionCookie(res);
}
