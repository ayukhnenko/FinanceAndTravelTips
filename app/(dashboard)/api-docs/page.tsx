"use client";

import Link from "next/link";
import { useState } from "react";

type ApiDocItem = {
  title: string;
  endpoint: string;
  sample: string;
  /** Страница UI вместо ?format=ui; null — кнопку не показывать */
  uiHref?: string | null;
  inputParams: Array<{ name: string; description: string }>;
  outputParams: Array<{ name: string; description: string }>;
  jsonExample: string;
};

function resolveJsonHref(sample: string): string {
  return sample.replace(/\s*\(POST\)\s*$/i, "").trim();
}

function resolveUiHref(item: ApiDocItem): string | null {
  if (item.uiHref === null) return null;
  if (item.uiHref) return item.uiHref;
  return toUiSampleUrl(resolveJsonHref(item.sample));
}

function toUiSampleUrl(sample: string): string {
  if (sample.includes("format=json")) {
    return sample.replace("format=json", "format=ui");
  }
  const separator = sample.includes("?") ? "&" : "?";
  return `${sample}${separator}format=ui`;
}

const items: ApiDocItem[] = [
  {
    title: "Текущая ключевая ставка ЦБ",
    endpoint: "/api/key-rate",
    sample: "/api/key-rate",
    uiHref: "/key-rate",
    inputParams: [],
    outputParams: [
      { name: "rate", description: "Текущая ставка, % годовых" },
      { name: "date", description: "Актуально на (YYYY-MM-DD)" },
    ],
    jsonExample: `{
  "rate": 14.5,
  "date": "2026-05-19"
}`,
  },
  {
    title: "Выгодно ли гасить кредит досрочно",
    endpoint: "/api/early-repayment/report",
    sample:
      "/api/early-repayment/report?rate=12.5&benchmarkRate=18.2&isMortgage=true&format=json",
    inputParams: [
      { name: "rate", description: "Ставка по кредиту, % годовых (>= 0)" },
      { name: "benchmarkRate", description: "Ставка вклада/облигаций, % годовых (>= 0)" },
      { name: "isMortgage", description: "Признак ипотеки: true/false" },
      { name: "format", description: "Формат ответа: json, ui (по умолчанию json)" },
    ],
    outputParams: [
      { name: "output.effectiveCreditRate", description: "Эффективная ставка кредита" },
      { name: "output.benchmarkForComparison", description: "Ставка ориентира для сравнения" },
      { name: "output.verdict.code", description: "Код рекомендации" },
    ],
    jsonExample: `{
  "input": { "rate": 12.5, "benchmarkRate": 18.2, "isMortgage": true },
  "output": { "effectiveCreditRate": 13, "benchmarkForComparison": 18.2, "verdict": { "code": "invest_strong" } }
}`,
  },
  {
    title: "Сколько инвестиций нужно, чтобы покрыть кредит",
    endpoint: "/api/bonds-cover/report",
    sample:
      "/api/bonds-cover/report?monthlyPayment=35000&monthsLeft=120&annualYieldPercent=18&remainingDebt=2500000&format=json",
    inputParams: [
      { name: "monthlyPayment", description: "Ежемесячный платеж (> 0)" },
      { name: "monthsLeft", description: "Оставшиеся месяцы (> 0)" },
      { name: "annualYieldPercent", description: "Годовая доходность (> 0)" },
      { name: "remainingDebt", description: "Оценка остатка долга (опционально, >= 0)" },
      { name: "format", description: "json, ui" },
    ],
    outputParams: [
      { name: "output.presentValueInvestment", description: "Приведенная сумма вложений" },
      { name: "output.couponOnlyNominal", description: "Номинал для покрытия только купонами" },
      { name: "output.debtComparison", description: "Сравнение с остатком долга (если передан)" },
    ],
    jsonExample: `{
  "input": {
    "monthlyPayment": 35000,
    "monthsLeft": 120,
    "annualYieldPercent": 18,
    "remainingDebt": 2500000
  },
  "output": {
    "presentValueInvestment": 2386561.48,
    "couponOnlyNominal": 2333333.33
  }
}`,
  },
  {
    title: "Выгода от оплаты кредиткой",
    endpoint: "/api/credit-card-benefit/report",
    sample:
      "/api/credit-card-benefit/report?monthlySpending=100000&graceDays=50&savingsRatePercent=18&format=json",
    inputParams: [
      { name: "monthlySpending", description: "Траты в месяц (>= 0)" },
      { name: "graceDays", description: "Грейс-период в днях (> 17)" },
      { name: "savingsRatePercent", description: "Ставка накопительного счета (>= 0)" },
      { name: "format", description: "json, ui" },
    ],
    outputParams: [
      { name: "output.permanentAmount", description: "Сумма, которая может лежать на счете постоянно" },
      { name: "output.monthlyBenefit", description: "Оценка выгоды в месяц" },
      { name: "output.yearlyBenefit", description: "Оценка выгоды в год" },
    ],
    jsonExample: `{
  "input": {
    "monthlySpending": 100000,
    "graceDays": 50,
    "savingsRatePercent": 18
  },
  "output": {
    "permanentAmount": 108493.15,
    "monthlyBenefit": 1627.4,
    "yearlyBenefit": 19528.8
  }
}`,
  },
  {
    title: "Выгодно ли продавать квартиру в ипотеке",
    endpoint: "/api/mortgage-sale/report",
    sample:
      "/api/mortgage-sale/report?propertyValue=12500000&debt=5000000&monthlyPayment=65000&monthsLeft=180&rentPayment=70000&rentGrowthPercent=5&naosPercent=18&format=json",
    inputParams: [
      { name: "propertyValue", description: "Текущая стоимость квартиры (> 0)" },
      { name: "debt", description: "Остаток долга (>= 0, <= propertyValue)" },
      { name: "monthlyPayment", description: "Ежемесячный платеж по ипотеке (>= 0)" },
      { name: "monthsLeft", description: "Оставшийся срок в месяцах (> 0)" },
      { name: "rentPayment", description: "Арендный платеж (опционально, >= 0)" },
      { name: "rentGrowthPercent", description: "Рост аренды в год (опционально, >= 0)" },
      { name: "naosPercent", description: "Ставка размещения средств (>= 0)" },
      { name: "format", description: "json, ui" },
    ],
    outputParams: [
      { name: "output.sellFuture", description: "Итог капитала при продаже" },
      { name: "output.holdFuture", description: "Итог капитала при удержании" },
      { name: "output.verdict", description: "Рекомендация: sell|hold|equal" },
    ],
    jsonExample: `{
  "input": {
    "propertyValue": 12500000,
    "debt": 5000000,
    "monthlyPayment": 65000,
    "monthsLeft": 180,
    "rentPayment": 70000,
    "rentGrowthPercent": 5,
    "naosPercent": 18
  },
  "output": {
    "sellFuture": 10543520.89,
    "holdFuture": 13251108.33,
    "verdict": "hold"
  }
}`,
  },
  {
    title: "Сравнение ипотечных условий",
    endpoint: "/api/mortgage-conditions-compare/report",
    sample:
      "/api/mortgage-conditions-compare/report?propertyPrice=12000000&maxDownPayment=4000000&annualDepositRatePercent=18&termMonths=240&conditions=[{\"id\":\"a\",\"label\":\"Вариант 1\",\"annualRatePercent\":14,\"minDownPaymentPercent\":20,\"gracePeriodMonths\":0,\"graceRatePercent\":null},{\"id\":\"b\",\"label\":\"Вариант 2\",\"annualRatePercent\":13.5,\"minDownPaymentPercent\":25,\"gracePeriodMonths\":24,\"graceRatePercent\":8}]&format=json",
    inputParams: [
      { name: "propertyPrice", description: "Стоимость недвижимости (> 0)" },
      { name: "maxDownPayment", description: "Максимальный первоначальный взнос (>= 0)" },
      { name: "annualDepositRatePercent", description: "Ставка размещения взноса (>= 0)" },
      { name: "termMonths", description: "Срок ипотеки в месяцах (> 0)" },
      { name: "conditions", description: "JSON-массив условий (минимум 2 варианта)" },
      { name: "annualDiscountRatePercent", description: "Ставка дисконтирования (опционально, >= 0)" },
      { name: "format", description: "json, ui" },
    ],
    outputParams: [
      { name: "output.options", description: "Массив итогов по вариантам" },
      { name: "output.bestByNominal", description: "Лучший вариант без дисконтирования" },
      { name: "output.bestByDiscounted", description: "Лучший вариант с учетом дисконтирования" },
    ],
    jsonExample: `{
  "input": {
    "propertyPrice": 12000000,
    "maxDownPayment": 4000000,
    "annualDepositRatePercent": 18,
    "termMonths": 240
  },
  "output": {
    "bestByNominal": "Вариант 2",
    "bestByDiscounted": "Вариант 2"
  }
}`,
  },
  {
    title: "Аренда против покупки",
    endpoint: "/api/rent-vs-buy/report",
    sample:
      "/api/rent-vs-buy/report?rentCost=65000&apartmentPrice=12000000&mortgageRatePercent=14&downPayment=3000000&depositRatePercent=18&mortgageTermYears=20&format=json",
    inputParams: [
      { name: "rentCost", description: "Ежемесячная аренда (>= 0)" },
      { name: "apartmentPrice", description: "Стоимость квартиры (> 0)" },
      { name: "mortgageRatePercent", description: "Ставка ипотеки (>= 0)" },
      { name: "downPayment", description: "Первоначальный взнос (>= 0, <= apartmentPrice)" },
      { name: "depositRatePercent", description: "Ставка депозита для сценария аренды (>= 0)" },
      { name: "mortgageTermYears", description: "Срок ипотеки в годах (> 0)" },
      { name: "format", description: "json, ui" },
    ],
    outputParams: [
      { name: "output.finalRentCapital", description: "Итоговый капитал в сценарии аренды" },
      { name: "output.finalBuyCapital", description: "Итоговый капитал в сценарии покупки" },
      { name: "output.verdict", description: "Рекомендация: buy|rent|equal" },
    ],
    jsonExample: `{
  "input": {
    "rentCost": 65000,
    "apartmentPrice": 12000000,
    "mortgageRatePercent": 14,
    "downPayment": 3000000,
    "depositRatePercent": 18,
    "mortgageTermYears": 20
  },
  "output": {
    "finalRentCapital": 18241003.27,
    "finalBuyCapital": 16892555.12,
    "verdict": "rent"
  }
}`,
  },
  {
    title: "Калькулятор сложных процентов",
    endpoint: "/api/compound/report",
    sample:
      "/api/compound/report?principal=100000&annualRatePercent=12&years=5&period=monthly&format=json",
    inputParams: [
      { name: "principal", description: "Начальная сумма (> 0)" },
      { name: "annualRatePercent", description: "Годовая ставка (>= 0)" },
      { name: "years", description: "Срок в годах (> 0)" },
      { name: "period", description: "Капитализация: monthly|quarterly|yearly (опционально)" },
      { name: "format", description: "json, ui" },
    ],
    outputParams: [
      { name: "output.amount", description: "Итоговая сумма" },
      { name: "output.interest", description: "Начисленные проценты" },
    ],
    jsonExample: `{
  "input": {
    "principal": 100000,
    "annualRatePercent": 12,
    "years": 5,
    "period": "monthly"
  },
  "output": { "amount": 181669.67, "interest": 81669.67 }
}`,
  },
  {
    title: "Дисконтирование",
    endpoint: "/api/discounting/report",
    sample:
      "/api/discounting/report?amount=100000&years=3&discountRatePercent=21&format=json",
    inputParams: [
      { name: "amount", description: "Сумма сегодня (> 0)" },
      { name: "years", description: "Срок в годах (> 0)" },
      { name: "discountRatePercent", description: "Ставка дисконтирования (>= 0)" },
      { name: "format", description: "json, ui" },
    ],
    outputParams: [
      { name: "output.discountedValue", description: "Будущая стоимость после дисконтирования" },
      { name: "output.discountLoss", description: "Потеря стоимости" },
    ],
    jsonExample: `{
  "input": {
    "amount": 100000,
    "years": 3,
    "discountRatePercent": 21
  },
  "output": { "discountedValue": 56447.83, "discountLoss": 43552.17 }
}`,
  },
  {
    title: "Кредитный калькулятор",
    endpoint: "/api/loan/report",
    sample:
      "/api/loan/report?principal=3000000&annualRatePercent=12&termYears=20&paymentType=annuity&sampleLimit=6&format=json",
    inputParams: [
      { name: "principal", description: "Сумма кредита (> 0)" },
      { name: "annualRatePercent", description: "Ставка в год (>= 0)" },
      { name: "termYears", description: "Срок в годах (> 0)" },
      { name: "paymentType", description: "Тип платежа: annuity|differentiated (опционально)" },
      { name: "sampleLimit", description: "Сколько строк графика вернуть (опционально)" },
      { name: "format", description: "json, ui" },
    ],
    outputParams: [
      { name: "output.firstPayment", description: "Первый платеж" },
      { name: "output.lastPayment", description: "Последний платеж" },
      { name: "output.totalInterest", description: "Суммарные проценты" },
      { name: "output.scheduleSample", description: "Первые строки графика платежей" },
    ],
    jsonExample: `{
  "input": {
    "principal": 3000000,
    "annualRatePercent": 12,
    "termYears": 20,
    "paymentType": "annuity"
  },
  "output": {
    "firstPayment": 33017.16,
    "lastPayment": 33017.16,
    "totalInterest": 4924118.4
  }
}`,
  },
];

export default function ApiDocsPage() {
  const [openExample, setOpenExample] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
        Описание API
      </h1>
      <div className="mt-8 space-y-4">
        {items.map((item) => {
          const itemKey = `${item.endpoint}-${item.title}`;
          const jsonHref = resolveJsonHref(item.sample);
          const uiHref = resolveUiHref(item);
          return (
          <section key={itemKey} className="card-panel space-y-2">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {item.title}
            </h2>
            <code className="block overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm">
              {item.endpoint}
            </code>
            <code className="block overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm">
              {item.sample}
            </code>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={jsonHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
              >
                Открыть json
              </a>
              {uiHref ? (
                <a
                  href={uiHref}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
                >
                  Открыть ui
                </a>
              ) : null}
            </div>
            <h3 className="pt-2 text-sm font-semibold text-[var(--foreground)]">
              Входные параметры
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]">
              {item.inputParams.map((p) => (
                <li key={`${item.endpoint}-in-${p.name}`}>
                  <code>{p.name}</code> - {p.description}
                </li>
              ))}
            </ul>
            <h3 className="pt-2 text-sm font-semibold text-[var(--foreground)]">
              Выходные параметры (JSON)
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]">
              {item.outputParams.map((p) => (
                <li key={`${item.endpoint}-out-${p.name}`}>
                  <code>{p.name}</code> - {p.description}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() =>
                setOpenExample((current) =>
                  current === itemKey ? null : itemKey
                )
              }
              className="link-accent text-left text-sm"
            >
              Раскрыть
            </button>
            {openExample === itemKey ? (
              <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--foreground)]">
                {item.jsonExample}
              </pre>
            ) : null}
          </section>
          );
        })}
      </div>

      <div className="mt-6">
        <Link href="/" className="link-accent text-sm">
          На главную
        </Link>
      </div>
    </div>
  );
}
