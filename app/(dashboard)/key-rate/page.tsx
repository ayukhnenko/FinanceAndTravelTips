"use client";

import { useState } from "react";

type SyncResponse = {
  ok: boolean;
  rate?: number | null;
  date?: string | null;
  error?: string;
};

export default function KeyRatePage() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<{ rate: number; date: string } | null>(null);

  async function syncFromCbr() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const resp = await fetch("/api/key-rate", { method: "POST" });
      const data = (await resp.json()) as SyncResponse;
      if (!resp.ok || !data.ok) {
        setError(data.error ?? "Не удалось запросить ставку");
        return;
      }
      setCurrent({
        rate: Number(data.rate ?? 0),
        date: String(data.date ?? ""),
      });
      setMessage("Ставка успешно получена.");
    } catch {
      setError("Не удалось запросить ставку");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-5 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Ключевая ставка ЦБ</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Функция запрашивает актуальную ставку с сайта cbr.ru и показывает, на какую дату
        она актуальна.
      </p>

      <div className="card-panel mt-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={syncFromCbr}
            disabled={pending}
            className="btn-primary disabled:opacity-60"
          >
            {pending ? "Запрос..." : "Запросить"}
          </button>
        </div>

        {current ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-3 text-sm text-[var(--foreground)]">
            <p>
              <strong>Ставка:</strong> {current.rate.toLocaleString("ru-RU")}%
            </p>
            <p>
              <strong>Актуально на:</strong> {current.date}
            </p>
          </div>
        ) : null}

        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>
    </div>
  );
}
