import { NextResponse } from "next/server";
import { readGuestCaseToken, getOptionalCurrentUser } from "@/lib/cases-api";
import { notifyCaseSubmitted } from "@/lib/cases-mail";
import { submitCaseForAnalysis } from "@/lib/cases-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: { caseId: string };
};

export async function POST(request: Request, context: RouteContext) {
  const user = await getOptionalCurrentUser();
  const guestToken = readGuestCaseToken(request);
  const caseId = context.params.caseId;

  let body: { email?: string } = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const result = await submitCaseForAnalysis({
    caseId,
    userId: user?.id ?? null,
    guestToken,
    email: body.email == null ? null : String(body.email),
  });

  if (!result.ok) {
    const status = result.error === "Кейс не найден" ? 404 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  await notifyCaseSubmitted({
    item: result.case,
    isGuest: !user,
    guestToken,
  });

  return NextResponse.json({ ok: true, case: result.case });
}
