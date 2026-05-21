import { NextResponse } from "next/server";
import { countDepositOffers } from "@/lib/deposit-offers-store";
import {
  extractGoogleSpreadsheetId,
  syncDepositsFromConfiguredSheet,
} from "@/lib/deposits-sheet-sync";
import {
  syncDepositsFromTopbanki,
} from "@/lib/deposits-topbanki-sync";
import { TOPBANKI_DEPOSITS_SOURCE_KEY } from "@/lib/deposits-topbanki-config";
import {
  DEPOSITS_INCLUSION_THRESHOLD_PARAM,
  DEPOSITS_LAST_SYNCED_AT_PARAM,
  DEPOSITS_SHEET_CHANGED_AT_PARAM,
  DEPOSITS_TOPBANKI_LAST_SYNCED_AT_PARAM,
  readDepositsSheetUrl,
  readDepositsTopbankiUrl,
  readSettingsParam,
} from "@/lib/settings-params-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function buildDepositsAdminPayload() {
  const sheetUrl = await readDepositsSheetUrl();
  const topbankiUrl = await readDepositsTopbankiUrl();
  const [
    lastSyncedAt,
    topbankiLastSyncedAt,
    sheetChangedAt,
    inclusionThreshold,
    offerCount,
    topbankiOfferCount,
  ] = await Promise.all([
    readSettingsParam(DEPOSITS_LAST_SYNCED_AT_PARAM),
    readSettingsParam(DEPOSITS_TOPBANKI_LAST_SYNCED_AT_PARAM),
    readSettingsParam(DEPOSITS_SHEET_CHANGED_AT_PARAM),
    readSettingsParam(DEPOSITS_INCLUSION_THRESHOLD_PARAM),
    countDepositOffers(sheetUrl),
    countDepositOffers(TOPBANKI_DEPOSITS_SOURCE_KEY),
  ]);

  return {
    sheetUrl,
    topbankiUrl,
    spreadsheetId: extractGoogleSpreadsheetId(sheetUrl),
    lastSyncedAt,
    topbankiLastSyncedAt,
    sheetChangedAt,
    inclusionThreshold,
    offerCount,
    topbankiOfferCount,
  };
}

export async function GET() {
  return NextResponse.json(await buildDepositsAdminPayload(), {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}

export async function POST(request: Request) {
  let source = "sheet";
  try {
    const body = (await request.json()) as { source?: string };
    if (body.source === "topbanki" || body.source === "sheet") {
      source = body.source;
    }
  } catch {
    // default: Google Sheets
  }

  if (source === "topbanki") {
    const result = await syncDepositsFromTopbanki({ triggerSource: "admin" });
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          source,
          error: result.error ?? "Не удалось загрузить Topbanki",
          durationMs: result.durationMs,
          timings: result.timings,
          meta: result.meta,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      source,
      inserted: result.inserted,
      durationMs: result.durationMs,
      timings: result.timings,
      meta: result.meta,
      ...(await buildDepositsAdminPayload()),
    });
  }

  const result = await syncDepositsFromConfiguredSheet({ triggerSource: "admin" });
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        source,
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
    source,
    inserted: result.inserted,
    durationMs: result.durationMs,
    timings: result.timings,
    meta: result.meta,
    ...(await buildDepositsAdminPayload()),
  });
}
