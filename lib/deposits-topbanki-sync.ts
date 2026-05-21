import { computeTopbankiAnnualEquivalentPercent } from "@/lib/deposit-topbanki-rate-equiv";
import { replaceDepositOffers, type DepositOfferRow } from "@/lib/deposit-offers-store";
import {
  DEPOSITS_TOPBANKI_LAST_SYNCED_AT_PARAM,
  readDepositsTopbankiUrl,
  writeSettingsParam,
} from "@/lib/settings-params-store";
import { appendSyncLog } from "@/lib/sync-logs-store";

import { TOPBANKI_DEPOSITS_SOURCE_KEY, DEFAULT_TOPBANKI_DEPOSITS_URL } from "@/lib/deposits-topbanki-config";
import { formatTopbankiComparisonSumText } from "@/lib/deposits-topbanki-sum";
export type TopbankiDepositsMeta = {
  updatedAt: string | null;
  totalListed: number | null;
  bankCount: number | null;
  comparisonSumText: string | null;
  section: "max-rates";
  pagesFetched: number;
};

export type TopbankiDepositsSyncTimings = {
  totalMs: number;
  fetchMs: number;
  parseMs: number;
  saveDbMs: number;
  settingsMs: number;
};

export type TopbankiDepositsSyncResult = {
  ok: boolean;
  inserted: number;
  meta: TopbankiDepositsMeta;
  durationMs: number;
  timings: TopbankiDepositsSyncTimings;
  error?: string;
};

function decodeHtml(text: string): string {
  return text
    .replace(/&#8381;/g, "₽")
    .replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, "·")
    .replace(/&mdash;/g, "—")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(text: string): string {
  return decodeHtml(text.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function parsePercent(value: string): number | null {
  const text = value.replace(",", ".").trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > 200) return null;
  return n;
}

export function parseTopbankiTermDays(text: string): number | null {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const daysMatch = normalized.match(/(\d+)\s*(?:дн|день|дня|дней)/);
  if (daysMatch) return Number(daysMatch[1]);

  const monthsMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*мес/);
  if (monthsMatch) {
    const months = Number(monthsMatch[1].replace(",", "."));
    if (Number.isFinite(months)) return Math.round(months * (365 / 12));
  }

  const yearsMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:год|года|лет)/);
  if (yearsMatch) {
    const years = Number(yearsMatch[1].replace(",", "."));
    if (Number.isFinite(years)) return Math.round(years * 365);
  }

  return null;
}

function parseMinAmountThousands(text: string): string {
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return "";
  const rubles = Number(digits);
  if (!Number.isFinite(rubles) || rubles <= 0) return "";
  const thousands = rubles / 1000;
  if (Number.isInteger(thousands)) return String(thousands);
  return thousands.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

function parseTopbankiUpdatedAt(html: string): string | null {
  const match = html.match(/Данные обновлены\s*<b>([^<]+)<\/b>/i);
  return match?.[1]?.trim() ?? null;
}

function parseTopbankiRegion(html: string): string {
  const h1Match = html.match(/<h1>\s*Вклады в\s+([^<]+)/i);
  return h1Match?.[1]?.trim() ?? "";
}

function isEmptyRateCell(value: string): boolean {
  const text = value.trim();
  return !text || text === "–" || text === "-" || text === "—";
}

function parseTopbankiMaxRatesTable(
  html: string,
  region: string,
  listUrl: string
): DepositOfferRow[] {
  const tableMatch = html.match(/<table class="w100p ruler total mb0">([\s\S]*?)<\/table>/);
  if (!tableMatch) return [];

  const tableHtml = tableMatch[1];
  const headerMatch = tableHtml.match(/<thead>[\s\S]*?<tr>([\s\S]*?)<\/tr>/);
  const termColumns: { label: string; termDays: number }[] = [];

  if (headerMatch) {
    const headerRegex = /data-order="(\d+)">([\s\S]*?)<\/a>/g;
    let headerCell: RegExpExecArray | null;
    while ((headerCell = headerRegex.exec(headerMatch[1])) !== null) {
      const termDays = Number(headerCell[1]);
      const label = stripTags(headerCell[2]);
      if (Number.isFinite(termDays) && termDays > 0 && label) {
        termColumns.push({ label, termDays });
      }
    }
  }

  if (termColumns.length === 0) return [];

  const { text: comparisonSumText } = formatTopbankiComparisonSumText(html, listUrl);

  const bodyHtml = tableHtml.split("</thead>")[1] ?? "";
  const rowChunks = bodyHtml.split("<tr>").slice(1);
  const offers: DepositOfferRow[] = [];

  for (const row of rowChunks) {
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }

    if (cells.length < 4) continue;

    const bankName = cells[0]?.trim();
    if (!bankName) continue;

    const assetsRank = cells[1]?.trim() ?? "";
    const minAmountThousands = parseMinAmountThousands(cells[2] ?? "");

    for (let index = 0; index < termColumns.length; index += 1) {
      const rateText = cells[3 + index] ?? "";
      if (isEmptyRateCell(rateText)) continue;

      const nominalRatePercent = parsePercent(rateText);
      const { termDays, label } = termColumns[index];
      if (nominalRatePercent == null || termDays <= 0) continue;

      const conditions = `Topbanki · таблица макс. ставок${comparisonSumText ? ` · ${comparisonSumText}` : ""} · ${label}`;
      const rateAnnualEquivPercent = computeTopbankiAnnualEquivalentPercent(
        nominalRatePercent,
        termDays,
        conditions
      );

      offers.push({
        sortOrder: 0,
        beacon: "Topbanki",
        nominalRatePercent,
        rateMonthlyEquivPercent: null,
        rateEndEquivPercent: null,
        rateAnnualEquivPercent,
        interestPaymentType: "макс. ставка по сроку",
        interestPaymentTiming: "",
        termYears: Math.round((termDays / 365) * 10000) / 10000,
        termDays,
        bankName,
        region,
        assetsRank,
        rating: "",
        productName: `Макс. ставка · ${label}`,
        minAmountThousands,
        replenishment: "",
        withdrawal: "",
        conditions,
        maxAmountText: "",
        productUrl: "",
        rawRow: [],
      });
    }
  }

  return offers;
}

export function parseTopbankiDepositsHtml(
  html: string,
  listUrl = DEFAULT_TOPBANKI_DEPOSITS_URL
): {
  offers: DepositOfferRow[];
  meta: TopbankiDepositsMeta;
} {
  const region = parseTopbankiRegion(html);
  const offers = parseTopbankiMaxRatesTable(html, region, listUrl);
  const bankCount = new Set(offers.map((offer) => offer.bankName)).size;

  const { text: comparisonSumText } = formatTopbankiComparisonSumText(html, listUrl);

  const meta: TopbankiDepositsMeta = {
    updatedAt: parseTopbankiUpdatedAt(html),
    totalListed: offers.length,
    bankCount,
    comparisonSumText: comparisonSumText || null,
    section: "max-rates",
    pagesFetched: 1,
  };

  offers.sort((left, right) => {
    const leftRate = left.rateAnnualEquivPercent ?? left.nominalRatePercent ?? -1;
    const rightRate = right.rateAnnualEquivPercent ?? right.nominalRatePercent ?? -1;
    if (rightRate !== leftRate) return rightRate - leftRate;
    return left.bankName.localeCompare(right.bankName, "ru");
  });

  offers.forEach((offer, index) => {
    offer.sortOrder = index + 1;
  });

  return { offers, meta };
}

export async function fetchTopbankiDepositsHtml(listUrl: string): Promise<string> {
  const response = await fetch(listUrl, {
    cache: "no-store",
    headers: {
      "user-agent": "FinanceAndTravelTips/1.0 (+https://www.fcalc.app)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Topbanki вернул HTTP ${response.status}`);
  }

  return response.text();
}

export async function syncDepositsFromTopbanki(options?: {
  triggerSource?: string;
  listUrl?: string;
}): Promise<TopbankiDepositsSyncResult> {
  const startedAt = Date.now();
  const timings: TopbankiDepositsSyncTimings = {
    totalMs: 0,
    fetchMs: 0,
    parseMs: 0,
    saveDbMs: 0,
    settingsMs: 0,
  };

  const finish = (
    result: Omit<TopbankiDepositsSyncResult, "durationMs" | "timings">
  ): TopbankiDepositsSyncResult => {
    timings.totalMs = Date.now() - startedAt;
    return { ...result, durationMs: timings.totalMs, timings };
  };

  const buildLogDetails = (
    meta: TopbankiDepositsMeta = {
      updatedAt: null,
      totalListed: null,
      bankCount: null,
      comparisonSumText: null,
      section: "max-rates",
      pagesFetched: 0,
    }
  ) => ({
    ...meta,
    durationMs: Date.now() - startedAt,
    timings: { ...timings, totalMs: Date.now() - startedAt },
  });

  const listUrl = options?.listUrl?.trim() || (await readDepositsTopbankiUrl());
  const triggerSource = options?.triggerSource?.trim() || "admin";
  const dataSource = TOPBANKI_DEPOSITS_SOURCE_KEY;

  try {
    const fetchStartedAt = Date.now();
    const html = await fetchTopbankiDepositsHtml(listUrl);
    timings.fetchMs = Date.now() - fetchStartedAt;

    const parseStartedAt = Date.now();
    const { offers, meta } = parseTopbankiDepositsHtml(html, listUrl);
    timings.parseMs = Date.now() - parseStartedAt;

    if (offers.length === 0) {
      const error =
        "В разделе Topbanki «Максимальные проценты по вкладам» не найдено строк для загрузки";
      await appendSyncLog({
        syncKind: "deposits",
        status: "error",
        source: listUrl,
        triggerSource,
        errorMessage: error,
        details: buildLogDetails(meta),
      });
      return finish({ ok: false, inserted: 0, meta, error });
    }

    const saveStartedAt = Date.now();
    const saved = await replaceDepositOffers(offers, dataSource);
    timings.saveDbMs = Date.now() - saveStartedAt;

    if (!saved) {
      const error = "Не удалось сохранить предложения Topbanki в БД";
      await appendSyncLog({
        syncKind: "deposits",
        status: "error",
        source: listUrl,
        triggerSource,
        errorMessage: error,
        details: buildLogDetails(meta),
      });
      return finish({ ok: false, inserted: 0, meta, error });
    }

    const settingsStartedAt = Date.now();
    await writeSettingsParam(DEPOSITS_TOPBANKI_LAST_SYNCED_AT_PARAM, new Date().toISOString());
    timings.settingsMs = Date.now() - settingsStartedAt;

    await appendSyncLog({
      syncKind: "deposits",
      status: "success",
      source: listUrl,
      triggerSource,
      insertedCount: offers.length,
      details: buildLogDetails(meta),
    });

    return finish({ ok: true, inserted: offers.length, meta });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Неизвестная ошибка";
    await appendSyncLog({
      syncKind: "deposits",
      status: "error",
      source: listUrl,
      triggerSource,
      errorMessage: message,
      details: buildLogDetails(),
    });
    return finish({
      ok: false,
      inserted: 0,
      meta: { updatedAt: null, totalListed: null, bankCount: null, comparisonSumText: null, section: "max-rates", pagesFetched: 0 },
      error: message,
    });
  }
}
