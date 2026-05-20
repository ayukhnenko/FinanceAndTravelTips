import { NextResponse } from "next/server";
import { syncKeyRateFromCbrAndSave } from "@/lib/cbr-key-rate";
import { cronUnauthorizedResponse, isCronAuthorized } from "@/lib/cron-auth";
import { visitsStoreConfigured } from "@/lib/visits-store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

  const result = await syncKeyRateFromCbrAndSave();
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Не удалось получить ставку с сайта ЦБ",
        rate: result.rate,
        date: result.date,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    inserted: result.inserted,
    saved: result.saved,
    rate: result.rate,
    date: result.date,
  });
}
