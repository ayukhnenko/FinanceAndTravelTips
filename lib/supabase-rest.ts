import { request as httpsRequest } from "node:https";
import { URL } from "node:url";

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

function trimEnv(v: string | undefined): string | undefined {
  if (v == null) return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

function getSupabaseConfig(): SupabaseConfig | null {
  const url = trimEnv(process.env.SUPABASE_URL);
  const serviceRoleKey =
    trimEnv(process.env.SUPABASE_SECRET_KEY) ??
    trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

export type SupabaseRestFilter = {
  column: string;
  operator: "eq" | "neq" | "like";
  value: string;
};

type RestResponse = {
  ok: boolean;
  status: number;
  body: string;
};

function buildFilterParam(filter: SupabaseRestFilter): [string, string] {
  return [filter.column, `${filter.operator}.${filter.value}`];
}

async function supabaseRestRequest(
  method: "POST" | "DELETE",
  table: string,
  options?: {
    filters?: SupabaseRestFilter[];
    body?: unknown;
    timeoutMs?: number;
  }
): Promise<RestResponse> {
  const cfg = getSupabaseConfig();
  if (!cfg) return { ok: false, status: 0, body: "Supabase is not configured" };

  const url = new URL(`${cfg.url.replace(/\/$/, "")}/rest/v1/${table}`);
  for (const filter of options?.filters ?? []) {
    const [key, value] = buildFilterParam(filter);
    url.searchParams.append(key, value);
  }

  const bodyStr = options?.body != null ? JSON.stringify(options.body) : undefined;
  const headers: Record<string, string> = {
    apikey: cfg.serviceRoleKey,
    Authorization: `Bearer ${cfg.serviceRoleKey}`,
    Prefer: "return=minimal",
  };
  if (bodyStr) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = String(Buffer.byteLength(bodyStr));
  }

  const timeoutMs = options?.timeoutMs ?? 30000;

  return new Promise((resolve) => {
    const req = httpsRequest(
      url,
      { method, headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode ?? 0;
          resolve({ ok: status >= 200 && status < 300, status, body });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("supabase_rest_timeout"));
    });
    req.on("error", (err) => resolve({ ok: false, status: 0, body: String(err) }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

export async function supabaseRestInsert(
  table: string,
  rows: unknown[],
  timeoutMs?: number
): Promise<{ ok: boolean; error?: string }> {
  const response = await supabaseRestRequest("POST", table, {
    body: rows,
    timeoutMs,
  });
  if (response.ok) return { ok: true };
  return { ok: false, error: response.body || `HTTP ${response.status}` };
}

export async function supabaseRestDelete(
  table: string,
  filters: SupabaseRestFilter[],
  timeoutMs?: number
): Promise<{ ok: boolean; error?: string }> {
  const response = await supabaseRestRequest("DELETE", table, {
    filters,
    timeoutMs,
  });
  if (response.ok) return { ok: true };
  return { ok: false, error: response.body || `HTTP ${response.status}` };
}
