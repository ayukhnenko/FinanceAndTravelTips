import { NextResponse } from "next/server";
import { cronUnauthorizedResponse, isCronAuthorized } from "@/lib/cron-auth";
import { syncDepositsFromConfiguredSheet } from "@/lib/deposits-sheet-sync";
import { syncDepositsFromTopbanki } from "@/lib/deposits-topbanki-sync";
import { visitsStoreConfigured } from "@/lib/visits-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return cronUnauthorizedResponse();
  }

  if (!visitsStoreConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase не настроен" },
      { status: 503 }
    );
  }

  const startedAt = Date.now();
  const [sheetResult, topbankiResult] = await Promise.all([
    syncDepositsFromConfiguredSheet({ triggerSource: "cron" }),
    syncDepositsFromTopbanki({ triggerSource: "cron" }),
  ]);

  const ok = sheetResult.ok && topbankiResult.ok;
  const body = {
    ok,
    durationMs: Date.now() - startedAt,
    sheet: {
      ok: sheetResult.ok,
      inserted: sheetResult.inserted,
      durationMs: sheetResult.durationMs,
      timings: sheetResult.timings,
      meta: sheetResult.meta,
      error: sheetResult.error,
    },
    topbanki: {
      ok: topbankiResult.ok,
      inserted: topbankiResult.inserted,
      durationMs: topbankiResult.durationMs,
      timings: topbankiResult.timings,
      meta: topbankiResult.meta,
      error: topbankiResult.error,
    },
  };

  if (!ok) {
    const errors = [
      !sheetResult.ok ? sheetResult.error ?? "Google Sheets" : null,
      !topbankiResult.ok ? topbankiResult.error ?? "Topbanki" : null,
    ].filter(Boolean);

    return NextResponse.json(
      {
        ...body,
        error: errors.join("; "),
      },
      { status: 502 }
    );
  }

  return NextResponse.json(body);
}
