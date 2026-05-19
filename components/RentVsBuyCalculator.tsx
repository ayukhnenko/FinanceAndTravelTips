"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { annuityMonthlyPayment } from "@/lib/amortization";
import { effectiveCreditRate } from "@/lib/early-repayment";
import {
  buildRentVsBuyProjection,
  depositRateAfterTax,
  findBreakEvenGrowthPercent,
  presentValue,
  totalGrowthPercent,
} from "@/lib/rent-vs-buy";
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

const rubCompact = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

type Props = {
  defaultDepositRatePercent: number;
};

function parseNumber(raw: string): number {
  return parseFloat(raw.replace(/\s/g, "").replace(",", "."));
}

export default function RentVsBuyCalculator({
  defaultDepositRatePercent,
}: Props) {
  const { tr } = useI18n();
  const searchParams = useSearchParams();
  const DEPOSIT_TAX_RATE_PERCENT = 13;
  const [rentCost, setRentCost] = useState(() => searchParams.get("rentCost") ?? "");
  const [apartmentPrice, setApartmentPrice] = useState(() => searchParams.get("apartmentPrice") ?? "");
  const [mortgageRate, setMortgageRate] = useState(() => searchParams.get("mortgageRatePercent") ?? "");
  const [downPayment, setDownPayment] = useState(() => searchParams.get("downPayment") ?? "");
  const [depositRate, setDepositRate] = useState(() =>
    searchParams.get("depositRatePercent") ??
    (Number.isFinite(defaultDepositRatePercent)
      ? String(defaultDepositRatePercent).replace(".", ",")
      : "21")
  );
  const [mortgageTermYears, setMortgageTermYears] = useState(() => searchParams.get("mortgageTermYears") ?? "20");
  const [discountRate, setDiscountRate] = useState(() =>
    Number.isFinite(defaultDepositRatePercent)
      ? String(defaultDepositRatePercent).replace(".", ",")
      : "21"
  );
  const [showResult, setShowResult] = useState(false);
  const [appliedDiscountRate, setAppliedDiscountRate] = useState<number | null>(null);
  useEffect(() => {
    if (searchParams.get("autocalc") === "1") {
      setShowResult(true);
    }
  }, [searchParams]);

  const parsed = useMemo(() => {
    const rent = parseNumber(rentCost);
    const price = parseNumber(apartmentPrice);
    const mortRate = parseFloat(mortgageRate.replace(",", "."));
    const mortRateEffective = effectiveCreditRate(mortRate, true);
    const down = parseNumber(downPayment);
    const depRate = parseFloat(depositRate.replace(",", "."));
    const termYears = parseFloat(mortgageTermYears.replace(",", "."));
    const loanPrincipal = price - down;
    const termMonths = Math.round(termYears * 12);

    return {
      rent,
      price,
      mortRate,
      mortRateEffective,
      down,
      depRate,
      termYears,
      termMonths,
      loanPrincipal,
      valid:
        Number.isFinite(rent) &&
        rent >= 0 &&
        Number.isFinite(price) &&
        price > 0 &&
        Number.isFinite(mortRate) &&
        mortRate >= 0 &&
        Number.isFinite(mortRateEffective) &&
        mortRateEffective >= 0 &&
        Number.isFinite(down) &&
        down >= 0 &&
        down <= price &&
        Number.isFinite(depRate) &&
        depRate >= 0 &&
        Number.isFinite(termYears) &&
        termYears > 0,
    };
  }, [
    rentCost,
    apartmentPrice,
    mortgageRate,
    downPayment,
    depositRate,
    mortgageTermYears,
  ]);

  const result = useMemo(() => {
    if (!parsed.valid) return null;

    const monthlyMortgagePayment =
      parsed.loanPrincipal > 0
        ? annuityMonthlyPayment(
            parsed.loanPrincipal,
            parsed.mortRateEffective,
            parsed.termMonths
          )
        : 0;

    const depRateAfterTaxValue = depositRateAfterTax(parsed.depRate);
    const projection = buildRentVsBuyProjection({
      downPayment: parsed.down,
      apartmentPrice: parsed.price,
      baseMonthlyRent: parsed.rent,
      monthlyMortgagePayment,
      depositRatePercent: depRateAfterTaxValue,
      termYears: parsed.termYears,
      annualGrowthPercent: 0,
    });

    const equalGrowth = findBreakEvenGrowthPercent({
      downPayment: parsed.down,
      apartmentPrice: parsed.price,
      baseMonthlyRent: parsed.rent,
      monthlyMortgagePayment,
      depositRatePercent: depRateAfterTaxValue,
      termYears: parsed.termYears,
    });

    const diff = projection.finalBuyCapital - projection.finalRentCapital;
    const verdict: "buy" | "rent" | "equal" =
      Math.abs(diff) < 1 ? "equal" : diff > 0 ? "buy" : "rent";

    const chartData = projection.yearlyRows.map((row) => ({
      year: row.year,
      yearLabel:
        row.year === 0
          ? tr("Старт", "Start")
          : tr(`${row.year} год`, `Year ${row.year}`),
      rentCapital: row.rentCapital,
      buyCapital: row.buyCapital,
    }));

    return {
      monthlyMortgagePayment,
      mortRateEffective: parsed.mortRateEffective,
      depRateAfterTax: depRateAfterTaxValue,
      projection,
      chartData,
      diff,
      verdict,
      equalGrowth,
    };
  }, [parsed, tr]);

  const displayedCapitals = useMemo(() => {
    if (!result || !parsed.valid) return null;

    const rentNominal = result.projection.finalRentCapital;
    const buyNominal = result.projection.finalBuyCapital;

    const parsedDiscount = parseFloat(discountRate.replace(",", "."));
    const benchmarkRate =
      appliedDiscountRate ??
      (Number.isFinite(parsedDiscount) && parsedDiscount >= 0
        ? parsedDiscount
        : defaultDepositRatePercent);

    const initialBenchmark = parsed.down;
    const rentForCompare =
      appliedDiscountRate != null
        ? presentValue(rentNominal, appliedDiscountRate, parsed.termYears)
        : presentValue(rentNominal, benchmarkRate, parsed.termYears);
    const buyForCompare =
      appliedDiscountRate != null
        ? presentValue(buyNominal, appliedDiscountRate, parsed.termYears)
        : presentValue(buyNominal, benchmarkRate, parsed.termYears);

    const rent = appliedDiscountRate != null ? rentForCompare : rentNominal;
    const buy = appliedDiscountRate != null ? buyForCompare : buyNominal;

    return {
      rent,
      buy,
      diff: buy - rent,
      discounted: appliedDiscountRate != null,
      benchmarkRate,
      initialBenchmark,
      rentBelowInitial: rentForCompare < initialBenchmark - 1,
      buyBelowInitial: buyForCompare < initialBenchmark - 1,
    };
  }, [result, parsed, appliedDiscountRate, discountRate, defaultDepositRatePercent]);
  const reportUiLink = useMemo(() => {
    if (!parsed.valid) return null;
    return buildReportUiLink("/api/rent-vs-buy/report", {
      rentCost: parsed.rent,
      apartmentPrice: parsed.price,
      mortgageRatePercent: parsed.mortRate,
      downPayment: parsed.down,
      depositRatePercent: parsed.depRate,
      mortgageTermYears: parsed.termYears,
    });
  }, [parsed]);

  function calculate() {
    if (!reportUiLink) return;
    setAppliedDiscountRate(null);
    openUiReportLink(reportUiLink);
  }

  function applyDiscount() {
    if (!parsed.valid || !result) return;
    const rate = parseFloat(discountRate.replace(",", "."));
    if (!Number.isFinite(rate) || rate < 0) return;
    setAppliedDiscountRate(rate);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
          {tr("Аренда против покупки", "Rent vs Buy")}
        </h1>
        <CalculatorInfoInlineButton infoKey="rent_vs_buy" />
      </div>

      <div className="card-panel space-y-5 !shadow-[var(--shadow-card)]">
        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Стоимость аренды, ₽/мес", "Rent cost, ₽/month")}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={rentCost}
            onChange={(e) => setRentCost(e.target.value)}
            className="field-input"
            placeholder={tr("например 65 000", "e.g. 65 000")}
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            {tr(
              "Для корректного сравнения арендуемая и рассматриваемая для покупки квартиры должны быть сопоставимы по классу и стоимости.",
              "For a fair comparison, rental and purchase options should be similar in quality and value."
            )}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Стоимость квартиры, ₽", "Apartment price, ₽")}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={apartmentPrice}
            onChange={(e) => setApartmentPrice(e.target.value)}
            className="field-input"
            placeholder={tr("например 12 000 000", "e.g. 12 000 000")}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Ставка по ипотеке, % годовых", "Mortgage rate, % per year")}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={mortgageRate}
            onChange={(e) => setMortgageRate(e.target.value)}
            className="field-input"
            placeholder={tr("например 14", "e.g. 14")}
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            {tr(
              "В расчётах к ставке добавляется +0,5 п.п. — стоимость страховки.",
              "Calculations add +0.5 p.p. to the rate for insurance cost."
            )}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Сумма первоначального взноса, ₽", "Down payment amount, ₽")}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={downPayment}
            onChange={(e) => setDownPayment(e.target.value)}
            className="field-input"
            placeholder={tr("например 3 000 000", "e.g. 3 000 000")}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr(
              "Ставка вклада для сценария аренды, % годовых",
              "Deposit rate for rent scenario, % per year"
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
          <span className="mt-1 block text-xs text-[var(--muted)]">
            {tr(
              `По умолчанию — ключевая ставка ЦБ. Первоначальный взнос и ежемесячная разница между ипотекой и арендой (в пользу меньшего платежа) капитализируются на вкладе. Ставка в расчёте: минус ${DEPOSIT_TAX_RATE_PERCENT}% налога.`,
              `By default — Bank of Russia key rate. Down payment and the monthly mortgage/rent gap (favoring the lower payment) compound on deposit. Rate used: minus ${DEPOSIT_TAX_RATE_PERCENT}% tax.`
            )}
          </span>
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
            placeholder={tr("например 20", "e.g. 20")}
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            {tr(
              "Горизонт сравнения — до полного погашения ипотеки. Платёж по аннуитету, ставки неизменны.",
              "Comparison horizon — until the mortgage is fully repaid. Annuity payment, rates held constant."
            )}
          </span>
        </label>

        {!parsed.valid ? (
          <p className="text-sm text-amber-800">
            {tr(
              "Проверьте ввод: стоимость квартиры должна быть больше нуля, первоначальный взнос не может превышать стоимость, ставки и аренда неотрицательные.",
              "Check input: apartment price must be above zero, down payment cannot exceed price, and rates/rent must be non-negative."
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
        <div className="mt-8 space-y-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              {tr("Платеж по ипотеке (оценка)", "Mortgage payment (estimate)")}
            </p>
            <p className="mt-1 text-xl font-bold text-[var(--foreground)]">
              {rub.format(result.monthlyMortgagePayment)}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {tr(
                `Ставка в расчёте: ${result.mortRateEffective.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% (с учётом +0,5 п.п. страховки). Ставка вклада: ${result.depRateAfterTax.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%.`,
                `Rate used: ${result.mortRateEffective.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% (including +0.5 p.p. insurance). Deposit rate: ${result.depRateAfterTax.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%.`
              )}
            </p>
          </div>

          <div className="card-panel !p-4 pb-2 sm:!p-6 !shadow-[var(--shadow-card)]">
            <h2 className="mb-1 text-lg font-semibold text-[var(--foreground)]">
              {tr("Капитализация активов по годам", "Asset growth by year")}
            </h2>
            <p className="mb-4 text-sm text-[var(--muted)]">
              {tr(
                "Аренда — депозит (взнос + разница, если ипотека дороже). Покупка — квартира + накопления с разницы, если ипотека дешевле аренды.",
                "Rent — deposit (down payment + gap when mortgage is higher). Buy — apartment + savings from the gap when mortgage is lower than rent."
              )}
            </p>

            <div className="mb-6 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                    <th className="py-2 pr-4 font-medium">{tr("Год", "Year")}</th>
                    <th className="py-2 pr-4 font-medium">
                      {tr("Аренда (депозит)", "Rent (deposit)")}
                    </th>
                    <th className="py-2 font-medium">
                      {tr("Накопления ипотека − аренда", "Savings (mortgage − rent)")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.projection.yearlyRows.map((row) => (
                    <tr key={row.year} className="border-b border-[var(--border)]">
                      <td className="py-2.5 pr-4 text-[var(--foreground)]">
                        {row.year === 0
                          ? tr("Старт", "Start")
                          : row.year.toLocaleString("ru-RU")}
                      </td>
                      <td className="py-2.5 pr-4 font-medium text-[var(--foreground)]">
                        {rub.format(row.rentCapital)}
                      </td>
                      <td className="py-2.5 font-medium text-[var(--foreground)]">
                        {row.buySavings > 0 ? (
                          rub.format(row.buySavings)
                        ) : (
                          <span className="font-normal text-[var(--muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[var(--border)] bg-[var(--input-bg)]">
                    <td className="py-3 pr-4 font-medium text-[var(--foreground)]">
                      {tr("Стоимость квартиры", "Apartment value")}
                    </td>
                    <td className="py-3 pr-4 text-[var(--muted)]">—</td>
                    <td className="py-3 font-semibold text-[var(--foreground)]">
                      {rub.format(result.projection.yearlyRows.at(-1)!.buyApartmentValue)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="h-[340px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={result.chartData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--chart-grid)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="yearLabel"
                    tick={{ fill: "var(--chart-tick)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--chart-grid)" }}
                    interval="preserveStartEnd"
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
                    formatter={(value: number, name: string) => [
                      rub.format(value),
                      name === "rentCapital"
                        ? tr("Аренда (депозит)", "Rent (deposit)")
                        : tr("Покупка (итого)", "Buy (total)"),
                    ]}
                  />
                  <Legend
                    formatter={(value) =>
                      value === "rentCapital"
                        ? tr("Аренда (депозит)", "Rent (deposit)")
                        : tr("Покупка (итого)", "Buy (total)")
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="rentCapital"
                    name="rentCapital"
                    stroke="#0077c8"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#0077c8" }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="buyCapital"
                    name="buyCapital"
                    stroke="#21a038"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#21a038" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1">
                <span className="mb-1.5 block text-sm text-[var(--muted)]">
                  {tr("Ставка дисконтирования, % годовых", "Discount rate, % per year")}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={discountRate}
                  onChange={(e) => setDiscountRate(e.target.value)}
                  className="field-input"
                  placeholder={String(defaultDepositRatePercent)}
                />
              </label>
              <button
                type="button"
                onClick={applyDiscount}
                className="btn-primary shrink-0 sm:w-auto sm:px-8"
              >
                {tr("Пересчитать", "Recalculate")}
              </button>
            </div>
            <p className="mb-2 text-xs text-[var(--muted)]">
              {tr(
                "При применении ставки дисконтирования суммы ниже показаны в эквиваленте текущих денег (приведённая стоимость).",
                "When a discount rate is applied, the amounts below are shown in today’s money (present value)."
              )}
            </p>
          </div>

          {displayedCapitals ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div
                className={`rounded-xl border bg-[var(--card)] p-4 shadow-sm ${
                  displayedCapitals.rentBelowInitial
                    ? "border-red-400 bg-red-50/40"
                    : "border-[var(--border)]"
                }`}
              >
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  {tr("Капитал: аренда (депозит)", "Capital: rent (deposit)")}
                </p>
                <p
                  className={`mt-1 text-xl font-bold ${
                    displayedCapitals.rentBelowInitial
                      ? "text-red-600"
                      : "text-[var(--foreground)]"
                  }`}
                >
                  {rub.format(displayedCapitals.rent)}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {displayedCapitals.discounted
                    ? tr(
                        `приведённая стоимость, ставка ${appliedDiscountRate!.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`,
                        `present value at ${appliedDiscountRate!.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`
                      )
                    : tr("к концу срока ипотеки", "at mortgage payoff")}
                </p>
                {displayedCapitals.rentBelowInitial ? (
                  <p className="mt-1 text-xs text-red-600">
                    {tr(
                      `ниже первоначального взноса (${rub.format(displayedCapitals.initialBenchmark)}) с учётом дисконта ${displayedCapitals.benchmarkRate.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`,
                      `below down payment (${rub.format(displayedCapitals.initialBenchmark)}) at ${displayedCapitals.benchmarkRate.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}% discount`
                    )}
                  </p>
                ) : null}
              </div>
              <div
                className={`rounded-xl border bg-[var(--card)] p-4 shadow-sm ${
                  displayedCapitals.buyBelowInitial
                    ? "border-red-400 bg-red-50/40"
                    : "border-[var(--border)]"
                }`}
              >
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  {tr("Капитал: покупка", "Capital: buy")}
                </p>
                <p
                  className={`mt-1 text-xl font-bold ${
                    displayedCapitals.buyBelowInitial
                      ? "text-red-600"
                      : "text-[var(--foreground)]"
                  }`}
                >
                  {rub.format(displayedCapitals.buy)}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {displayedCapitals.discounted
                    ? tr(
                        `приведённая стоимость, ставка ${appliedDiscountRate!.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`,
                        `present value at ${appliedDiscountRate!.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`
                      )
                    : (() => {
                        const last = result.projection.yearlyRows.at(-1)!;
                        if (last.buySavings > 0) {
                          return tr(
                            `квартира ${rub.format(last.buyApartmentValue)} + накопления ${rub.format(last.buySavings)}`,
                            `apartment ${rub.format(last.buyApartmentValue)} + savings ${rub.format(last.buySavings)}`
                          );
                        }
                        return tr("квартира без роста цены", "apartment at unchanged price");
                      })()}
                </p>
                {displayedCapitals.buyBelowInitial ? (
                  <p className="mt-1 text-xs text-red-600">
                    {tr(
                      `ниже первоначального взноса (${rub.format(displayedCapitals.initialBenchmark)}) с учётом дисконта ${displayedCapitals.benchmarkRate.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`,
                      `below down payment (${rub.format(displayedCapitals.initialBenchmark)}) at ${displayedCapitals.benchmarkRate.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}% discount`
                    )}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 shadow-sm">
            <p className="font-semibold text-[var(--foreground)]">
              {(() => {
                const diff = displayedCapitals?.diff ?? result.diff;
                const verdict =
                  Math.abs(diff) < 1 ? "equal" : diff > 0 ? "buy" : "rent";
                return verdict === "buy"
                  ? tr("Выгоднее покупка", "Buying is better")
                  : verdict === "rent"
                    ? tr("Выгоднее аренда", "Renting is better")
                    : tr("Варианты почти равнозначны", "Options are almost equivalent");
              })()}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {tr("Разница капитала", "Capital difference")}
              {displayedCapitals?.discounted
                ? tr(" (приведённая):", " (present value):")
                : tr(" к концу срока:", " at payoff:")}{" "}
              <span className="font-semibold text-[var(--foreground)]">
                {rub.format(Math.abs(displayedCapitals?.diff ?? result.diff))}
              </span>
              {(() => {
                const diff = displayedCapitals?.diff ?? result.diff;
                const verdict =
                  Math.abs(diff) < 1 ? "equal" : diff > 0 ? "buy" : "rent";
                return verdict === "equal"
                  ? "."
                  : verdict === "buy"
                    ? tr(" в пользу покупки.", " in favor of buying.")
                    : tr(" в пользу аренды.", " in favor of renting.");
              })()}
            </p>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {tr(
                "При каком ежегодном изменении (росте или падении) стоимости квартиры и арендного платежа (одинаковый % в год) варианты сравняются:",
                "Annual change rate (growth or decline) of apartment price and rent (same % per year) at which options are equal:"
              )}
              {" "}
              <span className="font-semibold text-[var(--foreground)]">
                {result.equalGrowth == null
                  ? tr("не удалось определить в разумном диапазоне", "could not be found in reasonable range")
                  : (() => {
                      const annual = result.equalGrowth;
                      const total = totalGrowthPercent(annual, parsed.termYears);
                      const fmt = (n: number) =>
                        n.toLocaleString("ru-RU", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        });
                      const annualStr = `${annual >= 0 ? "+" : ""}${fmt(annual)}% ${tr("в год", "per year")}`;
                      const totalStr = `${total >= 0 ? "+" : ""}${fmt(total)}% ${tr("за", "over")} ${parsed.termYears.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ${tr("лет", "years")}`;
                      return `${annualStr} (${totalStr})`;
                    })()}
              </span>
              .
            </p>
            <div className="mt-3">
              <CopyApiUiLinkButton
                href={reportUiLink}
                idleLabel={tr("Копировать ссылку на расчет", "Copy calculation link")}
                copiedLabel={tr("Ссылка скопирована", "Link copied")}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
