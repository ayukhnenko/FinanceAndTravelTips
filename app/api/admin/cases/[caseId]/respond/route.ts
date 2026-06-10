import { NextResponse } from "next/server";
import { notifyCaseAnswered } from "@/lib/cases-mail";
import { getCurrentUser } from "@/lib/get-current-user";
import { respondToCase } from "@/lib/cases-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: { caseId: string };
};

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { response?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const result = await respondToCase({
    caseId: context.params.caseId,
    adminUserId: user.id,
    response: String(body.response ?? ""),
  });

  if (!result.ok) {
    const status = result.error === "Кейс не найден или ещё не отправлен" ? 404 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  await notifyCaseAnswered({ item: result.case });

  return NextResponse.json({ ok: true, case: result.case });
}
