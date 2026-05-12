"use client";

import { useMemo, useState } from "react";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

type Props = {
  defaultRatePercent: number;
};

export default function CreditCardBenefitCalculator({
  defaultRatePercent,
}: Props) {
  const [monthlySpending, setMonthlySpending] = useState("");
  const [graceDays, setGraceDays] = useState("");
  const [savingsRate, setSavingsRate] = useState(() =>
    Number.isFinite(defaultRatePercent)
      ? String(defaultRatePercent).replace(".", ",")
      : "21"
  );

  const parsed = useMemo(() => {
    const spending = parseFloat(
      monthlySpending.replace(/\s/g, "").replace(",", ".")
    );
    const grace = parseFloat(graceDays.replace(",", "."));
    const rate = parseFloat(savingsRate.replace(",", "."));
    const effectiveDays = grace - 17;

    return {
      spending,
      grace,
      rate,
      effectiveDays,
      valid:
        Number.isFinite(spending) &&
        spending >= 0 &&
        Number.isFinite(grace) &&
        grace > 17 &&
        Number.isFinite(rate) &&
        rate >= 0,
    };
  }, [monthlySpending, graceDays, savingsRate]);

  const result = useMemo(() => {
    if (!parsed.valid) return null;
    const monthlyBenefit =
      parsed.spending * (parsed.rate / 100) * (parsed.effectiveDays / 365);
    const yearlyBenefit = monthlyBenefit * 12;
    return { monthlyBenefit, yearlyBenefit };
  }, [parsed]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
        Выгода от оплаты кредиткой
      </h1>

      <div className="card-panel space-y-5 !shadow-[var(--shadow-card)]">
        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            Средний уровень трат за месяц, ₽
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={monthlySpending}
            onChange={(e) => setMonthlySpending(e.target.value)}
            className="field-input"
            placeholder="например 100000"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            Срок грейс-периода, дней
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={graceDays}
            onChange={(e) => setGraceDays(e.target.value)}
            className="field-input"
            placeholder="например 50"
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            В расчете используется значение грейс-периода минус 17 дней
            (равномерные траты в течение месяца + 2 дня на погашение).
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            Ставка по накопительному счету, % годовых
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={savingsRate}
            onChange={(e) => setSavingsRate(e.target.value)}
            className="field-input"
            placeholder={String(defaultRatePercent)}
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            По умолчанию подставлена ключевая ставка Банка России.
          </span>
        </label>

        {!parsed.valid ? (
          <p className="text-sm text-amber-800">
            Проверьте ввод: траты и ставка должны быть неотрицательными, а
            грейс-период — больше 17 дней.
          </p>
        ) : null}

        {result ? (
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-5 shadow-inner">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-[var(--muted)]">
                Эффективный срок размещения в месяц
              </span>
              <span className="font-semibold text-[var(--foreground)]">
                {parsed.effectiveDays.toLocaleString("ru-RU", {
                  maximumFractionDigits: 1,
                })}{" "}
                дн.
              </span>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-[var(--muted)]">
                Экономия за месяц (оценка)
              </span>
              <span className="font-semibold text-[var(--foreground)]">
                {rub.format(result.monthlyBenefit)}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-[var(--muted)]">Экономия за год</span>
              <span className="font-semibold text-[var(--accent)]">
                {rub.format(result.yearlyBenefit)}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
