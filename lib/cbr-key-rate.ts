import { Redis } from "@upstash/redis";
import { getRedisRestConfig } from "@/lib/visits-store";

type SettingsRateRow = {
  parameter: string;
  date: string;
  rate: number;
};

const FALLBACK_KEY_RATE_PERCENT = 21;
const SETTINGS_TABLE_KEY = process.env.SETTINGS_TABLE_KEY ?? "financeandtraveltips:settings:table";
const SETTINGS_TIMEOUT_MS = 900;
const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedRate: number | null = null;
let cachedAtMs = 0;
let inFlight: Promise<number> | null = null;

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

function toValidRate(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n >= 200) return null;
  return n;
}

function toDateMs(date: string): number | null {
  const ms = new Date(date).getTime();
  if (!Number.isFinite(ms)) return null;
  return ms;
}

function parseRows(raw: unknown): SettingsRateRow[] {
  if (raw == null) return [];
  const payload = typeof raw === "string" ? (() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  })() : raw;
  if (!Array.isArray(payload)) return [];

  return payload
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
    .filter((row): row is SettingsRateRow => row !== null);
}

function pickNearestCurrentOrPastRate(rows: SettingsRateRow[], parameter: string): number | null {
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

export async function getDefaultKeyRatePercent(): Promise<number> {
  const now = Date.now();
  if (cachedRate != null && now - cachedAtMs < SETTINGS_CACHE_TTL_MS) {
    return cachedRate;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const redis = createSettingsClient();
    if (!redis) return FALLBACK_KEY_RATE_PERCENT;

    try {
      const raw = await withTimeout(redis.get(SETTINGS_TABLE_KEY), SETTINGS_TIMEOUT_MS);
      const rows = parseRows(raw);
      const fromTable = pickNearestCurrentOrPastRate(rows, "key_rate");
      if (fromTable != null) {
        cachedRate = fromTable;
        cachedAtMs = Date.now();
        return fromTable;
      }
    } catch (err) {
      console.error("[settings] getDefaultKeyRatePercent:", err);
    }

    cachedRate = FALLBACK_KEY_RATE_PERCENT;
    cachedAtMs = Date.now();
    return FALLBACK_KEY_RATE_PERCENT;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
