import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getDepositOfferRatePercent } from "@/lib/deposit-offers-format";
import { TOPBANKI_DEPOSITS_SOURCE_KEY } from "@/lib/deposits-topbanki-config";
import { supabaseRestDelete, supabaseRestInsert, type SupabaseRestFilter } from "@/lib/supabase-rest";

export type DepositOfferRow = {
  sortOrder: number;
  beacon: string;
  nominalRatePercent: number | null;
  rateMonthlyEquivPercent: number | null;
  rateEndEquivPercent: number | null;
  rateAnnualEquivPercent: number | null;
  interestPaymentType: string;
  interestPaymentTiming: string;
  termYears: number | null;
  termDays: number | null;
  bankName: string;
  region: string;
  assetsRank: string;
  rating: string;
  productName: string;
  minAmountThousands: string;
  replenishment: string;
  withdrawal: string;
  conditions: string;
  maxAmountText: string;
  productUrl: string;
  rawRow: string[];
};

export type DepositOfferRecord = DepositOfferRow & {
  id: number;
  dataSource: string;
  syncedAt: string;
};

const OFFERS_TIMEOUT_MS = Number(process.env.DEPOSITS_TIMEOUT_MS ?? "15000");
const OFFERS_ROW_TIMEOUT_MS = Number(process.env.DEPOSITS_ROW_TIMEOUT_MS ?? "8000");
const OFFERS_INSERT_CHUNK_SIZE = Number(process.env.DEPOSITS_INSERT_CHUNK_SIZE ?? "10");

const DEPOSIT_OFFER_LIST_COLUMNS =
  "id,sort_order,bank_name,product_name,nominal_rate_percent,rate_annual_equiv_percent,term_days,min_amount_thousands,max_amount_text,conditions,product_url";

function extractGoogleSpreadsheetId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

type DepositSourceFilter = {
  source: string;
  spreadsheetId: string | null;
};

function resolveDepositSourceFilter(dataSource: string): DepositSourceFilter | null {
  const source = dataSource.trim();
  if (!source) return null;
  return {
    source,
    spreadsheetId: extractGoogleSpreadsheetId(source),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("offers_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function mapDbListRow(row: Record<string, unknown>): DepositOfferRecord {
  return {
    id: Number(row.id),
    sortOrder: Number(row.sort_order ?? 0),
    beacon: "",
    nominalRatePercent:
      row.nominal_rate_percent == null ? null : Number(row.nominal_rate_percent),
    rateMonthlyEquivPercent: null,
    rateEndEquivPercent: null,
    rateAnnualEquivPercent:
      row.rate_annual_equiv_percent == null
        ? null
        : Number(row.rate_annual_equiv_percent),
    interestPaymentType: "",
    interestPaymentTiming: "",
    termYears: null,
    termDays: row.term_days == null ? null : Number(row.term_days),
    bankName: String(row.bank_name ?? ""),
    region: "",
    assetsRank: "",
    rating: "",
    productName: String(row.product_name ?? ""),
    minAmountThousands: String(row.min_amount_thousands ?? ""),
    replenishment: "",
    withdrawal: "",
    conditions: String(row.conditions ?? ""),
    maxAmountText: String(row.max_amount_text ?? ""),
    productUrl: String(row.product_url ?? ""),
    rawRow: [],
    dataSource: "",
    syncedAt: "",
  };
}

function toDbInsertRow(offer: DepositOfferRow, syncedAt: string, dataSource: string) {
  return {
    sort_order: offer.sortOrder,
    beacon: offer.beacon,
    nominal_rate_percent: offer.nominalRatePercent,
    rate_monthly_equiv_percent: offer.rateMonthlyEquivPercent,
    rate_end_equiv_percent: offer.rateEndEquivPercent,
    rate_annual_equiv_percent: offer.rateAnnualEquivPercent,
    interest_payment_type: offer.interestPaymentType,
    interest_payment_timing: offer.interestPaymentTiming,
    term_years: offer.termYears,
    term_days: offer.termDays,
    bank_name: offer.bankName,
    region: offer.region,
    assets_rank: offer.assetsRank,
    rating: offer.rating,
    product_name: offer.productName,
    min_amount_thousands: offer.minAmountThousands,
    replenishment: offer.replenishment,
    withdrawal: offer.withdrawal,
    conditions: offer.conditions,
    max_amount_text: offer.maxAmountText,
    product_url: offer.productUrl,
    raw_row: [],
    data_source: dataSource,
    synced_at: syncedAt,
  };
}

function buildDepositSourceRestFilters(
  filter: DepositSourceFilter,
  options?: { syncedAt?: string; excludeSyncedAt?: string }
): SupabaseRestFilter[] {
  const filters: SupabaseRestFilter[] = filter.spreadsheetId
    ? [{ column: "data_source", operator: "like", value: `%/d/${filter.spreadsheetId}/%` }]
    : [{ column: "data_source", operator: "eq", value: filter.source }];

  if (options?.syncedAt) {
    filters.push({ column: "synced_at", operator: "eq", value: options.syncedAt });
  }
  if (options?.excludeSyncedAt) {
    filters.push({ column: "synced_at", operator: "neq", value: options.excludeSyncedAt });
  }

  return filters;
}

async function deleteDepositOffersForSource(
  source: string,
  options?: { syncedAt?: string; excludeSyncedAt?: string }
): Promise<boolean> {
  const filter = resolveDepositSourceFilter(source);
  if (!filter) return false;

  const filters = buildDepositSourceRestFilters(filter, options);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const deleted = await supabaseRestDelete("app_deposit_offers", filters, OFFERS_TIMEOUT_MS);
    if (deleted.ok) return true;
    console.error(
      `[deposit-offers] deleteDepositOffersForSource:attempt${attempt}:`,
      deleted.error
    );
    if (attempt < 3) await sleep(150 * attempt);
  }

  return false;
}

async function rollbackNewDepositOffers(source: string, syncedAt: string): Promise<void> {
  const rolledBack = await deleteDepositOffersForSource(source, { syncedAt });
  if (!rolledBack) {
    console.error("[deposit-offers] rollbackNewDepositOffers: failed to remove partial sync", {
      source,
      syncedAt,
    });
  }
}
async function insertDepositOffersRows(
  rows: ReturnType<typeof toDbInsertRow>[]
): Promise<boolean> {
  if (rows.length === 0) return false;

  const chunks: ReturnType<typeof toDbInsertRow>[][] = [];
  for (let i = 0; i < rows.length; i += OFFERS_INSERT_CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + OFFERS_INSERT_CHUNK_SIZE));
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const results = await Promise.all(
      chunks.map((chunk) => supabaseRestInsert("app_deposit_offers", chunk, OFFERS_TIMEOUT_MS))
    );
    if (results.every((result) => result.ok)) return true;
    console.error(
      `[deposit-offers] insertDepositOffersRows:chunks:attempt${attempt}:`,
      results.map((result) => result.error).filter(Boolean)
    );
    if (attempt < 2) await sleep(150);
  }

  const results = await Promise.all(
    rows.map((row) => supabaseRestInsert("app_deposit_offers", [row], OFFERS_ROW_TIMEOUT_MS))
  );
  return results.every((result) => result.ok);
}

export async function replaceDepositOffers(
  offers: DepositOfferRow[],
  dataSource: string
): Promise<boolean> {
  const source = dataSource.trim();
  if (!source || offers.length === 0) return false;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;
  const syncedAt = new Date().toISOString();

  try {
    const insertRows = offers.map((offer) => toDbInsertRow(offer, syncedAt, source));
    const inserted = await insertDepositOffersRows(insertRows);
    if (!inserted) {
      await rollbackNewDepositOffers(source, syncedAt);
      return false;
    }

    const deleted = await deleteDepositOffersForSource(source, { excludeSyncedAt: syncedAt });
    if (!deleted) {
      await rollbackNewDepositOffers(source, syncedAt);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[deposit-offers] replaceDepositOffers:", err);
    await rollbackNewDepositOffers(source, syncedAt);
    return false;
  }
}

export async function readDepositOffers(
  dataSource: string,
  limit = 200
): Promise<DepositOfferRecord[]> {
  const filter = resolveDepositSourceFilter(dataSource);
  if (!filter) return [];

  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  try {
    let query = supabase
      .from("app_deposit_offers")
      .select(DEPOSIT_OFFER_LIST_COLUMNS)
      .order("sort_order", { ascending: true })
      .limit(limit);
    query = filter.spreadsheetId
      ? query.like("data_source", `%/d/${filter.spreadsheetId}/%`)
      : query.eq("data_source", filter.source);

    const response = await withTimeout(query.then((r) => r), OFFERS_TIMEOUT_MS);
    if (response.error) {
      console.error("[deposit-offers] readDepositOffers:", response.error);
      return [];
    }
    return (response.data ?? []).map((row) => mapDbListRow(row as Record<string, unknown>));
  } catch (err) {
    console.error("[deposit-offers] readDepositOffers:", err);
    return [];
  }
}

export async function readMergedDepositOffers(options: {
  sheetUrl: string;
  limitPerSource?: number;
}): Promise<DepositOfferRecord[]> {
  const limitPerSource = options.limitPerSource ?? 200;
  const [sheetOffers, topbankiOffers] = await Promise.all([
    readDepositOffers(options.sheetUrl, limitPerSource),
    readDepositOffers(TOPBANKI_DEPOSITS_SOURCE_KEY, limitPerSource),
  ]);

  const merged = [...sheetOffers, ...topbankiOffers];
  merged.sort((a, b) => {
    const left = getDepositOfferRatePercent(a) ?? -1;
    const right = getDepositOfferRatePercent(b) ?? -1;
    if (right !== left) return right - left;
    return a.sortOrder - b.sortOrder;
  });

  return merged.map((offer, index) => ({ ...offer, sortOrder: index + 1 }));
}

export async function countDepositOffers(dataSource: string): Promise<number> {
  const filter = resolveDepositSourceFilter(dataSource);
  if (!filter) return 0;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return 0;
  try {
    let query = supabase
      .from("app_deposit_offers")
      .select("id", { count: "exact", head: true });
    query = filter.spreadsheetId
      ? query.like("data_source", `%/d/${filter.spreadsheetId}/%`)
      : query.eq("data_source", filter.source);

    const response = await withTimeout(query.then((r) => r), OFFERS_TIMEOUT_MS);
    if (response.error) {
      console.error("[deposit-offers] countDepositOffers:", response.error);
      return 0;
    }
    return response.count ?? 0;
  } catch (err) {
    console.error("[deposit-offers] countDepositOffers:", err);
    return 0;
  }
}
