"use client";

import { useMemo, useState } from "react";
import { annuityMonthlyPayment } from "@/lib/amortization";
import { useI18n } from "@/components/I18nProvider";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

type Props = {
  defaultDepositRatePercent: number;
};

function parseNumber(raw: string): number {
  return parseFloat(raw.replace(/\s/g, "").replace(",", "."));
}

function simulateRentScenario(
  downPayment: number,
  monthlyMortgagePayment: number,
  baseMonthlyRent: number,
  depositRatePercent: number,
  annualGrowthPercent: number,
  months: number
): number {
  const monthlyDepositRate = depositRatePercent / 100 / 12;
  const annualGrowth = annualGrowthPercent / 100;
  let balance = downPayment;

  for (let month = 1; month <= months; month++) {
    balance *= 1 + monthlyDepositRate;
    const yearIndex = Math.floor((month - 1) / 12);
    const rentThisMonth = baseMonthlyRent * Math.pow(1 + annualGrowth, yearIndex);
    balance += monthlyMortgagePayment - rentThisMonth;
  }

  return balance;
}

function simulateRentScenarioWithNoInterest(
  downPayment: number,
  monthlyMortgagePayment: number,
  baseMonthlyRent: number,
  annualGrowthPercent: number,
  months: number
): number {
  const annualGrowth = annualGrowthPercent / 100;
  let balance = downPayment;

  for (let month = 1; month <= months; month++) {
    const yearIndex = Math.floor((month - 1) / 12);
    const rentThisMonth = baseMonthlyRent * Math.pow(1 + annualGrowth, yearIndex);
    balance += monthlyMortgagePayment - rentThisMonth;
  }

  return balance;
}

function simulateBuyScenario(
  apartmentPrice: number,
  annualGrowthPercent: number,
  years: number
): number {
  return apartmentPrice * Math.pow(1 + annualGrowthPercent / 100, years);
}

function breakEvenGrowthPercent(
  apartmentPrice: number,
  downPayment: number,
  monthlyMortgagePayment: number,
  baseMonthlyRent: number,
  depositRatePercent: number,
  taxRatePercent: number,
  years: number
): number | null {
  const months = Math.round(years * 12);
  const diff = (growth: number) => {
    const rentGross = simulateRentScenario(
      downPayment,
      monthlyMortgagePayment,
      baseMonthlyRent,
      depositRatePercent,
      growth,
      months
    );
    const rentNoInterest = simulateRentScenarioWithNoInterest(
      downPayment,
      monthlyMortgagePayment,
      baseMonthlyRent,
      growth,
      months
    );
    const interestIncome = Math.max(0, rentGross - rentNoInterest);
    const taxAmount = interestIncome * (taxRatePercent / 100);
    const rentNet = rentGross - taxAmount;
    return simulateBuyScenario(apartmentPrice, growth, years) - rentNet;
  };

  let left = -30;
  let right = 30;
  let fLeft = diff(left);
  let fRight = diff(right);

  for (let i = 0; i < 6 && fLeft * fRight > 0; i++) {
    left -= 20;
    right += 20;
    fLeft = diff(left);
    fRight = diff(right);
  }

  if (fLeft === 0) return left;
  if (fRight === 0) return right;
  if (fLeft * fRight > 0) return null;

  for (let i = 0; i < 80; i++) {
    const mid = (left + right) / 2;
    const fMid = diff(mid);
    if (Math.abs(fMid) < 1) return mid;
    if (fLeft * fMid <= 0) {
      right = mid;
      fRight = fMid;
    } else {
      left = mid;
      fLeft = fMid;
    }
  }

  return (left + right) / 2;
}

export default function RentVsBuyCalculator({
  defaultDepositRatePercent,
}: Props) {
  const { tr } = useI18n();
  const TAX_RATE_PERCENT = 13;
  const [rentCost, setRentCost] = useState("");
  const [apartmentPrice, setApartmentPrice] = useState("");
  const [mortgageRate, setMortgageRate] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [depositRate, setDepositRate] = useState(() =>
    Number.isFinite(defaultDepositRatePercent)
      ? String(defaultDepositRatePercent).replace(".", ",")
      : "21"
  );
  const [mortgageTermYears, setMortgageTermYears] = useState("20");
  const [showResult, setShowResult] = useState(false);

  const parsed = useMemo(() => {
    const rent = parseNumber(rentCost);
    const price = parseNumber(apartmentPrice);
    const mortRate = parseFloat(mortgageRate.replace(",", "."));
    const down = parseNumber(downPayment);
    const depRate = parseFloat(depositRate.replace(",", "."));
    const termYears = parseFloat(mortgageTermYears.replace(",", "."));
    const loanPrincipal = price - down;
    const termMonths = Math.round(termYears * 12);

    return {
      rent,
      price,
      mortRate,
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
        ? annuityMonthlyPayment(parsed.loanPrincipal, parsed.mortRate, parsed.termMonths)
        : 0;

    const rentFinalGross = simulateRentScenario(
      parsed.down,
      monthlyMortgagePayment,
      parsed.rent,
      parsed.depRate,
      0,
      parsed.termMonths
    );
    const rentFinalNoInterest = simulateRentScenarioWithNoInterest(
      parsed.down,
      monthlyMortgagePayment,
      parsed.rent,
      0,
      parsed.termMonths
    );
    const interestIncome = Math.max(0, rentFinalGross - rentFinalNoInterest);
    const taxAmount = interestIncome * (TAX_RATE_PERCENT / 100);
    const rentFinalNet = rentFinalGross - taxAmount;
    const buyFinal = simulateBuyScenario(parsed.price, 0, parsed.termYears);
    const diff = buyFinal - rentFinalNet;
    const verdict: "buy" | "rent" | "equal" =
      Math.abs(diff) < 1 ? "equal" : diff > 0 ? "buy" : "rent";

    const equalGrowth = breakEvenGrowthPercent(
      parsed.price,
      parsed.down,
      monthlyMortgagePayment,
      parsed.rent,
      parsed.depRate,
      TAX_RATE_PERCENT,
      parsed.termYears
    );

    return {
      monthlyMortgagePayment,
      rentFinalGross,
      rentFinalNet,
      interestIncome,
      taxAmount,
      buyFinal,
      diff,
      verdict,
      equalGrowth,
    };
  }, [parsed]);

  function calculate() {
    if (!parsed.valid) return;
    setShowResult(true);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
        {tr("Аренда против покупки", "Rent vs Buy")}
      </h1>

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
              "По умолчанию подставлена ключевая ставка ЦБ. На эту ставку размещаются первоначальный взнос и разница (платеж по ипотеке минус аренда).",
              "By default, this field uses the Bank of Russia key rate. Both the down payment and the difference (mortgage payment minus rent) are invested at this rate."
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
              "Используем фиксированный платеж по аннуитету и считаем, что ставка ипотеки и ставка вклада неизменны весь срок.",
              "We use a fixed annuity payment and assume mortgage and deposit rates remain unchanged for the whole term."
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
        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              {tr("Платеж по ипотеке (оценка)", "Mortgage payment (estimate)")}
            </p>
            <p className="mt-1 text-xl font-bold text-[var(--foreground)]">
              {rub.format(result.monthlyMortgagePayment)}
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {tr("Капитал в сценарии аренды к концу срока", "Ending capital in the rent scenario")}
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--foreground)]">
                {rub.format(result.rentFinalNet)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {tr(
                  `С учетом налога на процентный доход по ставке ${TAX_RATE_PERCENT.toLocaleString("ru-RU")}%: налог ${rub.format(result.taxAmount)} (процентный доход до налога ${rub.format(result.interestIncome)}, капитал до налога ${rub.format(result.rentFinalGross)}).`,
                  `Includes tax on interest income at ${TAX_RATE_PERCENT.toLocaleString("ru-RU")}%: tax ${rub.format(result.taxAmount)} (pre-tax interest ${rub.format(result.interestIncome)}, pre-tax capital ${rub.format(result.rentFinalGross)}).`
                )}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                {tr("Капитал в сценарии покупки к концу срока", "Ending capital in the buy scenario")}
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--foreground)]">
                {rub.format(result.buyFinal)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 shadow-sm">
            <p className="font-semibold text-[var(--foreground)]">
              {result.verdict === "buy"
                ? tr("Выгоднее покупка", "Buying is better")
                : result.verdict === "rent"
                  ? tr("Выгоднее аренда", "Renting is better")
                  : tr("Варианты почти равнозначны", "Options are almost equivalent")}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {tr("Разница на горизонте", "Difference over")}{" "}
              {parsed.termYears.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}{" "}
              {tr("лет:", "years:")}
              {" "}
              <span className="font-semibold text-[var(--foreground)]">
                {rub.format(Math.abs(result.diff))}
              </span>
              {result.verdict === "equal"
                ? "."
                : result.verdict === "buy"
                  ? tr(" в пользу покупки.", " in favor of buying.")
                  : tr(" в пользу аренды.", " in favor of renting.")}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {tr(
                "Процент изменения цены квартиры (и аренды на тот же процент), при котором варианты сравняются:",
                "Apartment price change rate (and rent by the same rate) at which options become equal:"
              )}
              {" "}
              <span className="font-semibold text-[var(--foreground)]">
                {result.equalGrowth == null
                  ? tr("не удалось определить в разумном диапазоне", "could not be found in reasonable range")
                  : `${result.equalGrowth.toLocaleString("ru-RU", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}% ${tr("в год", "per year")}`}
              </span>
              .
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
