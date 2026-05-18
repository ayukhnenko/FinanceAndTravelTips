"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});
const decimal = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 4,
});

function discountedValueAfterTerm(
  amount: number,
  years: number,
  discountRatePercent: number
): number {
  if (amount <= 0 || years <= 0) return amount;
  return amount / Math.pow(1 + discountRatePercent / 100, years);
}

type DiscountingCalculatorProps = {
  defaultDiscountRatePercent: number;
};

export default function DiscountingCalculator({
  defaultDiscountRatePercent,
}: DiscountingCalculatorProps) {
  const { tr } = useI18n();
  const [amount, setAmount] = useState("");
  const [years, setYears] = useState("");
  const [rate, setRate] = useState(
    Number.isFinite(defaultDiscountRatePercent) && defaultDiscountRatePercent > 0
      ? String(defaultDiscountRatePercent)
      : ""
  );
  const [showResult, setShowResult] = useState(false);

  const parsed = useMemo(() => {
    const principal = parseFloat(amount.replace(/\s/g, "").replace(",", "."));
    const termYears = parseFloat(years.replace(",", "."));
    const discountRate = parseFloat(rate.replace(",", "."));

    return {
      principal,
      termYears,
      discountRate,
      valid:
        Number.isFinite(principal) &&
        principal > 0 &&
        Number.isFinite(termYears) &&
        termYears > 0 &&
        Number.isFinite(discountRate) &&
        discountRate >= 0,
    };
  }, [amount, years, rate]);

  const result = useMemo(() => {
    if (!parsed.valid) return null;
    const discounted = discountedValueAfterTerm(
      parsed.principal,
      parsed.termYears,
      parsed.discountRate
    );
    return {
      discountedValue: discounted,
      discountLoss: parsed.principal - discounted,
    };
  }, [parsed]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
        {tr(
          "Дисконтирование - будущая стоимость денег",
          "Discounting - Future Value of Money"
        )}
      </h1>

      <div className="card-panel space-y-5 !shadow-[var(--shadow-card)]">
        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Сумма сегодня, ₽", "Amount today, ₽")}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="field-input"
            placeholder={tr("например 100000", "e.g. 100000")}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Срок размещения, лет", "Placement term, years")}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            className="field-input"
            placeholder={tr("например 3", "e.g. 3")}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Ставка дисконтирования, %", "Discount rate, %")}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="field-input"
            placeholder={tr("например 21", "e.g. 21")}
          />
        </label>

        {!parsed.valid ? (
          <p className="text-sm text-amber-800">
            {tr(
              "Укажите положительную сумму сегодня и срок, а также неотрицательную ставку.",
              "Enter a positive amount and term, and a non-negative rate."
            )}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setShowResult(true)}
          disabled={!parsed.valid}
          className="btn-primary w-full"
        >
          {tr("Рассчитать", "Calculate")}
        </button>

        {showResult && result ? (
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-5 shadow-inner">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-[var(--muted)]">
                {tr(
                  "Будущая стоимость денег",
                  "Future value of money"
                )}
              </span>
              <span className="font-semibold text-[var(--foreground)]">
                {rub.format(result.discountedValue)}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-[var(--muted)]">
                {tr("Снижение стоимости", "Value decrease")}
              </span>
              <span className="font-semibold text-[var(--accent)]">
                {rub.format(result.discountLoss)}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)]">
              {tr(
                "Формула: дисконтированная сумма через срок = сумма сегодня / (1 + r)^t.",
                "Formula: discounted amount after term = amount today / (1 + r)^t."
              )}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {tr(
                "Где: r — ставка дисконтирования в долях (ставка, % / 100), t — срок в годах.",
                "Where: r is the discount rate in decimal form (rate, % / 100), t is the term in years."
              )}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {tr(
                `Подстановка: ${rub.format(parsed.principal)} / (1 + ${decimal.format(
                  parsed.discountRate / 100
                )})^${decimal.format(parsed.termYears)} = ${rub.format(
                  result.discountedValue
                )}.`,
                `Substitution: ${rub.format(parsed.principal)} / (1 + ${decimal.format(
                  parsed.discountRate / 100
                )})^${decimal.format(parsed.termYears)} = ${rub.format(
                  result.discountedValue
                )}.`
              )}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
