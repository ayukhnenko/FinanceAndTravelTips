import { NextResponse } from "next/server";
import { getAdminDepositsCronSettings } from "@/lib/cron-deposits-sync";
import { getAdminCronSettings } from "@/lib/cron-key-rate-sync";
import {
  readEditableAppSettings,
  writeEditableAppSettings,
} from "@/lib/settings-params-store";
import { normalizeSettingsRows, readSettingsRows, writeSettingsRows } from "@/lib/settings-store";
import { getDailyVisits } from "@/lib/visits-store";
import { readSyncLogs } from "@/lib/sync-logs-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const [rows, visits, appParams, syncLogs] = await Promise.all([
    readSettingsRows(),
    getDailyVisits(),
    readEditableAppSettings(),
    readSyncLogs({ limit: 50 }),
  ]);
  return NextResponse.json(
    {
      rows,
      visits: visits ?? [],
      cron: getAdminCronSettings(),
      depositsCron: getAdminDepositsCronSettings(),
      appParams,
      syncLogs,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  );
}

export async function PUT(request: Request) {
  let body: { rows?: unknown; params?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (body.params && typeof body.params === "object") {
    const result = await writeEditableAppSettings(body.params);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const appParams = await readEditableAppSettings();
    return NextResponse.json({ ok: true, appParams });
  }

  if (body.rows !== undefined) {
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

  return NextResponse.json({ error: "Нет данных для сохранения" }, { status: 400 });
}
