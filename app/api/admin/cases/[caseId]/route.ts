import { NextResponse } from "next/server";
import {
  canAdminRespondToCase,
  getCaseById,
  listCaseMessages,
} from "@/lib/cases-store";
import { getCurrentUser } from "@/lib/get-current-user";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: { caseId: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const item = await getCaseById(context.params.caseId);
  if (!item || item.status === "draft") {
    return NextResponse.json({ ok: false, error: "Кейс не найден" }, { status: 404 });
  }

  const messages = await listCaseMessages(item);
  const canRespond = canAdminRespondToCase(item, user.id);

  return NextResponse.json({ ok: true, case: item, messages, canRespond });
}
