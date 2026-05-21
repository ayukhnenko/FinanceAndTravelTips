import {
  DEPOSITS_INCLUSION_THRESHOLD_PARAM,
  DEPOSITS_LAST_SYNCED_AT_PARAM,
  DEPOSITS_SHEET_CHANGED_AT_PARAM,
  readDepositsSheetUrl,
  writeSettingsParam,
} from "@/lib/settings-params-store";
import { replaceDepositOffers, type DepositOfferRow } from "@/lib/deposit-offers-store";
import { appendSyncLog } from "@/lib/sync-logs-store";

export type DepositsSheetMeta = {
  changedAt: string | null;
  inclusionThreshold: string | null;
};

export type DepositsSyncTimings = {
  totalMs: number;
  fetchSheetMs: number;
  parseMs: number;
  saveDbMs: number;
  settingsMs: number;
};

export type DepositsSyncResult = {
  ok: boolean;
  inserted: number;
  meta: DepositsSheetMeta;
  durationMs: number;
  timings: DepositsSyncTimings;
  error?: string;
};

export function extractGoogleSpreadsheetId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

export function buildGoogleSheetCsvExportUrl(spreadsheetId: string, gid?: string): string {
  const params = new URLSearchParams({ format: "csv" });
  if (gid?.trim()) params.set("gid", gid.trim());
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?${params.toString()}`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function cleanCell(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function parsePercent(value: string): number | null {
  const text = cleanCell(value).replace("%", "").replace(",", ".");
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > 200) return null;
  return n;
}

function parseOptionalNumber(value: string): number | null {
  const text = cleanCell(value).replace(",", ".");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalInt(value: string): number | null {
  const n = parseOptionalNumber(value);
  if (n == null) return null;
  return Math.round(n);
}

export function parseMaxAmountFromComment(comment: string): string {
  const text = cleanCell(comment).replace(/\[\/?U\]/gi, "");
  if (!text) return "";

  const patterns = [
    /Макс\.?\s*сумма\s*[-–—:\s]+([^.;]+)/i,
    /Сумма вклада до\s+([^.;]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanCell(match[1]);
  }

  return "";
}

const SECTION_END_RATING_MARKERS = [
  "Вне зачёта",
  "Вклады на Финуслугах для новичков",
] as const;

function isOfferRow(cells: string[]): boolean {
  const bank = cleanCell(cells[12]);
  return parsePercent(cells[1]) != null && bank.length > 0;
}

function isChangelogRow(cells: string[]): boolean {
  const text = cleanCell(cells[1]);
  return /^\d{2}\.\d{2}\.\d{4}\s*:/.test(text);
}

function isSectionEndRow(cells: string[]): boolean {
  const rating = cleanCell(cells[15]);
  return SECTION_END_RATING_MARKERS.some((marker) => rating.includes(marker));
}

export function parseDepositsSheetCsv(csvText: string): {
  offers: DepositOfferRow[];
  meta: DepositsSheetMeta;
} {
  const rows = parseCsv(csvText);
  const meta: DepositsSheetMeta = {
    changedAt: null,
    inclusionThreshold: null,
  };

  if (rows[0]) {
    const headerRow = rows[0];
    const changedAtCandidate = cleanCell(headerRow[5]);
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(changedAtCandidate)) {
      meta.changedAt = changedAtCandidate;
    }
    const thresholdCandidate = cleanCell(headerRow[17]);
    if (thresholdCandidate.includes("%")) {
      meta.inclusionThreshold = thresholdCandidate;
    }
  }

  const offers: DepositOfferRow[] = [];
  let sortOrder = 0;

  for (const cells of rows) {
    if (isChangelogRow(cells)) break;
    if (isSectionEndRow(cells)) break;
    if (!isOfferRow(cells)) continue;

    const nominalRatePercent = parsePercent(cells[1])!;
    const conditions = cleanCell(cells[21]);
    sortOrder += 1;
    offers.push({
      sortOrder,
      beacon: cleanCell(cells[0]),
      nominalRatePercent,
      rateMonthlyEquivPercent: parsePercent(cells[2]),
      rateEndEquivPercent: parsePercent(cells[4]),
      rateAnnualEquivPercent: parsePercent(cells[3]),
      interestPaymentType: cleanCell(cells[5]),
      interestPaymentTiming: cleanCell(cells[6]),
      termYears: parseOptionalNumber(cells[8]),
      termDays: parseOptionalInt(cells[9]),
      bankName: cleanCell(cells[12]),
      region: cleanCell(cells[13]),
      assetsRank: cleanCell(cells[14]),
      rating: cleanCell(cells[15]),
      productName: cleanCell(cells[16]),
      minAmountThousands: cleanCell(cells[17]),
      replenishment: cleanCell(cells[18]),
      withdrawal: cleanCell(cells[19]),
      conditions,
      maxAmountText: parseMaxAmountFromComment(conditions),
      productUrl: cleanCell(cells[22]),
      rawRow: [],
    });
  }

  return { offers, meta };
}

export async function fetchDepositsSheetCsv(sheetUrl: string): Promise<string> {
  const spreadsheetId = extractGoogleSpreadsheetId(sheetUrl);
  if (!spreadsheetId) {
    throw new Error("Не удалось определить ID Google-таблицы из URL");
  }

  const exportUrl = buildGoogleSheetCsvExportUrl(spreadsheetId);
  const response = await fetch(exportUrl, {
    cache: "no-store",
    headers: {
      "user-agent": "FinanceAndTravelTips/1.0 (+https://www.fcalc.app)",
    },
  });

  if (!response.ok) {
    throw new Error(`Google Sheets вернул HTTP ${response.status}`);
  }

  return response.text();
}

export async function syncDepositsFromConfiguredSheet(options?: {
  triggerSource?: string;
}): Promise<DepositsSyncResult> {
  const startedAt = Date.now();
  const timings: DepositsSyncTimings = {
    totalMs: 0,
    fetchSheetMs: 0,
    parseMs: 0,
    saveDbMs: 0,
    settingsMs: 0,
  };

  const finish = (
    result: Omit<DepositsSyncResult, "durationMs" | "timings">
  ): DepositsSyncResult => {
    timings.totalMs = Date.now() - startedAt;
    return { ...result, durationMs: timings.totalMs, timings };
  };

  const buildLogDetails = (
    meta: DepositsSheetMeta | Record<string, unknown> = {}
  ): Record<string, unknown> => {
    const totalMs = Date.now() - startedAt;
    return {
      ...meta,
      durationMs: totalMs,
      timings: { ...timings, totalMs },
    };
  };

  const sheetUrl = await readDepositsSheetUrl();
  const triggerSource = options?.triggerSource?.trim() || "admin";
  try {
    const fetchStartedAt = Date.now();
    const csvText = await fetchDepositsSheetCsv(sheetUrl);
    timings.fetchSheetMs = Date.now() - fetchStartedAt;

    const parseStartedAt = Date.now();
    const { offers, meta } = parseDepositsSheetCsv(csvText);
    timings.parseMs = Date.now() - parseStartedAt;

    if (offers.length === 0) {
      const error = "В таблице не найдено строк с предложениями по вкладам";
      await appendSyncLog({
        syncKind: "deposits",
        status: "error",
        source: sheetUrl,
        triggerSource,
        errorMessage: error,
        details: buildLogDetails(meta),
      });
      return finish({
        ok: false,
        inserted: 0,
        meta,
        error,
      });
    }

    const saveStartedAt = Date.now();
    const saved = await replaceDepositOffers(offers, sheetUrl);
    timings.saveDbMs = Date.now() - saveStartedAt;

    if (!saved) {
      const error = "Не удалось сохранить предложения в БД";
      await appendSyncLog({
        syncKind: "deposits",
        status: "error",
        source: sheetUrl,
        triggerSource,
        errorMessage: error,
        details: buildLogDetails(meta),
      });
      return finish({
        ok: false,
        inserted: 0,
        meta,
        error,
      });
    }

    const settingsStartedAt = Date.now();
    const syncedAt = new Date().toISOString();
    await Promise.all([
      writeSettingsParam(DEPOSITS_LAST_SYNCED_AT_PARAM, syncedAt),
      meta.changedAt
        ? writeSettingsParam(DEPOSITS_SHEET_CHANGED_AT_PARAM, meta.changedAt)
        : Promise.resolve(true),
      meta.inclusionThreshold
        ? writeSettingsParam(DEPOSITS_INCLUSION_THRESHOLD_PARAM, meta.inclusionThreshold)
        : Promise.resolve(true),
    ]);
    timings.settingsMs = Date.now() - settingsStartedAt;

    await appendSyncLog({
      syncKind: "deposits",
      status: "success",
      source: sheetUrl,
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
      source: sheetUrl,
      triggerSource,
      errorMessage: message,
      details: buildLogDetails(),
    });
    return finish({
      ok: false,
      inserted: 0,
      meta: { changedAt: null, inclusionThreshold: null },
      error: message,
    });
  }
}
