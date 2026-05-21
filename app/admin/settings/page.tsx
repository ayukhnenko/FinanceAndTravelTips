"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTimeMoscow, todayIsoDateMoscow } from "@/lib/date-utils";
import {
  formatDurationMs,
  readDurationMsFromDetails,
} from "@/lib/deposits-sync-format";

type Row = {
  parameter: string;
  date: string;
  rate: string;
  loadedAt?: string | null;
};

type VisitRow = {
  date: string;
  count: number;
};

type CronJobRow = {
  id: string;
  scheduleUtc: string;
  timeMoscow: string;
  description: string;
};

type CronSettings = {
  environmentName: string;
  vercelEnv: string | null;
  standLabel: string | null;
  cronSecretConfigured: boolean;
  cronActiveOnDeploy: boolean;
  timezone: "Europe/Moscow";
  path: string;
  jobs: CronJobRow[];
};

type DepositsSettings = {
  sheetUrl: string;
  spreadsheetId: string | null;
  lastSyncedAt: string | null;
  sheetChangedAt: string | null;
  inclusionThreshold: string | null;
  offerCount: number;
};

type AppSettingRow = {
  parameter: string;
  label: string;
  description: string;
  value: string;
  defaultValue: string;
};

type SyncLogRow = {
  id: number;
  syncKind: "key_rate" | "deposits";
  status: "success" | "error";
  source: string;
  triggerSource: string;
  insertedCount: number;
  rate: number | null;
  effectiveDate: string | null;
  errorMessage: string;
  details?: Record<string, unknown>;
  createdAt: string;
};

function formatSyncKind(kind: SyncLogRow["syncKind"]): string {
  return kind === "key_rate" ? "Ставка ЦБ" : "Вклады";
}

function formatSyncTrigger(trigger: string): string {
  if (trigger === "admin") return "Админка";
  if (trigger === "cron") return "Cron";
  return trigger || "—";
}

function formatSyncLogResult(log: SyncLogRow): string {
  const durationMs = readDurationMsFromDetails(log.details);
  const durationText = durationMs != null ? ` · ${formatDurationMs(durationMs)}` : "";

  if (log.status === "error") {
    return `${log.errorMessage || "Ошибка"}${durationText}`;
  }
  if (log.syncKind === "key_rate") {
    const rateText =
      log.rate != null ? `${log.rate.toLocaleString("ru-RU")}%` : "—";
    const dateText = log.effectiveDate ?? "—";
    const suffix = log.insertedCount > 0 ? " · новая запись" : " · без изменений";
    return `${rateText} · ${dateText}${suffix}${durationText}`;
  }
  return `${log.insertedCount.toLocaleString("ru-RU")} предложений${durationText}`;
}

function formatDepositsSyncTimings(
  timings?: {
    fetchSheetMs?: number;
    parseMs?: number;
    saveDbMs?: number;
    settingsMs?: number;
    totalMs?: number;
  } | null
): string {
  if (!timings) return "";
  const parts: string[] = [];
  if (timings.fetchSheetMs != null) parts.push(`таблица ${formatDurationMs(timings.fetchSheetMs)}`);
  if (timings.parseMs != null) parts.push(`разбор ${formatDurationMs(timings.parseMs)}`);
  if (timings.saveDbMs != null) parts.push(`БД ${formatDurationMs(timings.saveDbMs)}`);
  if (timings.settingsMs != null) parts.push(`настройки ${formatDurationMs(timings.settingsMs)}`);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

function shortenSource(source: string, max = 48): string {
  const text = source.trim();
  if (!text) return "—";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function emptyRow(): Row {
  return { parameter: "key_rate", date: "", rate: "" };
}

function todayIsoDate(): string {
  return todayIsoDateMoscow();
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [syncingCbr, setSyncingCbr] = useState(false);
  const [cbrSyncMessage, setCbrSyncMessage] = useState<string | null>(null);
  const [cron, setCron] = useState<CronSettings | null>(null);
  const [appParams, setAppParams] = useState<AppSettingRow[]>([]);
  const [savingAppParams, setSavingAppParams] = useState(false);
  const [appParamsMessage, setAppParamsMessage] = useState<string | null>(null);
  const [deposits, setDeposits] = useState<DepositsSettings | null>(null);
  const [syncingDeposits, setSyncingDeposits] = useState(false);
  const [depositsMessage, setDepositsMessage] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLogRow[]>([]);

  const reloadDepositsData = useCallback(async (): Promise<boolean> => {
    try {
      const resp = await fetch("/api/admin/deposits", { cache: "no-store" });
      if (resp.status === 403) {
        window.location.assign("/admin/login?from=/admin/settings");
        return false;
      }
      if (!resp.ok) return false;
      const data = (await resp.json()) as DepositsSettings;
      setDeposits(data);
      return true;
    } catch {
      return false;
    }
  }, [router]);

  const reloadAdminData = useCallback(async (): Promise<boolean> => {
    try {
      const resp = await fetch("/api/admin/settings", { cache: "no-store" });
      if (resp.status === 403) {
        window.location.assign("/admin/login?from=/admin/settings");
        return false;
      }
      const data = (await resp.json()) as {
        rows?: Array<{ parameter: string; date: string; rate: number; loadedAt?: string | null }>;
        visits?: Array<{ date: string; count: number }>;
        cron?: CronSettings;
        appParams?: AppSettingRow[];
        syncLogs?: SyncLogRow[];
      };
      const nextRows =
        data.rows?.map((r) => ({
          parameter: r.parameter,
          date: r.date,
          rate: String(r.rate),
          loadedAt: typeof r.loadedAt === "string" ? r.loadedAt : null,
        })) ?? [];
      setRows(nextRows.length ? nextRows : [emptyRow()]);
      const nextVisits = (data.visits ?? [])
        .filter(
          (v) =>
            typeof v.date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
            Number.isFinite(Number(v.count))
        )
        .map((v) => ({ date: v.date, count: Number(v.count) }))
        .sort((a, b) => a.date.localeCompare(b.date));
      setVisits(nextVisits);
      setCron(data.cron ?? null);
      setAppParams(data.appParams ?? []);
      setSyncLogs(data.syncLogs ?? []);
      await reloadDepositsData();
      return true;
    } catch {
      setError("Не удалось загрузить настройки");
      return false;
    }
  }, [router, reloadDepositsData]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await reloadAdminData();
      if (mounted) setLoading(false);
      if (!ok && mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [reloadAdminData]);

  const totalVisits = useMemo(
    () => visits.reduce((sum, row) => sum + row.count, 0),
    [visits]
  );

  const displayRows = useMemo(() => {
    const keyRateRows = rows
      .filter((row) => row.parameter.trim() === "key_rate")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);
    const otherRows = rows.filter((row) => row.parameter.trim() !== "key_rate");
    return [...keyRateRows, ...otherRows];
  }, [rows]);

  async function logoutAdmin() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function saveAppParams() {
    setAppParamsMessage(null);
    setSavingAppParams(true);
    try {
      const params = Object.fromEntries(appParams.map((row) => [row.parameter, row.value]));
      const resp = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        appParams?: AppSettingRow[];
        error?: string;
      };
      if (!resp.ok) {
        setAppParamsMessage(data.error ?? "Не удалось сохранить параметры");
        return;
      }
      setAppParams(data.appParams ?? appParams);
      setAppParamsMessage("Параметры сохранены.");
      await reloadDepositsData();
    } catch {
      setAppParamsMessage("Не удалось сохранить параметры");
    } finally {
      setSavingAppParams(false);
    }
  }

  function updateAppParamValue(parameter: string, value: string) {
    setAppParams((current) =>
      current.map((row) => (row.parameter === parameter ? { ...row, value } : row))
    );
  }

  async function syncDepositsFromSheet() {
    setDepositsMessage(null);
    setSyncingDeposits(true);
    try {
      const resp = await fetch("/api/admin/deposits", { method: "POST" });
      const data = (await resp.json().catch(() => ({}))) as DepositsSettings & {
        ok?: boolean;
        inserted?: number;
        durationMs?: number;
        timings?: {
          fetchSheetMs?: number;
          parseMs?: number;
          saveDbMs?: number;
          settingsMs?: number;
          totalMs?: number;
        };
        error?: string;
        meta?: { changedAt?: string | null; inclusionThreshold?: string | null };
      };
      if (!resp.ok || !data.ok) {
        const durationText =
          data.durationMs != null ? ` Затрачено: ${formatDurationMs(data.durationMs)}.` : "";
        setDepositsMessage((data.error ?? "Не удалось загрузить таблицу вкладов") + durationText);
        await reloadAdminData();
        return;
      }
      setDeposits(data);
      const changedAt = data.meta?.changedAt ?? data.sheetChangedAt;
      const threshold = data.meta?.inclusionThreshold ?? data.inclusionThreshold;
      setDepositsMessage(
        `Загружено предложений: ${data.inserted ?? data.offerCount ?? 0}.` +
          (changedAt ? ` Дата изменения в таблице: ${changedAt}.` : "") +
          (threshold ? ` Порог: ${threshold}.` : "") +
          (data.durationMs != null
            ? ` Затрачено: ${formatDurationMs(data.durationMs)}${formatDepositsSyncTimings(data.timings)}.`
            : "")
      );
      await reloadAdminData();
    } catch {
      setDepositsMessage("Не удалось загрузить таблицу вкладов");
      await reloadAdminData();
    } finally {
      setSyncingDeposits(false);
    }
  }

  async function syncCbrRateToDb() {
    setCbrSyncMessage(null);
    setSyncingCbr(true);
    try {
      const resp = await fetch("/api/key-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saveToDb: true }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        inserted?: boolean;
        rate?: number;
        date?: string;
        error?: string;
      };
      if (!resp.ok || !data.ok) {
        setCbrSyncMessage(data.error ?? "Не удалось запросить ставку ЦБ");
        await reloadAdminData();
        return;
      }
      const rateText =
        typeof data.rate === "number" ? `${data.rate.toLocaleString("ru-RU")}%` : "—";
      const dateText = typeof data.date === "string" ? data.date : "—";
      setCbrSyncMessage(
        data.inserted
          ? `Ставка ЦБ сохранена: ${rateText}, актуально на ${dateText}.`
          : `Ставка ЦБ получена: ${rateText}, актуально на ${dateText}. На эту дату запись уже есть.`
      );
      await reloadAdminData();
    } catch {
      setCbrSyncMessage("Не удалось запросить ставку ЦБ");
      await reloadAdminData();
    } finally {
      setSyncingCbr(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-5 md:p-8">
        <p className="text-sm text-[var(--muted)]">Загрузка настроек...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-5 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Администрирование настроек</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Параметры источников данных, ставки и загрузки вкладов
          </p>
        </div>
        <button
          type="button"
          onClick={logoutAdmin}
          className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
        >
          Выйти из админки
        </button>
      </div>

      <div className="card-panel overflow-x-auto">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Параметры приложения
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Адреса источников данных хранятся в таблице app_settings_params.
          </p>
        </div>

        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[55%]" />
            <col className="w-[31%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-2 py-2">Параметр</th>
              <th className="px-2 py-2">Значение</th>
              <th className="max-w-0 px-2 py-2">Описание</th>
            </tr>
          </thead>
          <tbody>
            {appParams.map((row) => (
              <tr key={row.parameter} className="border-b border-[var(--border)]/70 align-top">
                <td className="px-2 py-2">
                  <div className="text-xs font-medium leading-snug text-[var(--foreground)]">{row.label}</div>
                  <div className="mt-1 break-all font-mono text-xs leading-snug text-[var(--muted)]">
                    {row.parameter}
                  </div>
                </td>
                <td className="max-w-0 px-2 py-2">
                  <input
                    type="url"
                    value={row.value}
                    onChange={(e) => updateAppParamValue(row.parameter, e.target.value)}
                    className="field-input w-full min-w-0 font-mono text-xs"
                  />
                </td>
                <td className="max-w-0 break-words px-2 py-2 text-xs leading-snug text-[var(--muted)]">
                  {row.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveAppParams}
            disabled={savingAppParams}
            className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] transition hover:border-[var(--accent)]/40 disabled:opacity-60"
          >
            {savingAppParams ? "Сохранение..." : "Сохранить параметры"}
          </button>
          {appParamsMessage ? (
            <p className="text-sm text-[var(--muted)]">{appParamsMessage}</p>
          ) : null}
        </div>
      </div>

      <div className="card-panel mt-6 overflow-x-auto">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={syncCbrRateToDb}
            disabled={syncingCbr}
            className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] transition hover:border-[var(--accent)]/40 disabled:opacity-60"
          >
            {syncingCbr ? "Запрос ставки ЦБ..." : "Запросить ставку ЦБ (сохранить в БД)"}
          </button>
          {cbrSyncMessage ? (
            <p className="text-sm text-[var(--muted)]">{cbrSyncMessage}</p>
          ) : null}
        </div>

        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-2 py-2">Параметр</th>
              <th className="px-2 py-2">Актуально на</th>
              <th className="px-2 py-2">Ставка, %</th>
              <th className="px-2 py-2">Загружено (MSK)</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, index) => {
              const isKeyRate = row.parameter.trim() === "key_rate";
              const isOldKeyRate = isKeyRate && row.date < todayIsoDate();
              return (
                <tr
                  key={`${index}-${row.parameter}-${row.date}`}
                  className={`border-b border-[var(--border)]/70 ${
                    isOldKeyRate ? "text-[var(--muted)]" : ""
                  }`}
                >
                  <td className="px-2 py-2">{row.parameter}</td>
                  <td className="px-2 py-2">{row.date}</td>
                  <td className="px-2 py-2">{row.rate}</td>
                  <td className="px-2 py-2 tabular-nums whitespace-nowrap">
                    {formatDateTimeMoscow(row.loadedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Редактирование записей отключено. Показаны 3 последние по дате записи key_rate;
          исторические отображаются серым.
        </p>
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </div>

      <div className="card-panel mt-6 overflow-x-auto">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Вклады: Google Sheets
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Загрузка сохраняет предложения по вкладам в Supabase. URL таблицы — в параметрах выше.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={syncDepositsFromSheet}
              disabled={syncingDeposits}
              className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] transition hover:border-[var(--accent)]/40 disabled:opacity-60"
            >
              {syncingDeposits ? "Загрузка..." : "Загрузить из Google Sheets"}
            </button>
          </div>

          {deposits ? (
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2">
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">В БД</dt>
                <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">
                  {deposits.offerCount.toLocaleString("ru-RU")} предложений
                </dd>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2">
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  Загружено (MSK)
                </dt>
                <dd className="mt-1 text-sm font-medium text-[var(--foreground)] tabular-nums">
                  {formatDateTimeMoscow(deposits.lastSyncedAt)}
                </dd>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2">
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  Дата в таблице
                </dt>
                <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">
                  {deposits.sheetChangedAt ?? "—"}
                </dd>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2">
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Порог</dt>
                <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">
                  {deposits.inclusionThreshold ?? "—"}
                </dd>
              </div>
            </dl>
          ) : null}

          {depositsMessage ? (
            <p className="text-sm text-[var(--muted)]">{depositsMessage}</p>
          ) : null}
        </div>
      </div>

      <div className="card-panel mt-6 overflow-x-auto">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Журнал загрузок в БД
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Последние попытки сохранить ставку ЦБ и предложения по вкладам.
          </p>
        </div>

        {syncLogs.length > 0 ? (
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="px-2 py-2">Когда (MSK)</th>
                <th className="px-2 py-2">Тип</th>
                <th className="px-2 py-2">Источник</th>
                <th className="px-2 py-2">Запуск</th>
                <th className="px-2 py-2">Статус</th>
                <th className="px-2 py-2">Результат</th>
              </tr>
            </thead>
            <tbody>
              {syncLogs.map((log) => (
                <tr key={log.id} className="border-b border-[var(--border)]/70 align-top">
                  <td className="px-2 py-2 tabular-nums whitespace-nowrap">
                    {formatDateTimeMoscow(log.createdAt)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{formatSyncKind(log.syncKind)}</td>
                  <td className="max-w-0 break-all px-2 py-2 font-mono text-xs">
                    {log.source ? (
                      <a
                        href={log.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-accent"
                        title={log.source}
                      >
                        {shortenSource(log.source)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {formatSyncTrigger(log.triggerSource)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <span
                      className={
                        log.status === "success" ? "text-emerald-700" : "text-rose-700"
                      }
                    >
                      {log.status === "success" ? "Успех" : "Ошибка"}
                    </span>
                  </td>
                  <td className="max-w-0 break-words px-2 py-2 text-sm">
                    {formatSyncLogResult(log)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Записей пока нет. Журнал появится после загрузки ставки ЦБ или вкладов в БД.
          </p>
        )}
      </div>

      <div className="card-panel mt-6 overflow-x-auto">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Cron: синхронизация ставки ЦБ
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Автоматический запуск с сохранением в БД. Расписание задаётся в коде и vercel.json.
          </p>
        </div>
        {cron ? (
          <>
            <dl className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2">
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Среда</dt>
                <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">
                  {cron.environmentName}
                </dd>
                {cron.standLabel && cron.vercelEnv ? (
                  <dd className="mt-1 text-xs text-[var(--muted)]">
                    Vercel: {cron.vercelEnv}
                  </dd>
                ) : cron.vercelEnv ? (
                  <dd className="mt-1 text-xs text-[var(--muted)]">
                    Vercel: {cron.vercelEnv}
                  </dd>
                ) : null}
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2">
                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  Cron на деплое
                </dt>
                <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">
                  {cron.cronActiveOnDeploy ? "Активен" : "Не активен"}
                </dd>
                <dd className="mt-1 text-xs text-[var(--muted)]">
                  {cron.cronSecretConfigured
                    ? "CRON_SECRET задан"
                    : "CRON_SECRET не задан"}
                </dd>
              </div>
            </dl>
            <p className="mb-3 text-sm text-[var(--muted)]">
              Endpoint: <code className="text-[var(--foreground)]">{cron.path}</code>
            </p>
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-2 py-2">Задача</th>
                  <th className="px-2 py-2">Время (MSK)</th>
                  <th className="px-2 py-2">Cron (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {cron.jobs.map((job) => (
                  <tr key={job.id} className="border-b border-[var(--border)]/70">
                    <td className="px-2 py-2">{job.description}</td>
                    <td className="px-2 py-2 tabular-nums">{job.timeMoscow}</td>
                    <td className="px-2 py-2 font-mono text-xs">{job.scheduleUtc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!cron.cronActiveOnDeploy ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Cron выполняется только на Production-деплое Vercel при заданном CRON_SECRET.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">Настройки cron недоступны.</p>
        )}
      </div>

      <div className="card-panel mt-6 overflow-x-auto">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Визиты по дням</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Хранение ведется по датам, итог рассчитан как сумма по всем строкам.
          </p>
        </div>
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-2 py-2">Дата</th>
              <th className="px-2 py-2">Визитов</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((row) => (
              <tr key={row.date} className="border-b border-[var(--border)]/70">
                <td className="px-2 py-2">{row.date}</td>
                <td className="px-2 py-2 tabular-nums">{row.count.toLocaleString("ru-RU")}</td>
              </tr>
            ))}
            <tr className="border-t border-[var(--border)] bg-[var(--accent-soft)]/40 font-semibold text-[var(--foreground)]">
              <td className="px-2 py-2">Итого</td>
              <td className="px-2 py-2 tabular-nums">{totalVisits.toLocaleString("ru-RU")}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
