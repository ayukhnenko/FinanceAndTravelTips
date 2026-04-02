"use client";

import { useMemo, useState } from "react";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

type Period = "monthly" | "quarterly" | "yearly";

const periods: { id: Period; label: string; nPerYear: number }[] = [
  { id: "monthly", label: "Ежемесячно", nPerYear: 12 },
  { id: "quarterly", label: "Ежеквартально", nPerYear: 4 },
  { id: "yearly", label: "Раз в год", nPerYear: 1 },
];

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
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("");
  const [period, setPeriod] = useState<Period>("monthly");

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
  }, [principal, rate, years, period]);

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
          Сложные проценты
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Начисление процентов на проценты: итоговая сумма при заданной
          капитализации.
        </p>
      </div>

      <div className="card-panel space-y-5 !shadow-[var(--shadow-card)]">
        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            Начальная сумма, ₽
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            className="field-input"
            placeholder="например 100000"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            Годовая ставка, %
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="field-input"
            placeholder="например 10"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            Срок, лет
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            className="field-input"
            placeholder="например 5"
          />
        </label>

        <fieldset>
          <legend className="mb-2 text-sm text-[var(--muted)]">
            Капитализация
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
            Укажите положительную сумму и срок, неотрицательную ставку.
          </p>
        ) : result ? (
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-5 shadow-inner">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-[var(--muted)]">Итоговая сумма</span>
              <span className="font-semibold text-[var(--foreground)]">
                {rub.format(result.amount)}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-[var(--muted)]">Начисленные проценты</span>
              <span className="font-semibold text-[var(--accent)]">
                {rub.format(result.interest)}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Формула: S = P · (1 + r/m)<sup>m·t</sup>, где m — число периодов
              капитализации в год.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
