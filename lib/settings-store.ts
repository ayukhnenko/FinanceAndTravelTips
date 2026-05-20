import { todayIsoDateMoscow } from "@/lib/date-utils";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type SettingsRateRow = {
  parameter: string;
  date: string;
  rate: number;
  loadedAt?: string;
};

const SETTINGS_TIMEOUT_MS = Number(process.env.SETTINGS_TIMEOUT_MS ?? "2500");

async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("settings_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function toValidRate(v: unknown): number | null {
  const n =
    typeof v === "number"
      ? v
      : (() => {
          const text = String(v).trim().replace(",", ".");
          if (!/^\d+(\.\d+)?$/.test(text)) return Number.NaN;
          return Number(text);
        })();
  if (!Number.isFinite(n) || n <= 0 || n >= 200) return null;
  return n;
}

export function toDateMs(date: string): number | null {
  const ms = new Date(date).getTime();
  if (!Number.isFinite(ms)) return null;
  return ms;
}

export function normalizeSettingsRows(raw: unknown): SettingsRateRow[] {
  if (!Array.isArray(raw)) return [];
  const parsed = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const parameter = String(row.parameter ?? "").trim();
      const date = String(row.date ?? "").trim();
      const rate = toValidRate(row.rate);
      if (!parameter || !date || rate == null) return null;
      if (toDateMs(date) == null) return null;
      const loadedAtRaw = row.loadedAt ?? row.created_at;
      const loadedAt =
        typeof loadedAtRaw === "string" && loadedAtRaw.trim()
          ? loadedAtRaw.trim()
          : undefined;
      const normalized: SettingsRateRow = loadedAt
        ? { parameter, date, rate, loadedAt }
        : { parameter, date, rate };
      return normalized;
    })
    .filter((row): row is SettingsRateRow => row !== null);

  return parsed.sort((a, b) => {
      if (a.parameter !== b.parameter) return a.parameter.localeCompare(b.parameter);
      const ams = toDateMs(a.date) ?? 0;
      const bms = toDateMs(b.date) ?? 0;
      return bms - ams;
    });
}

export function pickNearestCurrentOrPastRate(
  rows: SettingsRateRow[],
  parameter: string
): number | null {
  const row = pickNearestCurrentOrPastRateRow(rows, parameter);
  return row?.rate ?? null;
}

export function pickNearestCurrentOrPastRateRow(
  rows: SettingsRateRow[],
  parameter: string
): SettingsRateRow | null {
  const today = todayIsoDateMoscow();
  let bestRow: SettingsRateRow | null = null;
  let bestDate = "";

  for (const row of rows) {
    if (row.parameter !== parameter) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
    if (row.date > today) continue;
    if (!bestRow || row.date > bestDate) {
      bestDate = row.date;
      bestRow = row;
    }
  }

  return bestRow;
}

export async function readSettingsRows(): Promise<SettingsRateRow[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  try {
    const response = await withTimeout(
      supabase
        .from("app_settings_rates")
        .select("parameter,effective_date,rate,created_at")
        .then((r) => r),
      SETTINGS_TIMEOUT_MS
    );
    const { data, error } = response;
    if (error) {
      console.error("[settings] readSettingsRows:", error);
      return [];
    }
    const parsed = (data ?? []).map((row) => ({
      parameter: row.parameter,
      date: row.effective_date,
      rate: row.rate,
      loadedAt: row.created_at,
    }));
    return normalizeSettingsRows(parsed);
  } catch (err) {
    console.error("[settings] readSettingsRows:", err);
    return [];
  }
}

export async function writeSettingsRows(rows: SettingsRateRow[]): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;
  const normalized = normalizeSettingsRows(rows);
  try {
    const deleted = await withTimeout(
      supabase
        .from("app_settings_rates")
        .delete()
        .neq("parameter", "__never__")
        .then((r) => r),
      SETTINGS_TIMEOUT_MS
    );
    if (deleted.error) {
      console.error("[settings] writeSettingsRows:delete:", deleted.error);
      return false;
    }

    if (normalized.length > 0) {
      const insertRows = normalized.map((row) => ({
        parameter: row.parameter,
        effective_date: row.date,
        rate: row.rate,
      }));
      const inserted = await withTimeout(
        supabase.from("app_settings_rates").insert(insertRows).then((r) => r),
        SETTINGS_TIMEOUT_MS
      );
      if (inserted.error) {
        console.error("[settings] writeSettingsRows:insert:", inserted.error);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error("[settings] writeSettingsRows:", err);
    return false;
  }
}

export async function insertSettingsRateIfMissing(
  row: SettingsRateRow
): Promise<"inserted" | "exists" | "error"> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return "error";
  const normalized = normalizeSettingsRows([row])[0];
  if (!normalized) return "error";
  try {
    const inserted = await withTimeout(
      supabase
        .from("app_settings_rates")
        .insert({
          parameter: normalized.parameter,
          effective_date: normalized.date,
          rate: normalized.rate,
        })
        .then((r) => r),
      SETTINGS_TIMEOUT_MS
    );
    if (!inserted.error) return "inserted";
    if (inserted.error.code === "23505") return "exists";
    console.error("[settings] insertSettingsRateIfMissing:", inserted.error);
    return "error";
  } catch (err) {
    console.error("[settings] insertSettingsRateIfMissing:", err);
    return "error";
  }
}

export async function seedDefaultSettingsRows(
  rows: SettingsRateRow[]
): Promise<void> {
  const current = await readSettingsRows();
  if (current.length > 0) return;
  await writeSettingsRows(rows);
}
