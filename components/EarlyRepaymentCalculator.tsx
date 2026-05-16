"use client";

import { useMemo, useState } from "react";
import {
  BENCHMARK_EXCESS_RATIO_STRONG,
  effectiveBenchmark,
  effectiveCreditRate,
  getEarlyRepaymentVerdict,
  type EarlyRepaymentVerdict,
} from "@/lib/early-repayment";
import { useI18n } from "@/components/I18nProvider";

function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}%`;
}

type Props = {
  defaultNaosPercent: number;
};

export default function EarlyRepaymentCalculator({
  defaultNaosPercent,
}: Props) {
  const { tr } = useI18n();
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

  const verdictText: Record<
    EarlyRepaymentVerdict,
    { title: string; body: string; tone: "green" | "amber" | "blue" }
  > = {
    invest_strong: {
      title: tr("Вывод", "Conclusion"),
      body: tr(
        "Ориентир заметно выше вашей эффективной ставки по кредиту (более чем на 13%). Рекомендуем не гасить кредит досрочно, а разместить средства на депозите или вложить в ОФЗ.",
        "Your benchmark is well above your effective loan rate (by more than 13%). It is usually better not to repay early and place funds in a deposit or OFZ bonds."
      ),
      tone: "blue",
    },
    invest_flexible: {
      title: tr("Вывод", "Conclusion"),
      body: tr(
        "Ориентир выше вашей эффективной ставки по кредиту, но не более чем на 13%. Рекомендуем также держать деньги на депозите или в ОФЗ с целью обеспечения гибкости. При большом желании досрочное погашение возможно.",
        "Your benchmark is above your effective loan rate, but by no more than 13%. Keeping funds in deposits or OFZ bonds is still preferable for flexibility. Early repayment is optional."
      ),
      tone: "amber",
    },
    repay_early: {
      title: tr("Вывод", "Conclusion"),
      body: tr(
        "Ориентир ниже или равен вашей эффективной ставке по кредиту. Рекомендуем досрочно гасить кредит.",
        "Your benchmark is below or equal to your effective loan rate. Early repayment is likely the better choice."
      ),
      tone: "green",
    },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
        {tr(
          "Выгодно ли гасить кредит досрочно",
          "Is Early Repayment Worth It?"
        )}
      </h1>

      <div className="card-panel space-y-5 !shadow-[var(--shadow-card)]">
        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Процентная ставка по кредиту в год, %", "Loan interest rate per year, %")}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="field-input"
            placeholder={tr("например 12", "e.g. 12")}
          />
        </label>

        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 has-[:checked]:border-[var(--accent)]/50">
          <input
            type="checkbox"
            checked={isMortgage}
            onChange={(e) => setIsMortgage(e.target.checked)}
            className="h-4 w-4 rounded accent-[var(--accent)]"
          />
          <span>
            {tr(
              "Кредит является ипотекой (+0,5 п.п. стоимость страховки)",
              "This loan is a mortgage (+0.5 p.p. insurance cost)"
            )}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Ориентир (НАОС), % годовых", "Benchmark (NAOS), % per year")}
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
            {tr(
              "По умолчанию подставлена ключевая ставка Банка России (при отсутствии данных на сервере — проверьте значение на",
              "By default, this field uses the Bank of Russia key rate (if unavailable on server, check"
            )}{" "}
            <a
              href="https://www.cbr.ru/hd_base/KeyRate/"
              target="_blank"
              rel="noopener noreferrer"
              className="link-accent"
            >
              cbr.ru
            </a>
            {tr(").", ").")}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Ставка по депозиту (необязательно), % годовых", "Deposit rate (optional), % per year")}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            className="field-input"
            placeholder={tr("оставьте пустым, если нет", "leave empty if none")}
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            {tr(
              "Если указана и она выше НАОС — для сравнения берётся она; если ниже или равна НАОС — используется НАОС.",
              "If provided and above NAOS, it is used for comparison; if lower or equal, NAOS is used."
            )}
          </span>
        </label>

        {!parsed.valid ? (
          <p className="text-sm text-amber-800">
            {tr(
              "Проверьте ввод: ставки должны быть неотрицательными числами.",
              "Check input: rates must be non-negative numbers."
            )}
          </p>
        ) : null}

        <button
          type="button"
          onClick={calculate}
          disabled={!parsed.valid}
          className="btn-primary w-full"
        >
          {tr("Рассчитать", "Calculate")}
        </button>
      </div>

      {showResult && snapshot ? (
        <div className="mt-8 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {tr("Эффективная ставка по кредиту", "Effective loan rate")}
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--foreground)]">
                {pct(snapshot.creditEff)}
              </p>
              {isMortgage ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {tr("С учётом +0,5 п.п. для ипотеки", "Including +0.5 p.p. for mortgage")}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {tr("Ориентир для сравнения", "Benchmark for comparison")}
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--foreground)]">
                {pct(snapshot.bench)}
              </p>
              {parsed.deposit != null &&
              Number.isFinite(parsed.deposit) &&
              parsed.deposit > parsed.naos ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {tr(
                    "Использована ставка депозита (выше НАОС)",
                    "Deposit rate used (higher than NAOS)"
                  )}
                </p>
              ) : (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {tr("НАОС (или депозит, если выгоднее)", "NAOS (or deposit, if better)")}
                </p>
              )}
            </div>
          </div>

          {Number.isFinite(snapshot.margin) && snapshot.bench > snapshot.creditEff ? (
            <p className="text-center text-sm text-[var(--muted)]">
              {tr("Ориентир выше ставки по кредиту на", "Benchmark is above loan rate by")}{" "}
              <span className="font-semibold text-[var(--accent)]">
                {(snapshot.margin * 100).toLocaleString("ru-RU", {
                  maximumFractionDigits: 2,
                })}
                %
              </span>{" "}
              {tr(
                "относительно (порог «сильной» рекомендации во вкладку/ОФЗ:",
                "relative (threshold for a strong deposit/OFZ recommendation:"
              )}{" "}
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
