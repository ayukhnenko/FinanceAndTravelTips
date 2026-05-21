import { NextResponse } from "next/server";
import { cronUnauthorizedResponse, isCronAuthorized } from "@/lib/cron-auth";
import { syncDepositsFromConfiguredSheet } from "@/lib/deposits-sheet-sync";
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

  const result = await syncDepositsFromConfiguredSheet({ triggerSource: "cron" });
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
  });
}
