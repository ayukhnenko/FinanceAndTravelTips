import { cache } from "react";
import {
  insertSettingsRateIfMissing,
  pickNearestCurrentOrPastRateRow,
  readSettingsRows,
  seedDefaultSettingsRows,
} from "@/lib/settings-store";

const FALLBACK_KEY_RATE_PERCENT = 21;

type KeyRateInfo = { rate: number; date: string };

const readKeyRateInfo = cache(async (): Promise<KeyRateInfo> => {
  try {
    await seedDefaultSettingsRows([
      {
        parameter: "key_rate",
        date: new Date().toISOString().slice(0, 10),
        rate: FALLBACK_KEY_RATE_PERCENT,
      },
    ]);
    const rows = await readSettingsRows();
    const fromTable = pickNearestCurrentOrPastRateRow(rows, "key_rate");
    return {
      rate: fromTable?.rate ?? FALLBACK_KEY_RATE_PERCENT,
      date: fromTable?.date ?? new Date().toISOString().slice(0, 10),
    };
  } catch (err) {
    console.error("[settings] readKeyRateInfo:", err);
    return {
      rate: FALLBACK_KEY_RATE_PERCENT,
      date: new Date().toISOString().slice(0, 10),
    };
  }
});

export async function getDefaultKeyRatePercent(): Promise<number> {
  const { rate } = await readKeyRateInfo();
  return rate;
}

export async function getCurrentKeyRateInfo(): Promise<{ rate: number; date: string }> {
  return readKeyRateInfo();
}

function parseRussianDate(text: string): string | null {
  const m = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function parseRateFromHtml(html: string): { rate: number; date: string } | null {
  const tableRowRegex =
    /<tr[^>]*>\s*<td[^>]*>\s*(\d{2}\.\d{2}\.\d{4})\s*<\/td>\s*<td[^>]*>\s*([0-9]+(?:[.,][0-9]+)?)\s*<\/td>/gi;
  const tableRowMatches: RegExpExecArray[] = [];
  let rowMatch: RegExpExecArray | null = tableRowRegex.exec(html);
  while (rowMatch) {
    tableRowMatches.push(rowMatch);
    rowMatch = tableRowRegex.exec(html);
  }
  if (tableRowMatches.length > 0) {
    const parsedRows = tableRowMatches
      .map((m) => {
        const date = parseRussianDate(m[1] ?? "");
        const rate = Number((m[2] ?? "").replace(",", "."));
        if (!date || !Number.isFinite(rate) || rate <= 0 || rate >= 200) return null;
        return { date, rate };
      })
      .filter((row): row is { date: string; rate: number } => row !== null)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (parsedRows.length > 0) {
      return parsedRows[0];
    }
  }

  const cleaned = html.replace(/\s+/g, " ");
  const dateMatch =
    cleaned.match(/(?:с|от)\s*(\d{2}\.\d{2}\.\d{4})/i) ??
    cleaned.match(/действует\s*с\s*(\d{2}\.\d{2}\.\d{4})/i);
  const rateMatch =
    cleaned.match(/ключевая\s+ставка[^0-9]{0,40}(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i) ??
    cleaned.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*годовых/i);
  if (!dateMatch || !rateMatch) return null;
  const date = parseRussianDate(dateMatch[1]);
  const rate = Number(rateMatch[1].replace(",", "."));
  if (!date || !Number.isFinite(rate) || rate <= 0 || rate >= 200) return null;
  return { rate, date };
}

export async function syncKeyRateFromCbr(): Promise<{
  ok: boolean;
  inserted: boolean;
  rate: number | null;
  date: string | null;
  saved: boolean;
}> {
  try {
    const response = await fetch("https://www.cbr.ru/hd_base/keyrate/", {
      cache: "no-store",
      headers: {
        "user-agent": "FinanceAndTravelTips/1.0 (+https://www.fcalc.app)",
      },
    });
    if (!response.ok) {
      return { ok: false, inserted: false, rate: null, date: null, saved: false };
    }
    const html = await response.text();
    const parsed = parseRateFromHtml(html);
    if (!parsed) {
      return { ok: false, inserted: false, rate: null, date: null, saved: false };
    }

    return {
      ok: true,
      inserted: false,
      rate: parsed.rate,
      date: parsed.date,
      saved: false,
    };
  } catch (err) {
    console.error("[settings] syncKeyRateFromCbr:", err);
    return { ok: false, inserted: false, rate: null, date: null, saved: false };
  }
}

export async function syncKeyRateFromCbrAndSave(): Promise<{
  ok: boolean;
  inserted: boolean;
  rate: number | null;
  date: string | null;
  saved: boolean;
}> {
  const synced = await syncKeyRateFromCbr();
  if (!synced.ok || synced.rate == null || synced.date == null) return synced;

  const status = await insertSettingsRateIfMissing({
    parameter: "key_rate",
    date: synced.date,
    rate: synced.rate,
  });
  if (status === "error") {
    return {
      ok: false,
      inserted: false,
      rate: synced.rate,
      date: synced.date,
      saved: false,
    };
  }

  return {
    ok: true,
    inserted: status === "inserted",
    rate: synced.rate,
    date: synced.date,
    saved: true,
  };
}
