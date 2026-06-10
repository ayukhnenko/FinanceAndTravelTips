import { NextResponse } from "next/server";
import { listCasesForAdmin, type CaseStatus } from "@/lib/cases-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status =
    statusParam === "submitted" || statusParam === "answered" || statusParam === "all"
      ? statusParam
      : "all";

  const cases = await listCasesForAdmin(status as CaseStatus | "all");
  return NextResponse.json({ ok: true, cases });
}
