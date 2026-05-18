"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/components/I18nProvider";
import {
  buildMortgageConditionsComparison,
  type MortgageConditionInput,
} from "@/lib/mortgage-conditions-compare";

type MortgageOptionForm = {
  id: string;
  label: string;
  annualRate: string;
  minDownPaymentPercent: string;
  useGracePeriod: boolean;
  graceMonths: string;
  graceRate: string;
};

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const rubCompact = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

function parseAmount(raw: string): number {
  return Number(raw.replace(/\s/g, "").replace(",", "."));
}

function parsePercent(raw: string): number {
  return Number(raw.replace(",", "."));
}

function formatPaymentExpression(params: {
  payment: number;
  interest: number;
  total: number;
}) {
  const { payment, interest, total } = params;
  if (Math.abs(interest) < 0.005) {
    return rub.format(payment);
  }
  return `${rub.format(payment)} - ${rub.format(interest)} = ${rub.format(total)}`;
}

function makeOption(index: number): MortgageOptionForm {
  return {
    id: `option-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    label: `Вариант ${index + 1}`,
    annualRate: "",
    minDownPaymentPercent: "",
    useGracePeriod: false,
    graceMonths: "",
    graceRate: "",
  };
}

function colorForIndex(index: number): string {
  const palette = [
    "#1d4ed8",
    "#16a34a",
    "#ea580c",
    "#9333ea",
    "#db2777",
    "#0891b2",
    "#b45309",
    "#4f46e5",
  ];
  return palette[index % palette.length];
}

type Props = {
  defaultDepositRatePercent: number;
};

export default function MortgageConditionsCompareCalculator({
  defaultDepositRatePercent,
}: Props) {
  const { tr, lang } = useI18n();
  const [propertyPrice, setPropertyPrice] = useState("");
  const [maxDownPayment, setMaxDownPayment] = useState("");
  const [mortgageTermYears, setMortgageTermYears] = useState("20");
  const [depositRate, setDepositRate] = useState(() =>
    Number.isFinite(defaultDepositRatePercent)
      ? String(defaultDepositRatePercent).replace(".", ",")
      : "21"
  );
  const [discountRate, setDiscountRate] = useState("0");
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [showByYears, setShowByYears] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [options, setOptions] = useState<MortgageOptionForm[]>([
    makeOption(0),
    makeOption(1),
  ]);

  const parsed = useMemo(() => {
    const principal = parseAmount(propertyPrice);
    const maxDown = parseAmount(maxDownPayment);
    const termYears = Number(mortgageTermYears.replace(",", "."));
    const termMonths = Math.round(termYears * 12);
    const depositRatePercent = parsePercent(depositRate);
    const discountRatePercent = parsePercent(discountRate);

    const parsedOptions = options.map((option, index) => {
      const annualRatePercent = parsePercent(option.annualRate);
      const minDownPercent = parsePercent(option.minDownPaymentPercent);
      const minDownAmount = principal * (minDownPercent / 100);
      const graceMonths = Number(option.graceMonths.replace(",", "."));
      const graceRatePercent = parsePercent(option.graceRate);
      const graceMonthsRounded = Math.round(graceMonths);
      const hasGrace = option.useGracePeriod;

      const validRate = Number.isFinite(annualRatePercent) && annualRatePercent >= 0;
      const validMinDown =
        Number.isFinite(minDownPercent) && minDownPercent >= 0 && minDownPercent <= 100;
      const validGraceMonths = !hasGrace
        ? true
        : Number.isFinite(graceMonthsRounded) &&
          graceMonthsRounded > 0 &&
          graceMonthsRounded < termMonths;
      const validGraceRate = !hasGrace
        ? true
        : Number.isFinite(graceRatePercent) && graceRatePercent >= 0;
      const downPaymentEnough =
        Number.isFinite(minDownAmount) && Number.isFinite(maxDown) && maxDown >= minDownAmount;

      return {
        id: option.id,
        label:
          option.label.trim() ||
          tr(`Вариант ${index + 1}`, `Option ${index + 1}`),
        annualRatePercent,
        minDownPaymentPercent: minDownPercent,
        minDownAmount,
        graceMonths: hasGrace ? graceMonthsRounded : 0,
        graceRatePercent: hasGrace ? graceRatePercent : null,
        downPaymentEnough,
        valid: validRate && validMinDown && validGraceMonths && validGraceRate,
      };
    });

    const valid =
      Number.isFinite(principal) &&
      principal > 0 &&
      Number.isFinite(maxDown) &&
      maxDown >= 0 &&
      maxDown <= principal &&
      Number.isFinite(termYears) &&
      termYears > 0 &&
      termMonths > 0 &&
      options.length >= 2 &&
      Number.isFinite(depositRatePercent) &&
      depositRatePercent >= 0 &&
      Number.isFinite(discountRatePercent) &&
      discountRatePercent >= 0 &&
      parsedOptions.every((option) => option.valid);

    return {
      principal,
      maxDown,
      termYears,
      termMonths,
      depositRatePercent,
      discountRatePercent,
      parsedOptions,
      valid,
    };
  }, [propertyPrice, maxDownPayment, mortgageTermYears, depositRate, discountRate, options, tr]);

  const comparison = useMemo(() => {
    if (!parsed.valid) return null;
    const conditions: MortgageConditionInput[] = parsed.parsedOptions
      .filter((option) => option.downPaymentEnough)
      .map((option) => ({
        id: option.id,
        label: option.label,
        annualRatePercent: option.annualRatePercent,
        minDownPaymentPercent: option.minDownPaymentPercent,
        gracePeriodMonths: option.graceMonths,
        graceRatePercent: option.graceRatePercent,
      }));

    return buildMortgageConditionsComparison({
      propertyPrice: parsed.principal,
      maxDownPayment: parsed.maxDown,
      annualDepositRatePercent: parsed.depositRatePercent,
      termMonths: parsed.termMonths,
      annualDiscountRatePercent: parsed.discountRatePercent,
      conditions,
    });
  }, [parsed]);

  const excludedOptions = useMemo(
    () =>
      parsed.parsedOptions.filter(
        (option) => option.valid && !option.downPaymentEnough
      ),
    [parsed.parsedOptions]
  );

  const graceMonthsByOptionId = useMemo(() => {
    const map = new Map<string, number>();
    for (const option of parsed.parsedOptions) {
      map.set(option.id, option.graceMonths);
    }
    return map;
  }, [parsed.parsedOptions]);

  const tableRows = useMemo(() => {
    if (!comparison) return [];
    const periodZeroRow: Record<string, number | string> = {
      period: 0,
      periodLabel: showByYears ? tr("Старт", "Start") : undefined,
    };
    for (const option of comparison.options) {
      const movedFromFirstPeriod = option.monthlyExtraPrepayment[0] ?? 0;
      periodZeroRow[`${option.id}:payment`] =
        option.initialDownPayment + movedFromFirstPeriod;
      periodZeroRow[`${option.id}:interest`] = 0;
      periodZeroRow[`${option.id}:total`] =
        option.initialDownPayment + movedFromFirstPeriod;
      periodZeroRow[`${option.id}:prepayment`] = 0;
      periodZeroRow[`${option.id}:comment`] = tr("первый взнос", "first payment");
    }

    if (!showByYears) {
      const monthlyRows = comparison.periods.map((period) => {
        const row: Record<string, number | string> = {
          period,
        };
        for (const option of comparison.options) {
          row[`${option.id}:payment`] = option.monthlyPayments[period - 1] ?? 0;
          row[`${option.id}:interest`] = option.monthlyDepositInterest[period - 1] ?? 0;
          row[`${option.id}:total`] = option.monthlyNetPayments[period - 1] ?? 0;
          row[`${option.id}:prepayment`] =
            period === 1 ? 0 : option.monthlyExtraPrepayment[period - 1] ?? 0;
        }
        return row;
      });
      return [periodZeroRow, ...monthlyRows];
    }

    const yearsCount = Math.ceil(comparison.termMonths / 12);
    const yearlyRows = Array.from({ length: yearsCount }, (_, idx) => {
      const year = idx + 1;
      const endMonth = Math.min(comparison.termMonths, year * 12);
      const startMonth = (year - 1) * 12 + 1;
      const row: Record<string, number | string> = {
        period: year,
        periodLabel: tr(`${year} год`, `Year ${year}`),
      };
      for (const option of comparison.options) {
        let annualPayment = 0;
        let annualNet = 0;
        let annualDepositInterest = 0;
        let annualExtraPrepayment = 0;
        for (let month = startMonth; month <= endMonth; month++) {
          annualPayment += option.monthlyPayments[month - 1] ?? 0;
          annualNet += option.monthlyNetPayments[month - 1] ?? 0;
          annualDepositInterest += option.monthlyDepositInterest[month - 1] ?? 0;
          if (month !== 1) {
            annualExtraPrepayment += option.monthlyExtraPrepayment[month - 1] ?? 0;
          }
        }
        row[`${option.id}:payment`] = annualPayment;
        row[`${option.id}:interest`] = annualDepositInterest;
        row[`${option.id}:total`] = annualNet;
        row[`${option.id}:prepayment`] = annualExtraPrepayment;
      }
      return row;
    });
    return [periodZeroRow, ...yearlyRows];
  }, [comparison, showByYears, tr]);

  const chartRows = useMemo(() => {
    if (!comparison) return [];
    return comparison.periods.map((period) => {
      const row: Record<string, number | string> = {
        period,
        label:
          period % 12 === 0
            ? tr(`${Math.round(period / 12)} год`, `Year ${Math.round(period / 12)}`)
            : String(period),
      };
      for (const option of comparison.options) {
        row[option.id] = option.cumulativeNetPayments[period - 1] ?? 0;
      }
      return row;
    });
  }, [comparison, tr]);

  const prepaymentEvents = useMemo(() => {
    if (!comparison) return [];
    return comparison.options
      .map((option, index) => {
        const monthIndex = option.monthlyExtraPrepayment.findIndex((value) => value > 0);
        if (monthIndex < 0 || monthIndex === 0) return null;
        return {
          optionId: option.id,
          label: option.label,
          month: monthIndex + 1,
          amount: option.monthlyExtraPrepayment[monthIndex],
          color: colorForIndex(index),
        };
      })
      .filter((event): event is NonNullable<typeof event> => event != null);
  }, [comparison]);

  const totalsForSummary = useMemo(() => {
    if (!comparison) return null;
    if (comparison.options.length === 0) return null;
    const byNominal = [...comparison.options].sort(
      (a, b) => a.totalNetPayment - b.totalNetPayment
    );
    const byDiscounted = [...comparison.options].sort(
      (a, b) => a.discountedTotalNetPayment - b.discountedTotalNetPayment
    );
    return {
      bestNominal: byNominal[0],
      secondNominal: byNominal[1] ?? null,
      bestDiscounted: byDiscounted[0],
      secondDiscounted: byDiscounted[1] ?? null,
    };
  }, [comparison]);

  const useDiscountedTotals = applyDiscount && parsed.discountRatePercent > 0;

  function updateOption(id: string, patch: Partial<MortgageOptionForm>) {
    setOptions((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addOption() {
    setOptions((prev) => [...prev, makeOption(prev.length)]);
  }

  function removeOption(id: string) {
    setOptions((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((item) => item.id !== id);
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
        {tr("Сравнение ипотечных условий", "Mortgage Terms Comparison")}
      </h1>

      <div className="card-panel space-y-5 !shadow-[var(--shadow-card)]">
        <div className="grid gap-4 md:grid-cols-2 md:items-end">
          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--muted)]">
              {tr("Стоимость недвижимости, ₽", "Property price, ₽")}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={propertyPrice}
              onChange={(e) => setPropertyPrice(e.target.value)}
              className="field-input"
              placeholder={tr("например 12 000 000", "e.g. 12 000 000")}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--muted)]">
              {tr("Максимальный первоначальный взнос, ₽", "Maximum down payment, ₽")}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={maxDownPayment}
              onChange={(e) => setMaxDownPayment(e.target.value)}
              className="field-input"
              placeholder={tr("например 4 000 000", "e.g. 4 000 000")}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--muted)]">
              {tr("Срок ипотеки, лет", "Mortgage term, years")}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={mortgageTermYears}
              onChange={(e) => setMortgageTermYears(e.target.value)}
              className="field-input"
              placeholder="20"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--muted)]">
              {tr(
                "Ставка размещения первоначального взноса, % годовых",
                "Down payment deposit rate, % per year"
              )}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={depositRate}
              onChange={(e) => setDepositRate(e.target.value)}
              className="field-input"
              placeholder={String(defaultDepositRatePercent)}
            />
          </label>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {tr("Ипотечные условия", "Mortgage options")}
          </h2>
          {options.map((option, index) => (
            <div
              key={option.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={option.label}
                  onChange={(e) => updateOption(option.id, { label: e.target.value })}
                  className="field-input min-w-[220px] flex-1"
                  placeholder={tr(`Вариант ${index + 1}`, `Option ${index + 1}`)}
                />
                <button
                  type="button"
                  onClick={() => removeOption(option.id)}
                  disabled={options.length <= 2}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {tr("Удалить", "Remove")}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3 md:items-end">
                <label className="block">
                  <span className="mb-1.5 block text-sm text-[var(--muted)]">
                    {tr("Ставка, % годовых", "Rate, % per year")}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={option.annualRate}
                    onChange={(e) => updateOption(option.id, { annualRate: e.target.value })}
                    className="field-input"
                    placeholder="14"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm text-[var(--muted)]">
                    {tr(
                      "Минимальный первоначальный взнос, %",
                      "Minimum down payment, %"
                    )}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={option.minDownPaymentPercent}
                    onChange={(e) =>
                      updateOption(option.id, {
                        minDownPaymentPercent: e.target.value,
                      })
                    }
                    className="field-input"
                    placeholder={tr("например 20", "e.g. 20")}
                  />
                </label>

                <div className="block">
                  <span className="mb-1.5 block text-sm text-[var(--muted)]">
                    {tr("Льготный период", "Grace period")}
                  </span>
                  <label className="flex min-h-[42px] items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={option.useGracePeriod}
                      onChange={(e) =>
                        updateOption(option.id, { useGracePeriod: e.target.checked })
                      }
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    <span className="text-sm text-[var(--foreground)]">
                      {tr("Добавить льготный период", "Add grace period")}
                    </span>
                  </label>
                </div>
              </div>

              {option.useGracePeriod ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-end">
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-[var(--muted)]">
                      {tr("Льготный период, мес", "Grace period, months")}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={option.graceMonths}
                      onChange={(e) => updateOption(option.id, { graceMonths: e.target.value })}
                      className="field-input"
                      placeholder="24"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm text-[var(--muted)]">
                      {tr("Льготная ставка, % годовых", "Grace rate, % per year")}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={option.graceRate}
                      onChange={(e) => updateOption(option.id, { graceRate: e.target.value })}
                      className="field-input"
                      placeholder="8"
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ))}

          <button type="button" onClick={addOption} className="btn-primary w-full md:w-auto">
            {tr("Добавить вариант", "Add option")}
          </button>
        </div>

        {!parsed.valid ? (
          <p className="text-sm text-amber-800">
            {tr(
              "Проверьте ввод: стоимость > 0, максимальный взнос в диапазоне [0; стоимость], ставка вклада неотрицательная; в каждом варианте нужна ставка и минимальный первоначальный взнос в процентах (0-100), а льготный период (если включен) — положительный, меньше срока и со своей ставкой.",
              "Check input: property value > 0, max down payment in [0; property value], deposit rate non-negative; each option needs a rate and minimum down payment in percent (0-100), and grace period (if enabled) must be positive, shorter than term, and have its own rate."
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
      </div>

      {showResult && comparison ? (
        <div className="mt-8 space-y-6">
          <div className="card-panel !p-4 pb-2 sm:!p-6 !shadow-[var(--shadow-card)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  {showByYears
                    ? tr("График по годам", "Yearly schedule")
                    : tr("График по месяцам", "Monthly schedule")}
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  {tr(
                    "Формула в ячейке: Платеж по ипотеке - Проценты по вкладу = Итоговый платеж.",
                    "Cell formula: Mortgage payment - Deposit interest = Net payment."
                  )}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  <span className="font-semibold text-green-600">●</span>{" "}
                  {tr(
                    "Зеленым цветом отмечены значения в льготный период.",
                    "Green values indicate payments in the grace period."
                  )}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <input
                  type="checkbox"
                  checked={showByYears}
                  onChange={(e) => setShowByYears(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                {tr("Показывать по годам", "Show by years")}
              </label>
            </div>
            {excludedOptions.length > 0 ? (
              <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {excludedOptions.map((option) => (
                  <p key={option.id}>
                    {tr(
                      `${option.label}: расчет не выполнен — максимальный первоначальный взнос меньше минимального для варианта.`,
                      `${option.label}: not calculated — maximum down payment is lower than the option minimum down payment.`
                    )}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                    <th className="w-[68px] py-1.5 pr-1 font-medium">
                      {showByYears ? tr("Год", "Year") : tr("Период", "Period")}
                    </th>
                    {comparison.options.map((option) => (
                      <th key={option.id} className="py-1.5 pr-1 font-medium">
                        {option.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr
                      key={row.period as number}
                      className="border-b border-[var(--border)] hover:bg-[var(--accent-soft)]/35"
                    >
                      <td className="w-[68px] py-1.5 pr-1 align-top text-[var(--foreground)]">
                        {showByYears
                          ? (row.periodLabel as string)
                          : (row.period as number)}
                      </td>
                      {comparison.options.map((option) => (
                        <td
                          key={option.id}
                          className="py-1.5 pr-1 align-top font-medium leading-tight whitespace-nowrap text-[var(--foreground)]"
                        >
                          <span
                            className={`font-semibold ${
                              !showByYears &&
                              (row.period as number) <=
                                (graceMonthsByOptionId.get(option.id) ?? 0)
                                ? "text-green-600"
                                : ""
                            }`}
                          >
                            {formatPaymentExpression({
                              payment: (row[`${option.id}:payment`] as number) ?? 0,
                              interest: (row[`${option.id}:interest`] as number) ?? 0,
                              total: (row[`${option.id}:total`] as number) ?? 0,
                            })}
                          </span>
                          {(row[`${option.id}:comment`] as string | undefined) ? (
                            <span className="ml-1 inline-block rounded bg-[var(--input-bg)] px-1 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                              {row[`${option.id}:comment`] as string}
                            </span>
                          ) : null}
                          {(row[`${option.id}:prepayment`] as number) > 0 ? (
                            <span className="ml-1 inline-block rounded bg-[var(--accent-soft)] px-1 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                              {tr("+ с депозита", "+ from deposit")}{" "}
                              {rub.format((row[`${option.id}:prepayment`] as number) ?? 0)}
                            </span>
                          ) : null}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={applyDiscount}
                  onChange={(e) => setApplyDiscount(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span className="text-sm text-[var(--foreground)]">
                  {tr(
                    "С учетом ставки дисконтирования",
                    "Use discount rate"
                  )}
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-[var(--muted)]">
                  {tr("Ставка дисконтирования, % годовых", "Discount rate, % per year")}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={discountRate}
                  onChange={(e) => setDiscountRate(e.target.value)}
                  className="field-input"
                  placeholder="0"
                />
              </label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {comparison.options.map((option, index) => (
              <div
                key={option.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
              >
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  {option.label}
                </p>
                <p className="mt-1 text-xl font-bold text-[var(--foreground)]">
                  {rub.format(
                    useDiscountedTotals
                      ? option.discountedTotalNetPayment
                      : option.totalNetPayment
                  )}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {useDiscountedTotals
                    ? tr(
                        "Общая сумма выплат (приведенная стоимость)",
                        "Total net payments (present value)"
                      )
                    : tr(
                        "Общая сумма выплат (с учетом % вклада)",
                        "Total net payments (with deposit interest)"
                      )}
                </p>
                <div className="mt-2 h-1.5 rounded-full" style={{ background: colorForIndex(index) }} />
              </div>
            ))}
          </div>

          <div className="card-panel !p-4 pb-2 sm:!p-6 !shadow-[var(--shadow-card)]">
            <h2 className="mb-1 text-lg font-semibold text-[var(--foreground)]">
              {tr("Сравнительный график накопленных чистых выплат", "Cumulative net payments comparison")}
            </h2>
            <p className="mb-4 text-sm text-[var(--muted)]">
              {tr(
                "Каждая линия показывает чистые выплаты к конкретному месяцу: платеж по кредиту минус проценты от размещенной на вкладе части первоначального взноса.",
                "Each line shows net payments by month: loan payment minus interest earned on the deposit part of the down payment."
              )}
            </p>
            {excludedOptions.length > 0 ? (
              <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {tr(
                  "Варианты с недостаточным максимальным первоначальным взносом исключены из графика.",
                  "Options with insufficient maximum down payment are excluded from the chart."
                )}
              </p>
            ) : null}
            <div className="h-[360px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--chart-grid)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: "var(--chart-tick)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--chart-grid)" }}
                    interval={Math.max(0, Math.floor(parsed.termMonths / 12) - 1)}
                  />
                  <YAxis
                    tick={{ fill: "var(--chart-tick)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => rubCompact.format(v as number)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      boxShadow: "var(--shadow-card)",
                    }}
                    labelStyle={{ color: "var(--foreground)" }}
                    formatter={(value: number, name: string) => [rub.format(value), name]}
                    labelFormatter={(value) =>
                      tr(`Месяц ${value}`, `Month ${value}`)
                    }
                  />
                  <Legend />
                  {prepaymentEvents.map((event) => (
                    <ReferenceLine
                      key={event.optionId}
                      x={event.month}
                      stroke={event.color}
                      strokeDasharray="4 4"
                      ifOverflow="visible"
                      label={{
                        value: tr(
                          `${event.label}: + с депозита`,
                          `${event.label}: + from deposit`
                        ),
                        position: "top",
                        fill: event.color,
                        fontSize: 11,
                      }}
                    />
                  ))}
                  {comparison.options.map((option, index) => (
                    <Line
                      key={option.id}
                      type="monotone"
                      dataKey={option.id}
                      name={option.label}
                      stroke={colorForIndex(index)}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card-panel space-y-4 !shadow-[var(--shadow-card)]">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="font-semibold text-[var(--foreground)]">
                {(() => {
                  if (!totalsForSummary) return "";
                  const best = applyDiscount
                    ? totalsForSummary.bestDiscounted
                    : totalsForSummary.bestNominal;
                  const second = applyDiscount
                    ? totalsForSummary.secondDiscounted
                    : totalsForSummary.secondNominal;
                  if (!second) {
                    return tr(
                      `${best.label} — единственный корректный вариант сравнения.`,
                      `${best.label} is the only valid comparison option.`
                    );
                  }
                  const spread = applyDiscount
                    ? second.discountedTotalNetPayment - best.discountedTotalNetPayment
                    : second.totalNetPayment - best.totalNetPayment;
                  return tr(
                    `Самый выгодный вариант: ${best.label}. Экономия относительно следующего варианта: ${rub.format(Math.max(0, spread))}.`,
                    `Best option: ${best.label}. Savings versus the next option: ${rub.format(Math.max(0, spread))}.`
                  );
                })()}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {applyDiscount
                  ? tr(
                      `Итоги приведены к текущей стоимости по ставке ${parsed.discountRatePercent.toLocaleString(lang === "en" ? "en-US" : "ru-RU", {
                        maximumFractionDigits: 2,
                      })}% годовых.`,
                      `Totals are shown as present value at ${parsed.discountRatePercent.toLocaleString(lang === "en" ? "en-US" : "ru-RU", {
                        maximumFractionDigits: 2,
                      })}% per year.`
                    )
                  : tr(
                      "Итоги показаны в номинальных выплатах без дисконтирования.",
                      "Totals are shown as nominal payments without discounting."
                    )}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
