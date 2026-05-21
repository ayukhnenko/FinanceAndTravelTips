import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type SyncKind = "key_rate" | "deposits";
export type SyncStatus = "success" | "error";

export type SyncLogRecord = {
  id: number;
  syncKind: SyncKind;
  status: SyncStatus;
  source: string;
  triggerSource: string;
  insertedCount: number;
  rate: number | null;
  effectiveDate: string | null;
  errorMessage: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export type AppendSyncLogInput = {
  syncKind: SyncKind;
  status: SyncStatus;
  source?: string;
  triggerSource?: string;
  insertedCount?: number;
  rate?: number | null;
  effectiveDate?: string | null;
  errorMessage?: string;
  details?: Record<string, unknown>;
};

const LOGS_TIMEOUT_MS = Number(process.env.SETTINGS_TIMEOUT_MS ?? "8000");

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("sync_logs_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function mapDbRow(row: Record<string, unknown>): SyncLogRecord {
  return {
    id: Number(row.id),
    syncKind: row.sync_kind === "deposits" ? "deposits" : "key_rate",
    status: row.status === "error" ? "error" : "success",
    source: String(row.source ?? ""),
    triggerSource: String(row.trigger_source ?? ""),
    insertedCount: Number(row.inserted_count ?? 0),
    rate: row.rate == null ? null : Number(row.rate),
    effectiveDate: row.effective_date == null ? null : String(row.effective_date),
    errorMessage: String(row.error_message ?? ""),
    details:
      row.details && typeof row.details === "object" && !Array.isArray(row.details)
        ? (row.details as Record<string, unknown>)
        : {},
    createdAt: String(row.created_at ?? ""),
  };
}

export async function appendSyncLog(input: AppendSyncLogInput): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;

  try {
    const response = await withTimeout(
      supabase
        .from("app_sync_logs")
        .insert({
          sync_kind: input.syncKind,
          status: input.status,
          source: input.source?.trim() ?? "",
          trigger_source: input.triggerSource?.trim() ?? "",
          inserted_count: input.insertedCount ?? 0,
          rate: input.rate ?? null,
          effective_date: input.effectiveDate ?? null,
          error_message: input.errorMessage?.trim() ?? "",
          details: input.details ?? {},
        })
        .then((r) => r),
      LOGS_TIMEOUT_MS
    );
    if (response.error) {
      console.error("[sync-logs] appendSyncLog:", response.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[sync-logs] appendSyncLog:", err);
    return false;
  }
}

export async function readSyncLogs(options?: {
  syncKind?: SyncKind;
  limit?: number;
}): Promise<SyncLogRecord[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);

  try {
    let query = supabase
      .from("app_sync_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (options?.syncKind) {
      query = query.eq("sync_kind", options.syncKind);
    }

    const response = await withTimeout(query.then((r) => r), LOGS_TIMEOUT_MS);
    if (response.error) {
      console.error("[sync-logs] readSyncLogs:", response.error);
      return [];
    }
    return (response.data ?? []).map((row) => mapDbRow(row as Record<string, unknown>));
  } catch (err) {
    console.error("[sync-logs] readSyncLogs:", err);
    return [];
  }
}
