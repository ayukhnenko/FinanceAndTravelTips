"use client";

import { useMemo, useState } from "react";
import {
  BENCHMARK_EXCESS_RATIO_STRONG,
  effectiveBenchmark,
  effectiveCreditRate,
  getEarlyRepaymentVerdict,
  type EarlyRepaymentVerdict,
} from "@/lib/early-repayment";

function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}%`;
}

const verdictText: Record<
  EarlyRepaymentVerdict,
  { title: string; body: string; tone: "green" | "amber" | "blue" }
> = {
  invest_strong: {
    title: "Вывод",
    body: "Ориентир заметно выше вашей эффективной ставки по кредиту (более чем на 13%). Рекомендуем не гасить кредит досрочно, а разместить средства на депозите или вложить в ОФЗ.",
    tone: "blue",
  },
  invest_flexible: {
    title: "Вывод",
    body: "Ориентир выше вашей эффективной ставки по кредиту, но не более чем на 13%. Рекомендуем также держать деньги на депозите или в ОФЗ с целью обеспечения гибкости. При большом желании досрочное погашение возможно.",
    tone: "amber",
  },
  repay_early: {
    title: "Вывод",
    body: "Ориентир ниже или равен вашей эффективной ставке по кредиту. Рекомендуем досрочно гасить кредит.",
    tone: "green",
  },
};

type Props = {
  defaultNaosPercent: number;
};

export default function EarlyRepaymentCalculator({
  defaultNaosPercent,
}: Props) {
  const [rate, setRate] = useState("");
  const [isMortgage, setIsMortgage] = useState(false);
  const [naos, setNaos] = useState(() =>
    Number.isFinite(defaultNaosPercent)
      ? String(defaultNaosPercent).replace(".", ",")
      : "21"
  );
  const [deposit, setDeposit] = useState("");
  const [showResult, setShowResult] = useState(false);

  const parsed = useMemo(() => {
    const r = parseFloat(rate.replace(",", "."));
    const n = parseFloat(naos.replace(",", "."));
    const dRaw = deposit.trim();
    const d =
      dRaw === "" ? null : parseFloat(dRaw.replace(",", "."));
    return {
      rate: r,
      naos: n,
      deposit: d,
      valid:
        Number.isFinite(r) &&
        r >= 0 &&
        Number.isFinite(n) &&
        n >= 0 &&
        (d === null || (Number.isFinite(d) && d >= 0)),
    };
  }, [rate, naos, deposit]);

  const snapshot = useMemo(() => {
    if (!parsed.valid) return null;
    const creditEff = effectiveCreditRate(parsed.rate, isMortgage);
    const bench = effectiveBenchmark(parsed.naos, parsed.deposit);
    const verdict = getEarlyRepaymentVerdict(creditEff, bench);
    const margin =
      creditEff > 0 && Number.isFinite(bench)
        ? (bench - creditEff) / creditEff
        : NaN;
    return { creditEff, bench, verdict, margin };
  }, [parsed, isMortgage]);

  function calculate() {
    if (!parsed.valid) return;
    setShowResult(true);
  }

  const toneClass = {
    green: "border-[var(--accent)]/35 bg-[var(--accent-soft)] text-[var(--foreground)]",
    amber: "border-amber-300 bg-amber-50 text-amber-950",
    blue: "border-sky-300 bg-sky-50 text-sky-950",
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
        Выгодно ли гасить кредит досрочно
      </h1>

      <div className="card-panel space-y-5 !shadow-[var(--shadow-card)]">
        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            Процентная ставка по кредиту в год, %
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="field-input"
              placeholder="например 12"
          />
        </label>

        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 has-[:checked]:border-[var(--accent)]/50">
          <input
            type="checkbox"
            checked={isMortgage}
            onChange={(e) => setIsMortgage(e.target.checked)}
            className="h-4 w-4 rounded accent-[var(--accent)]"
          />
          <span>Кредит является ипотекой (+0,5 п.п. стоимость страховки)</span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            Ориентир (НАОС), % годовых
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={naos}
            onChange={(e) => setNaos(e.target.value)}
            className="field-input"
            placeholder={String(defaultNaosPercent)}
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            По умолчанию подставлена ключевая ставка Банка России (при отсутствии
            данных на сервере — проверьте значение на{" "}
            <a
              href="https://www.cbr.ru/hd_base/KeyRate/"
              target="_blank"
              rel="noopener noreferrer"
              className="link-accent"
            >
              cbr.ru
            </a>
            ).
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            Ставка по депозиту (необязательно), % годовых
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            className="field-input"
            placeholder="оставьте пустым, если нет"
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            Если указана и она выше НАОС — для сравнения берётся она; если ниже
            или равна НАОС — используется НАОС.
          </span>
        </label>

        {!parsed.valid ? (
          <p className="text-sm text-amber-800">
            Проверьте ввод: ставки должны быть неотрицательными числами.
          </p>
        ) : null}

        <button
          type="button"
          onClick={calculate}
          disabled={!parsed.valid}
          className="btn-primary w-full"
        >
          Рассчитать
        </button>
      </div>

      {showResult && snapshot ? (
        <div className="mt-8 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Эффективная ставка по кредиту
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--foreground)]">
                {pct(snapshot.creditEff)}
              </p>
              {isMortgage ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  С учётом +0,5 п.п. для ипотеки
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Ориентир для сравнения
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--foreground)]">
                {pct(snapshot.bench)}
              </p>
              {parsed.deposit != null &&
              Number.isFinite(parsed.deposit) &&
              parsed.deposit > parsed.naos ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Использована ставка депозита (выше НАОС)
                </p>
              ) : (
                <p className="mt-1 text-xs text-[var(--muted)]">НАОС (или депозит, если выгоднее)</p>
              )}
            </div>
          </div>

          {Number.isFinite(snapshot.margin) && snapshot.bench > snapshot.creditEff ? (
            <p className="text-center text-sm text-[var(--muted)]">
              Ориентир выше ставки по кредиту на{" "}
              <span className="font-semibold text-[var(--accent)]">
                {(snapshot.margin * 100).toLocaleString("ru-RU", {
                  maximumFractionDigits: 2,
                })}
                %
              </span>{" "}
              относительно (порог «сильной» рекомендации во вкладку/ОФЗ:{" "}
              {(BENCHMARK_EXCESS_RATIO_STRONG * 100).toLocaleString("ru-RU")}%).
            </p>
          ) : null}

          <div
            className={`rounded-2xl border px-5 py-4 ${toneClass[verdictText[snapshot.verdict].tone]}`}
          >
            <p className="font-semibold text-[var(--foreground)]">
              {verdictText[snapshot.verdict].title}
            </p>
            <p className="mt-2 text-sm leading-relaxed opacity-95">
              {verdictText[snapshot.verdict].body}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
