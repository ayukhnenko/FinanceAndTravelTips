import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";

type Entry = "voice" | "bypass";

export async function POST(request: Request) {
  let body: { entry?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const entry = body.entry as Entry | undefined;
  if (entry !== "voice" && entry !== "bypass") {
    return NextResponse.json(
      { error: "Укажите способ входа" },
      { status: 400 }
    );
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  const isProd = process.env.NODE_ENV === "production";

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
