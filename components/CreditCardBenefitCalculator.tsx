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

type Props = {
  defaultRatePercent: number;
};

export default function CreditCardBenefitCalculator({
  defaultRatePercent,
}: Props) {
  const { tr } = useI18n();
  const searchParams = useSearchParams();
  const [monthlySpending, setMonthlySpending] = useState(() => searchParams.get("monthlySpending") ?? "");
  const [graceDays, setGraceDays] = useState(() => searchParams.get("graceDays") ?? "");
  const [savingsRate, setSavingsRate] = useState(() =>
    searchParams.get("savingsRatePercent") ??
    (Number.isFinite(defaultRatePercent)
      ? String(defaultRatePercent).replace(".", ",")
      : "21")
  );
  const [showResult, setShowResult] = useState(false);
  useEffect(() => {
    if (searchParams.get("autocalc") === "1") {
      setShowResult(true);
    }
  }, [searchParams]);

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
    const permanentAmount = (parsed.spending * parsed.effectiveDays * 12) / 365;
    const monthlyBenefit =
      parsed.spending * (parsed.rate / 100) * (parsed.effectiveDays / 365);
    const yearlyBenefit = monthlyBenefit * 12;
    return { permanentAmount, monthlyBenefit, yearlyBenefit };
  }, [parsed]);
  const reportUiLink = useMemo(() => {
    if (!parsed.valid) return null;
    return buildReportUiLink("/api/credit-card-benefit/report", {
      monthlySpending: parsed.spending,
      graceDays: parsed.grace,
      savingsRatePercent: parsed.rate,
    });
  }, [parsed]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
          {tr("Выгода от оплаты кредиткой", "Credit Card Spending Benefit")}
        </h1>
        <CalculatorInfoInlineButton infoKey="card_benefit" />
      </div>

      <div className="card-panel space-y-5 !shadow-[var(--shadow-card)]">
        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Средний уровень трат за месяц, ₽", "Average monthly spending, ₽")}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={monthlySpending}
            onChange={(e) => setMonthlySpending(e.target.value)}
            className="field-input"
            placeholder={tr("например 100000", "e.g. 100000")}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Срок грейс-периода, дней", "Grace period, days")}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={graceDays}
            onChange={(e) => setGraceDays(e.target.value)}
            className="field-input"
            placeholder={tr("например 50", "e.g. 50")}
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            {tr(
              "В расчете используется значение грейс-периода минус 17 дней (равномерные траты в течение месяца + 2 дня на погашение).",
              "The calculator uses grace period minus 17 days (spending spread across the month + 2 days to repay)."
            )}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Ставка по накопительному счету, % годовых", "Savings account rate, % per year")}
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
            {tr(
              "По умолчанию подставлена ключевая ставка Банка России.",
              "By default, this field uses the Bank of Russia key rate."
            )}
          </span>
        </label>

        {!parsed.valid ? (
          <p className="text-sm text-amber-800">
            {tr(
              "Проверьте ввод: траты и ставка должны быть неотрицательными, а грейс-период — больше 17 дней.",
              "Please check input: spending and rate must be non-negative, and grace period must be above 17 days."
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
              <span className="text-[var(--muted)]">
                {tr(
                  "Сумма, которая может постоянно лежать на накопительном счете",
                  "Amount you can keep on your savings account permanently"
                )}
              </span>
              <span className="font-semibold text-[var(--foreground)]">
                {rub.format(result.permanentAmount)}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-[var(--muted)]">
                {tr("Экономия за месяц (оценка)", "Monthly savings (estimate)")}
              </span>
              <span className="font-semibold text-[var(--foreground)]">
                {rub.format(result.monthlyBenefit)}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-[var(--muted)]">{tr("Экономия за год", "Savings per year")}</span>
              <span className="font-semibold text-[var(--accent)]">
                {rub.format(result.yearlyBenefit)}
              </span>
            </div>
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
