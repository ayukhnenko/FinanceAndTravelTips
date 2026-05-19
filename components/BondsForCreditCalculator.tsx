"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  nominalForCouponOnlyNoDrawdown,
  presentValueOfMonthlyPayments,
  semiannualCouponFromNominal,
} from "@/lib/bonds-for-credit";
import { buildReportUiLink } from "@/lib/report-ui-link";
import { openUiReportLink } from "@/lib/open-ui-report";
import CopyApiUiLinkButton from "@/components/CopyApiUiLinkButton";
import { useSyncDefaultRate } from "@/lib/use-sync-default-rate";
import { useI18n } from "@/components/I18nProvider";
import CalculatorInfoInlineButton from "@/components/CalculatorInfoInlineButton";

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

type Props = {
  defaultKeyRatePercent: number;
};

export default function BondsForCreditCalculator({
  defaultKeyRatePercent,
}: Props) {
  const { tr } = useI18n();
  const searchParams = useSearchParams();
  const [monthlyPayment, setMonthlyPayment] = useState(() => searchParams.get("monthlyPayment") ?? "");
  const [monthsLeft, setMonthsLeft] = useState(() => searchParams.get("monthsLeft") ?? "");
  const [remainingDebt, setRemainingDebt] = useState(() => searchParams.get("remainingDebt") ?? "");
  const [keyRate, setKeyRate] = useState(() =>
    searchParams.get("annualYieldPercent") ??
    String(defaultKeyRatePercent).replace(".", ",")
  );
  const [showResult, setShowResult] = useState(false);
  useSyncDefaultRate(searchParams, "annualYieldPercent", defaultKeyRatePercent, setKeyRate);
  useEffect(() => {
    if (searchParams.get("autocalc") === "1") {
      setShowResult(true);
    }
  }, [searchParams]);

  const parsed = useMemo(() => {
    const m = parseFloat(monthlyPayment.replace(/\s/g, "").replace(",", "."));
    const n = parseInt(monthsLeft.replace(/\s/g, ""), 10);
    const k = parseFloat(keyRate.replace(",", "."));
    const dRaw = remainingDebt.trim().replace(/\s/g, "").replace(",", ".");
    const debt =
      dRaw === ""
        ? null
        : parseFloat(dRaw);
    const debtOk =
      debt === null ||
      (Number.isFinite(debt) && debt >= 0);
    return {
      monthly: m,
      months: n,
      key: k,
      debt,
      debtOk,
      valid:
        Number.isFinite(m) &&
        m > 0 &&
        Number.isInteger(n) &&
        n >= 1 &&
        Number.isFinite(k) &&
        k > 0 &&
        debtOk,
    };
  }, [monthlyPayment, monthsLeft, keyRate, remainingDebt]);

  const result = useMemo(() => {
    if (!parsed.valid) return null;
    const pv = presentValueOfMonthlyPayments(
      parsed.monthly,
      parsed.months,
      parsed.key
    );
    if (!Number.isFinite(pv)) return null;
    const semi = semiannualCouponFromNominal(pv, parsed.key);
    const sixMonthsLoan = parsed.monthly * 6;
    const couponOnlyNominal = nominalForCouponOnlyNoDrawdown(
      parsed.monthly,
      parsed.key
    );
    const couponOnlySemi = Number.isFinite(couponOnlyNominal)
      ? semiannualCouponFromNominal(couponOnlyNominal, parsed.key)
      : NaN;
    const annualCoupons = Number.isFinite(couponOnlyNominal)
      ? Math.round(((couponOnlyNominal * parsed.key) / 100) * 100) / 100
      : NaN;
    const annualLoan = parsed.monthly * 12;

    let debtVsPv:
      | { diff: number; debt: number; text: string }
      | null = null;
    if (parsed.debt != null && Number.isFinite(parsed.debt)) {
      const diff = pv - parsed.debt;
      let text: string;
      if (Math.abs(diff) < 1) {
        text = tr(
          "Расчётная сумма вложений близка к оценке остатка долга (в этой модели).",
          "Estimated investment amount is close to your debt balance estimate in this model."
        );
      } else if (diff > 0) {
        text = tr(
          "Расчётная сумма вложений по дисконтированию платежей выше оценки текущего долга: поток платежей «дороже» в приведённой стоимости, чем указанный остаток (возможны разные ставки по кредиту и по облигациям или неточная оценка долга).",
          "Discounted investment estimate is higher than current debt estimate: present value of payments is larger than stated balance (possible due to different loan and bond rates, or a rough debt estimate)."
        );
      } else {
        text = tr(
          "Оценка текущего долга выше расчётной суммы вложений: тело кредита больше, чем приведённая стоимость оставшихся платежей при ставке ЦБ — типично при ставке по кредиту выше ключевой.",
          "Current debt estimate is higher than investment estimate: loan principal is above discounted value of remaining payments at key rate, which is typical when loan rate is above the key rate."
        );
      }
      debtVsPv = { diff, debt: parsed.debt, text };
    }

    return {
      pv,
      semi,
      sixMonthsLoan,
      couponOnlyNominal,
      couponOnlySemi,
      annualCoupons,
      annualLoan,
      debtVsPv,
    };
  }, [parsed, tr]);
  const reportUiLink = useMemo(() => {
    if (!parsed.valid) return null;
    return buildReportUiLink("/api/bonds-cover/report", {
      monthlyPayment: parsed.monthly,
      monthsLeft: parsed.months,
      annualYieldPercent: parsed.key,
      remainingDebt: parsed.debt,
    });
  }, [parsed]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
          {tr("Сколько инвестиций нужно, чтобы покрыть кредит", "How Much Should You Invest to Cover a Loan?")}
        </h1>
        <CalculatorInfoInlineButton infoKey="bonds_cover" />
      </div>

      <div className="card-panel space-y-5 !shadow-[var(--shadow-card)]">
        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Ежемесячный платёж по кредиту, ₽", "Monthly loan payment, ₽")}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={monthlyPayment}
            onChange={(e) => setMonthlyPayment(e.target.value)}
            className="field-input"
            placeholder={tr("например 35000", "e.g. 35000")}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Сколько месяцев ещё выплачивать кредит", "Months remaining to repay")}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={monthsLeft}
            onChange={(e) => setMonthsLeft(e.target.value)}
            className="field-input"
            placeholder="120"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Оценка текущего остатка долга по кредиту, ₽", "Estimated current debt balance, ₽")}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={remainingDebt}
            onChange={(e) => setRemainingDebt(e.target.value)}
            className="field-input"
            placeholder={tr("например 2 500 000", "e.g. 2 500 000")}
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            {tr(
              "Ваш ориентир по телу кредита на сегодня — для сравнения с расчётной суммой вложений. Можно оставить пустым, тогда блок сравнения не покажется.",
              "Your current principal estimate for comparison with calculated investment amount. Leave empty to hide comparison."
            )}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            {tr("Годовая доходность (ключевая ставка ЦБ), %", "Annual yield (CB key rate), %")}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={keyRate}
            onChange={(e) => setKeyRate(e.target.value)}
            className="field-input"
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            {tr(
              "По умолчанию подставляется значение с сервера; при необходимости обновите вручную по данным",
              "Default value is loaded from server; update manually using"
            )}{" "}
            <a
              href="https://www.cbr.ru/hd_base/KeyRate/"
              target="_blank"
              rel="noopener noreferrer"
              className="link-accent"
            >
              {tr("ЦБ РФ", "CBR")}
            </a>
            .
          </span>
        </label>

        {!parsed.valid && (monthlyPayment || monthsLeft) ? (
          <p className="text-sm text-amber-800">
            {tr(
              "Укажите положительный платёж, целое число месяцев не меньше 1 и неотрицательный остаток долга (или оставьте поле долга пустым).",
              "Enter a positive payment, integer months >= 1, and non-negative debt balance (or leave debt field empty)."
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
      </div>

      {showResult && result ? (
        <div className="mt-8 space-y-6">
          <div className="card-panel space-y-4 !shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {tr(
                "1. Приведённая сумма вложений (дисконтирование платежей)",
                "1. Present value investment (discounted payments)"
              )}
            </h2>
            <p className="text-[var(--muted)]">
              {tr(
                "Ориентировочная сумма покупки облигаций при доходности ≈ ключевой ставке и двух купонах в год (модель покрытия потока платежей):",
                "Estimated bond amount at yield close to key rate with two coupons per year (payment stream coverage model):"
              )}
            </p>
            <p className="text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
              {rub.format(result.pv)}
            </p>

            {result.debtVsPv ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm">
                <p className="font-semibold text-sky-950">{tr("Сравнение с долгом", "Debt comparison")}</p>
                <ul className="mt-2 space-y-1.5 text-[var(--muted)]">
                  <li>
                    {tr("Оценка остатка долга:", "Debt estimate:")}{" "}
                    <span className="tabular-nums font-medium text-[var(--foreground)]">
                      {rub.format(result.debtVsPv.debt)}
                    </span>
                  </li>
                  <li>
                    {tr("Расчётная сумма вложений:", "Calculated investment:")}{" "}
                    <span className="tabular-nums font-medium text-[var(--foreground)]">
                      {rub.format(result.pv)}
                    </span>
                  </li>
                  <li>
                    {tr("Разница (вложения − долг):", "Difference (investment − debt):")}{" "}
                    <span
                      className={
                        result.debtVsPv.diff >= 0
                          ? "font-semibold text-amber-800"
                          : "font-semibold text-[var(--accent)]"
                      }
                    >
                      {rub.format(result.debtVsPv.diff)}
                    </span>
                  </li>
                </ul>
                <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
                  {result.debtVsPv.text}
                </p>
              </div>
            ) : null}

            <div className="space-y-2 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
              <p>
                {tr("При такой сумме и ставке", "At this amount and rate of")}{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {parsed.key.toLocaleString("ru-RU", {
                    maximumFractionDigits: 2,
                  })}
                  {tr("% годовых", "% per year")}
                </span>{" "}
                {tr(
                  "один полугодовой купон составляет около",
                  "one semiannual coupon is about"
                )}{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {rub.format(result.semi)}
                </span>
                {tr(
                  ", а на 6 месяцев платежей по кредиту нужно",
                  ", while 6 months of loan payments require"
                )}{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {rub.format(result.sixMonthsLoan)}
                </span>
                .
              </p>
              <p className="text-xs leading-relaxed">
                {tr(
                  `Формула: приведённая стоимость ${parsed.months} платежей при r = ключевая / 12 / 100.`,
                  `Formula: present value of ${parsed.months} payments at r = key rate / 12 / 100.`
                )}
              </p>
            </div>
          </div>

          <div className="card-panel space-y-4 !shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {tr("2. Только купоны, тело не трогаем", "2. Coupons only, principal untouched")}
            </h2>
            <p className="text-[var(--muted)]">
              {tr("Сколько нужно в облигациях при той же годовой доходности (", "Required bond amount at the same annual yield (")}
              {parsed.key.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
              {tr("%), чтобы ", "%), to ")}
              <strong className="font-semibold text-[var(--foreground)]">
                {tr("полностью оплачивать кредит только за счёт купонов", "fully pay loan only from coupons")}
              </strong>{" "}
              {tr(
                "(годовой купонный поток = 12 месячных платежей, накопленная сумма номинала не уменьшается).",
                "(annual coupon flow = 12 monthly payments, nominal amount is preserved)."
              )}
            </p>
            <p className="text-3xl font-bold text-[var(--accent)] sm:text-4xl">
              {Number.isFinite(result.couponOnlyNominal)
                ? rub.format(result.couponOnlyNominal)
                : "—"}
            </p>
            <div className="space-y-2 text-sm text-[var(--muted)]">
              <p>
                {tr("Годовой купонный денежный поток:", "Annual coupon cash flow:")}{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {Number.isFinite(result.annualCoupons)
                    ? rub.format(result.annualCoupons)
                    : "—"}
                </span>{" "}
                {tr(
                  `(${rub.format(result.annualLoan)} в год уходит на платежи по кредиту).`,
                  `(${rub.format(result.annualLoan)} per year goes to loan payments).`
                )}
              </p>
              <p>
                {tr("Один полугодовой купон:", "One semiannual coupon:")}{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {Number.isFinite(result.couponOnlySemi)
                    ? rub.format(result.couponOnlySemi)
                    : "—"}
                </span>{" "}
                ≈{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {rub.format(result.sixMonthsLoan)}
                </span>{" "}
                {tr("за 6 месяцев платежей.", "for 6 months of payments.")}
              </p>
              <p className="text-xs leading-relaxed">
                {tr(
                  "Формула: N = 12 × платёж × 100 / ключевая ставка. Обычно N > приведённой суммы из п.1 при ограниченном сроке кредита: без расходования тела нужен больший номинал.",
                  "Formula: N = 12 × payment × 100 / key rate. Usually N is larger than value from p.1 for finite terms: preserving principal needs higher nominal."
                )}
              </p>
            </div>
            <CopyApiUiLinkButton
              href={reportUiLink}
              idleLabel={tr("Копировать ссылку на расчет", "Copy calculation link")}
              copiedLabel={tr("Ссылка скопирована", "Link copied")}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
