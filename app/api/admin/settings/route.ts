import { NextResponse } from "next/server";
import { normalizeSettingsRows, readSettingsRows, writeSettingsRows } from "@/lib/settings-store";

export async function GET() {
  const rows = await readSettingsRows();
  return NextResponse.json({ rows });
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
