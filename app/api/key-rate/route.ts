import { NextResponse } from "next/server";
import {
  getCurrentKeyRateInfo,
  syncKeyRateFromCbr,
  syncKeyRateFromCbrAndSave,
} from "@/lib/cbr-key-rate";
import { visitsStoreConfigured } from "@/lib/visits-store";

export async function GET() {
  const { rate, date } = await getCurrentKeyRateInfo();
  return NextResponse.json({ rate, date });
}

export async function POST(request: Request) {
  let saveToDb = false;
  try {
    const body = (await request.json()) as { saveToDb?: unknown };
    saveToDb =
      body.saveToDb === true ||
      body.saveToDb === 1 ||
      body.saveToDb === "1" ||
      body.saveToDb === "true";
  } catch {
    saveToDb = false;
  }

  if (saveToDb && !visitsStoreConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase не настроен" },
      { status: 503 }
    );
  }

  const result = saveToDb
    ? await syncKeyRateFromCbrAndSave({ triggerSource: "admin" })
    : await syncKeyRateFromCbr();
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
