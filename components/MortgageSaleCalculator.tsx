"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import CalculatorInfoInlineButton from "@/components/CalculatorInfoInlineButton";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function parseNumber(value: string): number {
  return parseFloat(value.replace(/\s/g, "").replace(",", "."));
}

function annualToMonthlyRate(ratePercent: number): number {
  return ratePercent / 100 / 12;
}

function futureValueLumpSum(principal: number, monthlyRate: number, months: number): number {
  return principal * Math.pow(1 + monthlyRate, months);
}

function futureValueMonthlyFlow(monthlyFlow: number, monthlyRate: number, months: number): number {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return monthlyFlow * months;
  return monthlyFlow * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

function futureValueHoldCashFlowWithRentGrowth(
  baseMonthlyRent: number,
  monthlyPayment: number,
  annualRentGrowthPercent: number,
  monthlyRate: number,
  months: number
): number {
  if (months <= 0) return 0;
  const annualGrowth = annualRentGrowthPercent / 100;
  let acc = 0;
  for (let m = 1; m <= months; m++) {
    const yearIndex = Math.floor((m - 1) / 12);
    const rentThisMonth = baseMonthlyRent * Math.pow(1 + annualGrowth, yearIndex);
    const netFlow = rentThisMonth - monthlyPayment;
    acc = acc * (1 + monthlyRate) + netFlow;
  }
  return acc;
}

function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

type Props = {
  defaultNaosPercent: number;
};

export default function MortgageSaleCalculator({ defaultNaosPercent }: Props) {
  const { tr } = useI18n();
  const searchParams = useSearchParams();
  const [propertyValue, setPropertyValue] = useState(() => searchParams.get("propertyValue") ?? "");
  const [debt, setDebt] = useState(() => searchParams.get("debt") ?? "");
  const [monthlyPayment, setMonthlyPayment] = useState(() => searchParams.get("monthlyPayment") ?? "");
  const [monthsLeft, setMonthsLeft] = useState(() => searchParams.get("monthsLeft") ?? "");
  const [rentPayment, setRentPayment] = useState(() => searchParams.get("rentPayment") ?? "");
  const [rentGrowthPercent, setRentGrowthPercent] = useState(() => searchParams.get("rentGrowthPercent") ?? "");
  const [naos, setNaos] = useState(() =>
    searchParams.get("naosPercent") ??
    (Number.isFinite(defaultNaosPercent)
      ? String(defaultNaosPercent).replace(".", ",")
      : "21")
  );
  const [showResult, setShowResult] = useState(false);
  useEffect(() => {
    if (searchParams.get("autocalc") === "1") {
      setShowResult(true);
    }
  }, [searchParams]);

  const parsed = useMemo(() => {
    const value = parseNumber(propertyValue);
    const debtValue = parseNumber(debt);
    const payment = parseNumber(monthlyPayment);
    const months = parseInt(monthsLeft.replace(/\s/g, ""), 10);
    const rentRaw = rentPayment.trim();
    const rent = rentRaw === "" ? 0 : parseNumber(rentRaw);
    const rentGrowthRaw = rentGrowthPercent.trim();
    const rentGrowth = rentGrowthRaw === "" ? 0 : parseFloat(rentGrowthRaw.replace(",", "."));
    const naosValue = parseFloat(naos.replace(",", "."));

    return {
      value,
      debt: debtValue,
      payment,
      months,
      rent,
      rentGrowth,
      naos: naosValue,
      valid:
        Number.isFinite(value) &&
        value > 0 &&
        Number.isFinite(debtValue) &&
        debtValue >= 0 &&
        debtValue <= value &&
        Number.isFinite(payment) &&
        payment >= 0 &&
        Number.isInteger(months) &&
        months > 0 &&
        Number.isFinite(rent) &&
        rent >= 0 &&
        Number.isFinite(rentGrowth) &&
        rentGrowth >= 0 &&
        Number.isFinite(naosValue) &&
        naosValue >= 0,
    };
  }, [propertyValue, debt, monthlyPayment, monthsLeft, rentPayment, rentGrowthPercent, naos]);

  const result = useMemo(() => {
    if (!parsed.valid) return null;

    const monthlyRate = annualToMonthlyRate(parsed.naos);
    const yearsLeft = parsed.months / 12;
    const proceedsAfterSale = parsed.value - parsed.debt;
    const monthlyNetFromHold = parsed.rent - parsed.payment;

    const sellFuture = futureValueLumpSum(
      proceedsAfterSale,
      monthlyRate,
      parsed.months
    );
    const holdCashFlowFuture = futureValueHoldCashFlowWithRentGrowth(
      parsed.rent,
      parsed.payment,
      parsed.rentGrowth,
      monthlyRate,
      parsed.months
    );
    const holdFutureNoGrowth = parsed.value + holdCashFlowFuture;

    const diff = holdFutureNoGrowth - sellFuture;
    const verdict: "hold" | "sell" | "equal" =
      Math.abs(diff) < 1 ? "equal" : diff > 0 ? "hold" : "sell";

    let breakEvenGrowthPercent: number | null = null;
    if (verdict === "sell") {
      const targetTerminalPropertyValue = sellFuture - holdCashFlowFuture;
      if (targetTerminalPropertyValue > 0 && yearsLeft > 0) {
        breakEvenGrowthPercent =
          (Math.pow(targetTerminalPropertyValue / parsed.value, 1 / yearsLeft) - 1) * 100;
      }
    }

    return {
      monthlyRate,
      yearsLeft,
      proceedsAfterSale,
      monthlyNetFromHold,
      rentFirstMonth: parsed.rent,
      rentLastMonth:
        parsed.rent * Math.pow(1 + parsed.rentGrowth / 100, Math.floor((parsed.months - 1) / 12)),
      sellFuture,
      holdCashFlowFuture,
      holdFutureNoGrowth,
      diff,
      verdict,
      breakEvenGrowthPercent,
    };
  }, [parsed]);

  function calculate() {
    if (!parsed.valid) return;
    setShowResult(true);
  }

  const verdictTone = {
    hold: "border-[var(--accent)]/35 bg-[var(--accent-soft)] text-[var(--foreground)]",
    sell: "border-sky-300 bg-sky-50 text-sky-950",
    equal: "border-amber-300 bg-amber-50 text-amber-950",
  } as const;

  const verdictTitle = {
    hold: tr("Выгоднее оставлять квартиру и сдавать", "Keeping and renting out is better"),
    sell: tr("Выгоднее продать квартиру и вложить остаток средств", "Selling and investing the proceeds is better"),
    equal: tr("Оба варианта почти равнозначны", "Both options are almost equivalent"),
  } as const;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
          {tr(
            "Выгодно ли продавать квартиру в ипотеке",
            "Is Selling a Mortgaged Apartment Worth It?"
          )}
        </h1>
        <CalculatorInfoInlineButton infoKey="mortgage_sale" />
      </div>

      <div className="card-panel space-y-5 !shadow-[var(--shadow-card)]">
        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Текущая стоимость квартиры, ₽", "Current apartment value, ₽")}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={propertyValue}
            onChange={(e) => setPropertyValue(e.target.value)}
            className="field-input"
            placeholder={tr("например 12 500 000", "e.g. 12 500 000")}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Остаток долга по ипотеке, ₽", "Remaining mortgage debt, ₽")}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={debt}
            onChange={(e) => setDebt(e.target.value)}
            className="field-input"
            placeholder={tr("например 5 000 000", "e.g. 5 000 000")}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Ежемесячный платеж по ипотеке, ₽", "Monthly mortgage payment, ₽")}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={monthlyPayment}
            onChange={(e) => setMonthlyPayment(e.target.value)}
            className="field-input"
            placeholder={tr("например 65 000", "e.g. 65 000")}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Оставшийся срок ипотеки, месяцев", "Remaining mortgage term, months")}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={monthsLeft}
            onChange={(e) => setMonthsLeft(e.target.value)}
            className="field-input"
            placeholder={tr("например 180", "e.g. 180")}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Арендный платеж (если квартира сдается), ₽/мес", "Rental payment (if rented out), ₽/month")}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={rentPayment}
            onChange={(e) => setRentPayment(e.target.value)}
            className="field-input"
            placeholder={tr("можно оставить пустым", "can be left empty")}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr(
              "Ожидаемый процент ежегодного роста арендного платежа, %",
              "Expected annual rent growth, %"
            )}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={rentGrowthPercent}
            onChange={(e) => setRentGrowthPercent(e.target.value)}
            className="field-input"
            placeholder={tr("можно оставить пустым (0%)", "can be left empty (0%)")}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("НАОС, % годовых", "NAOS, % per year")}
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
              "Ставка вложения средств на срок, равный оставшемуся сроку ипотеки.",
              "Investment rate for a period equal to the remaining mortgage term."
            )}
          </span>
        </label>

        {!parsed.valid ? (
          <p className="text-sm text-amber-800">
            {tr(
              "Проверьте ввод: сумма долга не должна превышать стоимость квартиры, срок — целое число больше нуля, ставки и платежи — неотрицательные.",
              "Check input: debt must not exceed apartment value, term must be a positive integer, and rates/payments must be non-negative."
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

      {showResult && result ? (
        <div className="mt-8 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {tr("Сценарий «Продать и вложить»", "Scenario: sell and invest")}
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--foreground)]">
                {rub.format(result.sellFuture)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {tr(
                  `Из продажи остается ${rub.format(result.proceedsAfterSale)}, далее эта сумма растет под ${pct(parsed.naos)} на ${parsed.months} мес.`,
                  `After sale, ${rub.format(result.proceedsAfterSale)} remains, then it grows at ${pct(parsed.naos)} for ${parsed.months} months.`
                )}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {tr("Сценарий «Оставить и сдавать»", "Scenario: keep and rent out")}
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--foreground)]">
                {rub.format(result.holdFutureNoGrowth)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {tr(
                  `При нулевом росте цены квартиры учитывается сама квартира (${rub.format(parsed.value)}) и месячный поток ${result.monthlyNetFromHold >= 0 ? "+" : ""}${rub.format(result.monthlyNetFromHold)}. Рост аренды: ${pct(parsed.rentGrowth)} в год (от ${rub.format(result.rentFirstMonth)} до ${rub.format(result.rentLastMonth)} в месяц).`,
                  `At zero apartment price growth, we account for the apartment itself (${rub.format(parsed.value)}) and monthly cash flow ${result.monthlyNetFromHold >= 0 ? "+" : ""}${rub.format(result.monthlyNetFromHold)}. Rent growth: ${pct(parsed.rentGrowth)} per year (from ${rub.format(result.rentFirstMonth)} to ${rub.format(result.rentLastMonth)} per month).`
                )}
              </p>
            </div>
          </div>

          <div className={`rounded-2xl border px-5 py-4 ${verdictTone[result.verdict]}`}>
            <p className="font-semibold text-[var(--foreground)]">
              {verdictTitle[result.verdict]}
            </p>
            <p className="mt-2 text-sm leading-relaxed opacity-95">
              {tr("Разница итогового капитала на горизонте", "Capital difference over")}{" "}
              {result.yearsLeft.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}{" "}
              {tr("лет составляет", "years amounts to")}{" "}
              <span className="font-semibold">{rub.format(Math.abs(result.diff))}</span>{" "}
              {tr("в пользу варианта", "in favor of")} «
              {result.verdict === "sell"
                ? tr("продать", "sell")
                : result.verdict === "hold"
                  ? tr("оставить", "keep")
                  : tr("оба", "both")}
              ».
            </p>

            {result.verdict === "sell" ? (
              <p className="mt-2 text-sm leading-relaxed opacity-95">
                {tr(
                  "Чтобы оба варианта стали равновыгодны, квартира должна дорожать в среднем примерно на",
                  "For both options to become equal, apartment should appreciate by approximately"
                )}{" "}
                <span className="font-semibold">
                  {result.breakEvenGrowthPercent != null
                    ? pct(result.breakEvenGrowthPercent)
                    : tr("недоступно для расчета", "not available for calculation")}
                </span>{" "}
                {tr("в год на всем оставшемся сроке.", "per year over the remaining term.")}
              </p>
            ) : null}

            <p className="mt-2 text-xs leading-relaxed opacity-90">
              {tr(
                "Логика расчета: сравниваем итоговый капитал к концу срока ипотеки. В «продать» — инвестируем остаток после закрытия долга. В «оставить» — учитываем стоимость квартиры плюс накопленный эффект от разницы аренды и ежемесячного платежа под ту же ставку НАОС.",
                "Calculation logic: compare final capital at mortgage horizon. In “sell”, we invest proceeds after debt repayment. In “keep”, we account for apartment value plus accumulated effect of rent-payment difference at the same NAOS rate."
              )}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
