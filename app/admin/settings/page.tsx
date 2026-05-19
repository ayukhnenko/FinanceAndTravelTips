"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  parameter: string;
  date: string;
  rate: string;
};

function parseRateInput(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0 || n >= 200) return null;
  return n;
}

function emptyRow(): Row {
  return { parameter: "key_rate", date: "", rate: "" };
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch("/api/admin/settings", { cache: "no-store" });
        if (resp.status === 403) {
          router.push("/admin/login?from=/admin/settings");
          return;
        }
        const data = (await resp.json()) as {
          rows?: Array<{ parameter: string; date: string; rate: number }>;
        };
        if (!mounted) return;
        const nextRows =
          data.rows?.map((r) => ({
            parameter: r.parameter,
            date: r.date,
            rate: String(r.rate),
          })) ?? [];
        setRows(nextRows.length ? nextRows : [emptyRow()]);
      } catch {
        if (mounted) setError("Не удалось загрузить настройки");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const hasInvalidRows = useMemo(
    () =>
      rows.some((r) => {
        if (!r.parameter.trim()) return true;
        if (!r.date.trim()) return true;
        return parseRateInput(r.rate) == null;
      }),
    [rows]
  );

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [emptyRow()];
    });
  }

  async function save() {
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const payload = {
        rows: rows.map((r) => ({
          parameter: r.parameter.trim(),
          date: r.date.trim(),
          rate: parseRateInput(r.rate) ?? 0,
        })),
      };
      const resp = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Ошибка сохранения");
        return;
      }
      setMessage("Настройки сохранены");
    } catch {
      setError("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function logoutAdmin() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/");
    router.refresh();
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
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-2 py-2">Параметр</th>
              <th className="px-2 py-2">Дата (YYYY-MM-DD)</th>
              <th className="px-2 py-2">Ставка, %</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${index}-${row.parameter}-${row.date}`} className="border-b border-[var(--border)]/70">
                <td className="px-2 py-2">
                  <input
                    className="field-input"
                    value={row.parameter}
                    onChange={(e) => updateRow(index, { parameter: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    className="field-input"
                    type="date"
                    value={row.date}
                    onChange={(e) => updateRow(index, { date: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    className="field-input"
                    inputMode="decimal"
                    placeholder="Например: 20.5 или 20,5"
                    value={row.rate}
                    onChange={(e) => updateRow(index, { rate: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:border-rose-300 hover:text-rose-700"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] transition hover:border-[var(--accent)]/40"
          >
            Добавить строку
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || hasInvalidRows}
            className="btn-primary disabled:opacity-60"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>

        {hasInvalidRows ? (
          <p className="mt-3 text-sm text-amber-700">
            Проверьте строки: параметр обязателен, дата обязательна, ставка должна быть числом (0; 200).
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      </div>
    </div>
  );
}
