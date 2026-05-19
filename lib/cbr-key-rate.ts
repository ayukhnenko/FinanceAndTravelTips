import {
  pickNearestCurrentOrPastRate,
  readSettingsRows,
  seedDefaultSettingsRows,
} from "@/lib/settings-store";

const FALLBACK_KEY_RATE_PERCENT = 21;
const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000;
const REFRESH_RETRY_INTERVAL_MS = 15 * 1000;

let cachedRate: number | null = null;
let cachedAtMs = 0;
let lastRefreshAttemptMs = 0;
let inFlight: Promise<number> | null = null;

function shouldRefresh(now: number): boolean {
  const cacheExpired = cachedRate == null || now - cachedAtMs >= SETTINGS_CACHE_TTL_MS;
  const retryWindowPassed = now - lastRefreshAttemptMs >= REFRESH_RETRY_INTERVAL_MS;
  return cacheExpired && retryWindowPassed;
}

function refreshRateInBackground(): void {
  if (inFlight) return;
  lastRefreshAttemptMs = Date.now();

  inFlight = (async () => {
    try {
      await seedDefaultSettingsRows([
        {
          parameter: "key_rate",
          date: new Date().toISOString().slice(0, 10),
          rate: FALLBACK_KEY_RATE_PERCENT,
        },
      ]);
      const rows = await readSettingsRows();
      const fromTable = pickNearestCurrentOrPastRate(rows, "key_rate");
      cachedRate = fromTable ?? FALLBACK_KEY_RATE_PERCENT;
      cachedAtMs = Date.now();
      return cachedRate;
    } catch (err) {
      console.error("[settings] getDefaultKeyRatePercent:", err);
      if (cachedRate == null) {
        cachedRate = FALLBACK_KEY_RATE_PERCENT;
        cachedAtMs = Date.now();
      }
      return cachedRate;
    } finally {
      inFlight = null;
    }
  })();
}

export async function getDefaultKeyRatePercent(): Promise<number> {
  const now = Date.now();
  if (cachedRate == null && !inFlight) {
    lastRefreshAttemptMs = now;
    inFlight = (async () => {
      try {
        const rows = await readSettingsRows();
        const fromTable = pickNearestCurrentOrPastRate(rows, "key_rate");
        cachedRate = fromTable ?? FALLBACK_KEY_RATE_PERCENT;
        cachedAtMs = Date.now();
        return cachedRate;
      } catch (err) {
        console.error("[settings] getDefaultKeyRatePercent:init:", err);
        cachedRate = FALLBACK_KEY_RATE_PERCENT;
        cachedAtMs = Date.now();
        return cachedRate;
      } finally {
        inFlight = null;
      }
    })();
  }

  if (inFlight) {
    return inFlight;
  }

  if (shouldRefresh(now)) {
    refreshRateInBackground();
  }
  return cachedRate ?? FALLBACK_KEY_RATE_PERCENT;
}
