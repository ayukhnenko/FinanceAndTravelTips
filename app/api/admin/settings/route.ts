import { NextResponse } from "next/server";
import { normalizeSettingsRows, readSettingsRows, writeSettingsRows } from "@/lib/settings-store";
import { getDailyVisits } from "@/lib/visits-store";

export async function GET() {
  const rows = await readSettingsRows();
  const visits = await getDailyVisits();
  return NextResponse.json({ rows, visits: visits ?? [] });
}

export async function PUT(request: Request) {
  let body: { rows?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const normalized = normalizeSettingsRows(body.rows);
  const ok = await writeSettingsRows(normalized);
  if (!ok) {
    return NextResponse.json(
      { error: "Не удалось сохранить настройки в БД" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, rows: normalized });
}
