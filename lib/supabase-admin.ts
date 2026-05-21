import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function resetSupabaseAdminClient(): void {
  cachedClient = null;
}

function trimEnv(v: string | undefined): string | undefined {
  if (v == null) return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

function getSupabaseConfig(): { url: string; serviceRoleKey: string } | null {
  const url = trimEnv(process.env.SUPABASE_URL);
  const serviceRoleKey =
    trimEnv(process.env.SUPABASE_SECRET_KEY) ??
    trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

export function supabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return fetch(input, {
      ...init,
      cache: "no-store",
    });
  }
  // POST/PATCH/DELETE: plain fetch — Next.js cache options break large Supabase writes.
  return fetch(input, init);
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  cachedClient = createClient(cfg.url, cfg.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: supabaseFetch,
    },
  });
  return cachedClient;
}
