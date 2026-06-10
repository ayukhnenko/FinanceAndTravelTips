import { NextResponse } from "next/server";
import { listGuestCasesByAccess } from "@/lib/cases-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { access?: Array<{ id?: string; token?: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const accessList = (body.access ?? [])
    .map((entry) => ({
      id: String(entry.id ?? "").trim(),
      token: String(entry.token ?? "").trim(),
    }))
    .filter((entry) => entry.id && entry.token);

  const cases = await listGuestCasesByAccess(accessList);
  return NextResponse.json({ ok: true, cases });
}
