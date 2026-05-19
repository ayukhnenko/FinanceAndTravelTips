"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { todayIsoDateMoscow } from "@/lib/date-utils";

type Row = {
  parameter: string;
  date: string;
  rate: string;
};

type VisitRow = {
  date: string;
  count: number;
};

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

  const reloadAdminData = useCallback(async (): Promise<boolean> => {
    try {
      const resp = await fetch("/api/admin/settings", { cache: "no-store" });
      if (resp.status === 403) {
        router.push("/admin/login?from=/admin/settings");
        return false;
      }
      const data = (await resp.json()) as {
        rows?: Array<{ parameter: string; date: string; rate: number }>;
        visits?: Array<{ date: string; count: number }>;
      };
      const nextRows =
        data.rows?.map((r) => ({
          parameter: r.parameter,
          date: r.date,
          rate: String(r.rate),
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
      return true;
    } catch {
      setError("Не удалось загрузить настройки");
      return false;
    }
  }, [router]);

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
            Таблица источника ставок (parameter/date/rate)
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

        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-2 py-2">Параметр</th>
              <th className="px-2 py-2">Актуально на</th>
              <th className="px-2 py-2">Ставка, %</th>
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
