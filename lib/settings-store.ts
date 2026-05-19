import { Redis } from "@upstash/redis";
import { getRedisRestConfig } from "@/lib/visits-store";

export type SettingsRateRow = {
  parameter: string;
  date: string;
  rate: number;
};

const SETTINGS_TABLE_KEY =
  process.env.SETTINGS_TABLE_KEY ?? "financeandtraveltips:settings:table";
const SETTINGS_TIMEOUT_MS = Number(process.env.SETTINGS_TIMEOUT_MS ?? "2500");

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
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

function createSettingsClient(): Redis | null {
  const cfg = getRedisRestConfig();
  if (!cfg) return null;
  return new Redis({ url: cfg.url, token: cfg.token });
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
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const parameter = String(row.parameter ?? "").trim();
      const date = String(row.date ?? "").trim();
      const rate = toValidRate(row.rate);
      if (!parameter || !date || rate == null) return null;
      if (toDateMs(date) == null) return null;
      return { parameter, date, rate };
    })
    .filter((row): row is SettingsRateRow => row !== null)
    .sort((a, b) => {
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
  const now = Date.now();
  let bestRate: number | null = null;
  let bestDateMs = -Infinity;

  for (const row of rows) {
    if (row.parameter !== parameter) continue;
    const dateMs = toDateMs(row.date);
    if (dateMs == null || dateMs > now) continue;
    if (dateMs > bestDateMs) {
      bestDateMs = dateMs;
      bestRate = row.rate;
    }
  }

  return bestRate;
}

export async function readSettingsRows(): Promise<SettingsRateRow[]> {
  const redis = createSettingsClient();
  if (!redis) return [];
  try {
    const raw = await withTimeout(redis.get(SETTINGS_TABLE_KEY), SETTINGS_TIMEOUT_MS);
    const parsed =
      typeof raw === "string"
        ? (() => {
            try {
              return JSON.parse(raw);
            } catch {
              return [];
            }
          })()
        : raw;
    return normalizeSettingsRows(parsed);
  } catch (err) {
    console.error("[settings] readSettingsRows:", err);
    return [];
  }
}

export async function writeSettingsRows(rows: SettingsRateRow[]): Promise<boolean> {
  const redis = createSettingsClient();
  if (!redis) return false;
  const normalized = normalizeSettingsRows(rows);
  try {
    await withTimeout(
      redis.set(SETTINGS_TABLE_KEY, JSON.stringify(normalized)),
      SETTINGS_TIMEOUT_MS
    );
    return true;
  } catch (err) {
    console.error("[settings] writeSettingsRows:", err);
    return false;
  }
}
