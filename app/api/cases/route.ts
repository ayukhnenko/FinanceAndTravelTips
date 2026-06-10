import { NextResponse } from "next/server";
import { getOptionalCurrentUser } from "@/lib/cases-api";
import {
  createCaseForGuest,
  createCaseForUser,
  listCasesForUser,
} from "@/lib/cases-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOptionalCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: true, cases: [], isGuest: true });
  }

  const cases = await listCasesForUser(user.id);
  return NextResponse.json({ ok: true, cases, isGuest: false });
}

export async function POST(request: Request) {
  const user = await getOptionalCurrentUser();

  let body: { title?: string; body?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const title = String(body.title ?? "");
  const text = String(body.body ?? "");
  const email = body.email == null ? null : String(body.email);

  if (user) {
    const result = await createCaseForUser({
      userId: user.id,
      title,
      body: text,
      email,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, case: result.case });
  }

  if (!email?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Укажите e-mail, чтобы получить ответ" },
      { status: 400 }
    );
  }

  const result = await createCaseForGuest({ email, title, body: text });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    case: result.case,
    accessToken: result.accessToken,
  });
}
