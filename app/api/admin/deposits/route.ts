import { NextResponse } from "next/server";
import { countDepositOffers } from "@/lib/deposit-offers-store";
import {
  extractGoogleSpreadsheetId,
  syncDepositsFromConfiguredSheet,
} from "@/lib/deposits-sheet-sync";
import {
  DEPOSITS_INCLUSION_THRESHOLD_PARAM,
  DEPOSITS_LAST_SYNCED_AT_PARAM,
  DEPOSITS_SHEET_CHANGED_AT_PARAM,
  readDepositsSheetUrl,
  readSettingsParam,
} from "@/lib/settings-params-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function buildDepositsAdminPayload() {
  const sheetUrl = await readDepositsSheetUrl();
  const [lastSyncedAt, sheetChangedAt, inclusionThreshold, offerCount] =
    await Promise.all([
      readSettingsParam(DEPOSITS_LAST_SYNCED_AT_PARAM),
      readSettingsParam(DEPOSITS_SHEET_CHANGED_AT_PARAM),
      readSettingsParam(DEPOSITS_INCLUSION_THRESHOLD_PARAM),
      countDepositOffers(sheetUrl),
    ]);

  return {
    sheetUrl,
    spreadsheetId: extractGoogleSpreadsheetId(sheetUrl),
    lastSyncedAt,
    sheetChangedAt,
    inclusionThreshold,
    offerCount,
  };
}

export async function GET() {
  return NextResponse.json(await buildDepositsAdminPayload(), {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}

export async function POST() {
  const result = await syncDepositsFromConfiguredSheet({ triggerSource: "admin" });
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error ?? "Не удалось загрузить таблицу",
        durationMs: result.durationMs,
        timings: result.timings,
        meta: result.meta,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    inserted: result.inserted,
    durationMs: result.durationMs,
    timings: result.timings,
    meta: result.meta,
    ...(await buildDepositsAdminPayload()),
  });
}
