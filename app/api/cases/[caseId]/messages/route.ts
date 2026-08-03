import { NextResponse } from "next/server";
import { readGuestCaseToken, getOptionalCurrentUser } from "@/lib/cases-api";
import { notifyAssignedAdminCaseFollowUp } from "@/lib/cases-mail";
import { addUserCaseFollowUp } from "@/lib/cases-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: { caseId: string };
};

export async function POST(request: Request, context: RouteContext) {
  const user = await getOptionalCurrentUser();
  const guestToken = readGuestCaseToken(request);
  const caseId = context.params.caseId;

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const result = await addUserCaseFollowUp({
    caseId,
    userId: user?.id ?? null,
    guestToken,
    body: String(body.message ?? ""),
  });

  if (!result.ok) {
    const status = result.error === "Кейс не найден" ? 404 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  await notifyAssignedAdminCaseFollowUp({
    item: result.case,
    messageBody: result.message.body,
  });

  return NextResponse.json({ ok: true, case: result.case, message: result.message });
}
