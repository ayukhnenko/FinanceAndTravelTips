"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import CalculatorInfoInlineButton from "@/components/CalculatorInfoInlineButton";
import { buildReportUiLink } from "@/lib/report-ui-link";
import { openUiReportLink } from "@/lib/open-ui-report";
import CopyApiUiLinkButton from "@/components/CopyApiUiLinkButton";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

type Period = "monthly" | "quarterly" | "yearly";

function compoundAmount(
  principal: number,
  annualRatePercent: number,
  years: number,
  nPerYear: number
): number {
  if (principal <= 0 || years <= 0) return principal;
  const r = annualRatePercent / 100 / nPerYear;
  const periods = years * nPerYear;
  return principal * Math.pow(1 + r, periods);
}

export default function CompoundInterestCalculator() {
  const { tr } = useI18n();
  const searchParams = useSearchParams();
  const periods = useMemo<{ id: Period; label: string; nPerYear: number }[]>(
    () => [
      { id: "monthly", label: tr("Ежемесячно", "Monthly"), nPerYear: 12 },
      { id: "quarterly", label: tr("Ежеквартально", "Quarterly"), nPerYear: 4 },
      { id: "yearly", label: tr("Раз в год", "Yearly"), nPerYear: 1 },
    ],
    [tr]
  );

  const [principal, setPrincipal] = useState(() => searchParams.get("principal") ?? "");
  const [rate, setRate] = useState(() => searchParams.get("annualRatePercent") ?? "");
  const [years, setYears] = useState(() => searchParams.get("years") ?? "");
  const [period, setPeriod] = useState<Period>(() => {
    const raw = searchParams.get("period");
    return raw === "quarterly" || raw === "yearly" || raw === "monthly"
      ? raw
      : "monthly";
  });
  const [showResult, setShowResult] = useState(false);
  useEffect(() => {
    if (searchParams.get("autocalc") === "1") {
      setShowResult(true);
    }
  }, [searchParams]);

  const parsed = useMemo(() => {
    const p = parseFloat(principal.replace(/\s/g, "").replace(",", "."));
    const r = parseFloat(rate.replace(",", "."));
    const y = parseFloat(years.replace(",", "."));
    const cfg = periods.find((x) => x.id === period)!;
    return {
      principal: p,
      rate: r,
      years: y,
      nPerYear: cfg.nPerYear,
      valid:
        Number.isFinite(p) &&
        p > 0 &&
        Number.isFinite(r) &&
        r >= 0 &&
        Number.isFinite(y) &&
        y > 0,
    };
  }, [principal, rate, years, period, periods]);

  const result = useMemo(() => {
    if (!parsed.valid) return null;
    const amount = compoundAmount(
      parsed.principal,
      parsed.rate,
      parsed.years,
      parsed.nPerYear
    );
    const interest = amount - parsed.principal;
    return { amount, interest };
  }, [parsed]);
  const reportUiLink = useMemo(() => {
    if (!parsed.valid) return null;
    return buildReportUiLink("/api/compound/report", {
      principal: parsed.principal,
      annualRatePercent: parsed.rate,
      years: parsed.years,
      period,
    });
  }, [parsed, period]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
          {tr("Калькулятор сложных процентов", "Compound Interest Calculator")}
        </h1>
        <CalculatorInfoInlineButton infoKey="compound" />
      </div>

      <div className="card-panel space-y-5 !shadow-[var(--shadow-card)]">
        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Начальная сумма, ₽", "Initial amount, ₽")}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            className="field-input"
            placeholder={tr("например 100000", "e.g. 100000")}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Годовая ставка, %", "Annual rate, %")}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="field-input"
            placeholder={tr("например 10", "e.g. 10")}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Срок, лет", "Term, years")}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            className="field-input"
            placeholder={tr("например 5", "e.g. 5")}
          />
        </label>

        <fieldset>
          <legend className="mb-2 text-sm text-[var(--muted)]">
            {tr("Капитализация", "Compounding")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {periods.map((p) => (
              <label
                key={p.id}
                className="cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-4 py-2 text-sm text-[var(--foreground)] has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)]"
              >
                <input
                  type="radio"
                  name="cap"
                  checked={period === p.id}
                  onChange={() => setPeriod(p.id)}
                  className="sr-only"
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>

        {!parsed.valid ? (
          <p className="text-sm text-amber-800">
            {tr(
              "Укажите положительную сумму и срок, неотрицательную ставку.",
              "Enter a positive amount and term, and a non-negative rate."
            )}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (!reportUiLink) return;
            openUiReportLink(reportUiLink);
          }}
          disabled={!parsed.valid}
          className="btn-primary w-full"
        >
          {tr("Рассчитать", "Calculate")}
        </button>

        {showResult && result ? (
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-5 shadow-inner">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-[var(--muted)]">{tr("Итоговая сумма", "Final amount")}</span>
              <span className="font-semibold text-[var(--foreground)]">
                {rub.format(result.amount)}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-[var(--muted)]">{tr("Начисленные проценты", "Accrued interest")}</span>
              <span className="font-semibold text-[var(--accent)]">
                {rub.format(result.interest)}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)]">
              {tr(
                "Формула: S = P · (1 + r/m)^m·t, где m — число периодов капитализации в год.",
                "Formula: S = P · (1 + r/m)^m·t, where m is the number of compounding periods per year."
              )}
            </p>
            <CopyApiUiLinkButton
              href={reportUiLink}
              idleLabel={tr("Копировать ссылку на расчет", "Copy calculation link")}
              copiedLabel={tr("Ссылка скопирована", "Link copied")}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
