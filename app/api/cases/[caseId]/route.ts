import { NextResponse } from "next/server";
import { readGuestCaseToken, getOptionalCurrentUser } from "@/lib/cases-api";
import {
  getCaseById,
  updateCaseDraft,
  verifyGuestCaseAccess,
} from "@/lib/cases-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: { caseId: string };
};

export async function GET(request: Request, context: RouteContext) {
  const user = await getOptionalCurrentUser();
  const caseId = context.params.caseId;

  if (user) {
    const item = await getCaseById(caseId);
    if (!item || item.userId !== user.id) {
      return NextResponse.json({ ok: false, error: "Кейс не найден" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, case: item });
  }

  const guestToken = readGuestCaseToken(request);
  if (!guestToken) {
    return NextResponse.json({ ok: false, error: "Кейс не найден" }, { status: 404 });
  }

  const item = await verifyGuestCaseAccess(caseId, guestToken);
  if (!item) {
    return NextResponse.json({ ok: false, error: "Кейс не найден" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, case: item });
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await getOptionalCurrentUser();
  const guestToken = readGuestCaseToken(request);
  const caseId = context.params.caseId;

  let body: { title?: string; body?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const result = await updateCaseDraft({
    caseId,
    userId: user?.id ?? null,
    guestToken,
    title: String(body.title ?? ""),
    body: String(body.body ?? ""),
    email: body.email == null ? null : String(body.email),
  });

  if (!result.ok) {
    const status = result.error === "Кейс не найден" ? 404 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, case: result.case });
}
