import { getSupabaseAdminClient, supabaseConfigured } from "@/lib/supabase-admin";

const VISITS_TOTAL_LEGACY_KEY = "financeandtraveltips:visits:total";
const VISITS_DAY_KEY_PREFIX = "financeandtraveltips:visits:day:";
const DB_OP_TIMEOUT_MS = Number(process.env.DB_TIMEOUT_MS ?? "2500");
let migrationPromise: Promise<void> | null = null;

async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("db_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function visitsStoreConfigured(): boolean {
  return supabaseConfigured();
}

function formatDayKey(date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return `${VISITS_DAY_KEY_PREFIX}${day}`;
}

function dayFromKey(key: string): string | null {
  if (!key.startsWith(VISITS_DAY_KEY_PREFIX)) return null;
  const day = key.slice(VISITS_DAY_KEY_PREFIX.length);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

async function ensureDailyVisitsMigrated(): Promise<void> {
  if (migrationPromise) {
    await migrationPromise;
    return;
  }

  migrationPromise = (async () => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;

    const todayKey = formatDayKey();
    const response = await withTimeout(
      supabase
        .from("app_counters")
        .select("key,value")
        .in("key", [VISITS_TOTAL_LEGACY_KEY, todayKey])
        .then((r) => r),
      DB_OP_TIMEOUT_MS
    );
    const { data, error } = response;
    if (error) {
      console.error("[visits] ensureDailyVisitsMigrated:", error);
      return;
    }

    const rows = data ?? [];
    const legacyValue = Number(
      rows.find((row) => row.key === VISITS_TOTAL_LEGACY_KEY)?.value ?? 0
    );
    if (!Number.isFinite(legacyValue) || legacyValue <= 0) return;

    const todayValue = Number(rows.find((row) => row.key === todayKey)?.value ?? 0);
    const mergedValue = Math.floor(
      (Number.isFinite(todayValue) ? todayValue : 0) + legacyValue
    );

    const upserted = await withTimeout(
      supabase
        .from("app_counters")
        .upsert({ key: todayKey, value: mergedValue }, { onConflict: "key" })
        .then((r) => r),
      DB_OP_TIMEOUT_MS
    );
    if (upserted.error) {
      console.error("[visits] ensureDailyVisitsMigrated:upsert:", upserted.error);
      return;
    }

    const deleted = await withTimeout(
      supabase
        .from("app_counters")
        .delete()
        .eq("key", VISITS_TOTAL_LEGACY_KEY)
        .then((r) => r),
      DB_OP_TIMEOUT_MS
    );
    if (deleted.error) {
      console.error("[visits] ensureDailyVisitsMigrated:delete:", deleted.error);
    }
  })()
    .catch((err) => {
      console.error("[visits] ensureDailyVisitsMigrated:", err);
    })
    .finally(() => {
      migrationPromise = Promise.resolve();
    });

  await migrationPromise;
}

export type DailyVisitsRow = {
  date: string;
  count: number;
};

export async function incrementTotalVisits(): Promise<number | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  try {
    await ensureDailyVisitsMigrated();
    const response = await withTimeout(
      supabase.rpc("increment_counter", { p_key: formatDayKey() }).then((r) => r),
      DB_OP_TIMEOUT_MS
    );
    const { error } = response;
    if (error) {
      console.error("[visits] incrementTotalVisits:", error);
      return null;
    }
    return getTotalVisits();
  } catch (err) {
    console.error("[visits] incrementTotalVisits:", err);
    return null;
  }
}

export async function getDailyVisits(): Promise<DailyVisitsRow[] | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  try {
    await ensureDailyVisitsMigrated();
    const response = await withTimeout(
      supabase
        .from("app_counters")
        .select("key,value")
        .like("key", `${VISITS_DAY_KEY_PREFIX}%`)
        .then((r) => r),
      DB_OP_TIMEOUT_MS
    );
    const { data, error } = response;
    if (error) {
      console.error("[visits] getDailyVisits:", error);
      return null;
    }
    return (data ?? [])
      .map((row) => {
        const date = dayFromKey(row.key);
        const count = Number(row.value);
        if (!date || !Number.isFinite(count)) return null;
        return { date, count: Math.floor(count) };
      })
      .filter((row): row is DailyVisitsRow => row !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.error("[visits] getDailyVisits:", err);
    return null;
  }
}

export async function getTotalVisits(): Promise<number | null> {
  try {
    const rows = await getDailyVisits();
    if (rows == null) return null;
    return rows.reduce((sum, row) => sum + row.count, 0);
  } catch (err) {
    console.error("[visits] getTotalVisits:", err);
    return null;
  }
}
