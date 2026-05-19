import { Redis } from "@upstash/redis";

const VISITS_KEY = "financeandtraveltips:visits:total";
const REDIS_OP_TIMEOUT_MS = 900;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("redis_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function trimEnv(v: string | undefined): string | undefined {
  if (v == null) return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

/**
 * REST-адрес и токен Upstash Redis.
 * Поддерживаются стандартные имена Upstash и алиасы Vercel KV (тот же REST API).
 */
export function getRedisRestConfig(): { url: string; token: string } | null {
  const url =
    trimEnv(process.env.UPSTASH_REDIS_REST_URL) ??
    trimEnv(process.env.KV_REST_API_URL);
  const token =
    trimEnv(process.env.UPSTASH_REDIS_REST_TOKEN) ??
    trimEnv(process.env.KV_REST_API_TOKEN);

  if (!url || !token) return null;

  if (!url.startsWith("https://")) {
    console.error(
      "[visits] UPSTASH_REDIS_REST_URL должен быть HTTPS REST URL (например https://xxx.upstash.io), а не redis://"
    );
    return null;
  }

  return { url, token };
}

function createClient(): Redis | null {
  const cfg = getRedisRestConfig();
  if (!cfg) return null;
  return new Redis({ url: cfg.url, token: cfg.token });
}

export function visitsStoreConfigured(): boolean {
  return getRedisRestConfig() !== null;
}

export async function incrementTotalVisits(): Promise<number | null> {
  const redis = createClient();
  if (!redis) return null;
  try {
    const n = await withTimeout(redis.incr(VISITS_KEY), REDIS_OP_TIMEOUT_MS);
    return typeof n === "number" ? n : null;
  } catch (err) {
    console.error("[visits] incrementTotalVisits:", err);
    return null;
  }
}

export async function getTotalVisits(): Promise<number | null> {
  const redis = createClient();
  if (!redis) return null;
  try {
    const v = await withTimeout(redis.get(VISITS_KEY), REDIS_OP_TIMEOUT_MS);
    if (v == null) return 0;
    if (typeof v === "number") return v;
    const parsed = parseInt(String(v), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (err) {
    console.error("[visits] getTotalVisits:", err);
    return null;
  }
}
