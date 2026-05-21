import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const CBR_KEY_RATE_URL_PARAM = "cbr_key_rate_url";
export const DEPOSITS_SHEET_URL_PARAM = "deposits_sheet_url";
export const DEPOSITS_LAST_SYNCED_AT_PARAM = "deposits_last_synced_at";
export const DEPOSITS_SHEET_CHANGED_AT_PARAM = "deposits_sheet_changed_at";
export const DEPOSITS_INCLUSION_THRESHOLD_PARAM = "deposits_inclusion_threshold";

export const DEFAULT_CBR_KEY_RATE_URL = "https://www.cbr.ru/hd_base/keyrate/";
export const DEFAULT_DEPOSITS_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1U3Su2Jn-DH9ZXRzL8X0PQajcLWDDyKHP/edit?usp=drivesdk&ouid=114738469475006966269&rtpof=true&sd=true";

export type EditableAppSettingDefinition = {
  parameter: string;
  label: string;
  description: string;
  defaultValue: string;
};

export type EditableAppSetting = EditableAppSettingDefinition & {
  value: string;
};

export const EDITABLE_APP_SETTINGS: EditableAppSettingDefinition[] = [
  {
    parameter: CBR_KEY_RATE_URL_PARAM,
    label: "URL страницы ключевой ставки ЦБ",
    description: "Страница cbr.ru для ручной и cron-синхронизации ставки",
    defaultValue: DEFAULT_CBR_KEY_RATE_URL,
  },
  {
    parameter: DEPOSITS_SHEET_URL_PARAM,
    label: "URL Google-таблицы вкладов",
    description: "Таблица с предложениями по вкладам для загрузки в БД",
    defaultValue: DEFAULT_DEPOSITS_SHEET_URL,
  },
];

const PARAMS_TIMEOUT_MS = Number(process.env.SETTINGS_TIMEOUT_MS ?? "2500");

async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("params_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateEditableAppSetting(
  parameter: string,
  value: string
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Значение не может быть пустым";
  if (!isValidHttpUrl(trimmed)) return "Укажите корректный HTTP(S) URL";

  if (parameter === CBR_KEY_RATE_URL_PARAM) {
    if (!/cbr\.ru/i.test(trimmed)) {
      return "URL ЦБ должен вести на домен cbr.ru";
    }
  }

  if (parameter === DEPOSITS_SHEET_URL_PARAM) {
    if (!/\/spreadsheets\/d\/[a-zA-Z0-9-_]+/.test(trimmed)) {
      return "URL должен содержать ID Google Sheets (/spreadsheets/d/...)";
    }
  }

  return null;
}

export async function readSettingsParam(parameter: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  try {
    const response = await withTimeout(
      supabase
        .from("app_settings_params")
        .select("value")
        .eq("parameter", parameter)
        .maybeSingle()
        .then((r) => r),
      PARAMS_TIMEOUT_MS
    );
    if (response.error) {
      console.error("[settings-params] readSettingsParam:", response.error);
      return null;
    }
    const value = response.data?.value;
    return typeof value === "string" ? value : null;
  } catch (err) {
    console.error("[settings-params] readSettingsParam:", err);
    return null;
  }
}

export async function writeSettingsParam(
  parameter: string,
  value: string
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;
  try {
    const response = await withTimeout(
      supabase
        .from("app_settings_params")
        .upsert(
          {
            parameter,
            value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "parameter" }
        )
        .then((r) => r),
      PARAMS_TIMEOUT_MS
    );
    if (response.error) {
      console.error("[settings-params] writeSettingsParam:", response.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[settings-params] writeSettingsParam:", err);
    return false;
  }
}

export async function readEditableAppSettings(): Promise<EditableAppSetting[]> {
  const settings = await Promise.all(
    EDITABLE_APP_SETTINGS.map(async (definition) => {
      const stored = await readSettingsParam(definition.parameter);
      const trimmed = stored?.trim();
      return {
        ...definition,
        value: trimmed || definition.defaultValue,
      };
    })
  );
  return settings;
}

export async function writeEditableAppSettings(
  values: Record<string, string>
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const definition of EDITABLE_APP_SETTINGS) {
    if (!(definition.parameter in values)) continue;
    const validationError = validateEditableAppSetting(
      definition.parameter,
      values[definition.parameter] ?? ""
    );
    if (validationError) {
      return { ok: false, error: `${definition.label}: ${validationError}` };
    }
  }

  for (const definition of EDITABLE_APP_SETTINGS) {
    if (!(definition.parameter in values)) continue;
    const ok = await writeSettingsParam(
      definition.parameter,
      values[definition.parameter].trim()
    );
    if (!ok) {
      return { ok: false, error: `Не удалось сохранить «${definition.label}»` };
    }
  }

  return { ok: true };
}

export async function readCbrKeyRateUrl(): Promise<string> {
  const stored = await readSettingsParam(CBR_KEY_RATE_URL_PARAM);
  const trimmed = stored?.trim();
  return trimmed || DEFAULT_CBR_KEY_RATE_URL;
}

export async function readDepositsSheetUrl(): Promise<string> {
  const stored = await readSettingsParam(DEPOSITS_SHEET_URL_PARAM);
  const trimmed = stored?.trim();
  return trimmed || DEFAULT_DEPOSITS_SHEET_URL;
}

export type DepositsPublicSettings = {
  sheetUrl: string;
  lastSyncedAt: string | null;
  sheetChangedAt: string | null;
  inclusionThreshold: string | null;
};

export async function readDepositsPublicSettings(): Promise<DepositsPublicSettings> {
  const supabase = getSupabaseAdminClient();
  const parameters = [
    DEPOSITS_SHEET_URL_PARAM,
    DEPOSITS_LAST_SYNCED_AT_PARAM,
    DEPOSITS_SHEET_CHANGED_AT_PARAM,
    DEPOSITS_INCLUSION_THRESHOLD_PARAM,
  ];

  if (!supabase) {
    return {
      sheetUrl: DEFAULT_DEPOSITS_SHEET_URL,
      lastSyncedAt: null,
      sheetChangedAt: null,
      inclusionThreshold: null,
    };
  }

  try {
    const response = await withTimeout(
      supabase
        .from("app_settings_params")
        .select("parameter,value")
        .in("parameter", parameters)
        .then((r) => r),
      PARAMS_TIMEOUT_MS
    );
    if (response.error) {
      console.error("[settings-params] readDepositsPublicSettings:", response.error);
      return {
        sheetUrl: DEFAULT_DEPOSITS_SHEET_URL,
        lastSyncedAt: null,
        sheetChangedAt: null,
        inclusionThreshold: null,
      };
    }

    const values = new Map<string, string>();
    for (const row of response.data ?? []) {
      if (typeof row.parameter === "string" && typeof row.value === "string") {
        values.set(row.parameter, row.value);
      }
    }

    const sheetUrl = values.get(DEPOSITS_SHEET_URL_PARAM)?.trim() || DEFAULT_DEPOSITS_SHEET_URL;
    return {
      sheetUrl,
      lastSyncedAt: values.get(DEPOSITS_LAST_SYNCED_AT_PARAM) ?? null,
      sheetChangedAt: values.get(DEPOSITS_SHEET_CHANGED_AT_PARAM) ?? null,
      inclusionThreshold: values.get(DEPOSITS_INCLUSION_THRESHOLD_PARAM) ?? null,
    };
  } catch (err) {
    console.error("[settings-params] readDepositsPublicSettings:", err);
    return {
      sheetUrl: DEFAULT_DEPOSITS_SHEET_URL,
      lastSyncedAt: null,
      sheetChangedAt: null,
      inclusionThreshold: null,
    };
  }
}
