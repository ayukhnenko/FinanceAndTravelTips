"use client";

import { useMemo, useState } from "react";
import {
  nominalForCouponOnlyNoDrawdown,
  presentValueOfMonthlyPayments,
  semiannualCouponFromNominal,
} from "@/lib/bonds-for-credit";

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
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [monthsLeft, setMonthsLeft] = useState("");
  const [remainingDebt, setRemainingDebt] = useState("");
  const [keyRate, setKeyRate] = useState(() =>
    String(defaultKeyRatePercent).replace(".", ",")
  );
  const [showResult, setShowResult] = useState(false);

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
        text =
          "Расчётная сумма вложений близка к оценке остатка долга (в этой модели).";
      } else if (diff > 0) {
        text =
          "Расчётная сумма вложений по дисконтированию платежей выше оценки текущего долга: поток платежей «дороже» в приведённой стоимости, чем указанный остаток (возможны разные ставки по кредиту и по облигациям или неточная оценка долга).";
      } else {
        text =
          "Оценка текущего долга выше расчётной суммы вложений: тело кредита больше, чем приведённая стоимость оставшихся платежей при ставке ЦБ — типично при ставке по кредиту выше ключевой.";
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
  }, [parsed]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
          Плати за кредит с инвестиций
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Оценка суммы вложения в долговые инструменты (ориентир — облигации с
          полугодовой выплатой купона), если считать доходность портфеля равной
          ключевой ставке Банка России. Расчёт — ориентировочный: налоги,
          комиссии и календарь купонов не учитываются.
        </p>
      </div>

      <div className="card-panel space-y-5 !shadow-[var(--shadow-card)]">
        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            Ежемесячный платёж по кредиту, ₽
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={monthlyPayment}
            onChange={(e) => setMonthlyPayment(e.target.value)}
            className="field-input"
            placeholder="например 35000"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            Сколько месяцев ещё выплачивать кредит
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
            Оценка текущего остатка долга по кредиту, ₽
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={remainingDebt}
            onChange={(e) => setRemainingDebt(e.target.value)}
            className="field-input"
            placeholder="например 2 500 000"
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            Ваш ориентир по телу кредита на сегодня — для сравнения с
            расчётной суммой вложений. Можно оставить пустым, тогда блок
            сравнения не покажется.
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            Годовая доходность (ключевая ставка ЦБ), %
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={keyRate}
            onChange={(e) => setKeyRate(e.target.value)}
            className="field-input"
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            По умолчанию подставляется значение с сервера; при необходимости
            обновите вручную по данным{" "}
            <a
              href="https://www.cbr.ru/hd_base/KeyRate/"
              target="_blank"
              rel="noopener noreferrer"
              className="link-accent"
            >
              ЦБ РФ
            </a>
            .
          </span>
        </label>

        {!parsed.valid && (monthlyPayment || monthsLeft) ? (
          <p className="text-sm text-amber-800">
            Укажите положительный платёж, целое число месяцев не меньше 1 и
            неотрицательный остаток долга (или оставьте поле долга пустым).
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setShowResult(true)}
          disabled={!parsed.valid}
          className="btn-primary w-full"
        >
          Рассчитать
        </button>
      </div>

      {showResult && result ? (
        <div className="mt-8 space-y-6">
          <div className="card-panel space-y-4 !shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              1. Приведённая сумма вложений (дисконтирование платежей)
            </h2>
            <p className="text-[var(--muted)]">
              Ориентировочная сумма покупки облигаций при доходности ≈ ключевой
              ставке и двух купонах в год (модель покрытия потока платежей):
            </p>
            <p className="text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
              {rub.format(result.pv)}
            </p>

            {result.debtVsPv ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm">
                <p className="font-semibold text-sky-950">Сравнение с долгом</p>
                <ul className="mt-2 space-y-1.5 text-[var(--muted)]">
                  <li>
                    Оценка остатка долга:{" "}
                    <span className="tabular-nums font-medium text-[var(--foreground)]">
                      {rub.format(result.debtVsPv.debt)}
                    </span>
                  </li>
                  <li>
                    Расчётная сумма вложений:{" "}
                    <span className="tabular-nums font-medium text-[var(--foreground)]">
                      {rub.format(result.pv)}
                    </span>
                  </li>
                  <li>
                    Разница (вложения − долг):{" "}
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
                При такой сумме и ставке{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {parsed.key.toLocaleString("ru-RU", {
                    maximumFractionDigits: 2,
                  })}
                  % годовых
                </span>{" "}
                один полугодовой купон составляет около{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {rub.format(result.semi)}
                </span>
                , за 6 месяцев по кредиту нужно{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {rub.format(result.sixMonthsLoan)}
                </span>
                .
              </p>
              <p className="text-xs leading-relaxed">
                Формула: приведённая стоимость {parsed.months} платежей при r =
                ключевая / 12 / 100.
              </p>
            </div>
          </div>

          <div className="card-panel space-y-4 !shadow-[var(--shadow-card)]">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              2. Только купоны, тело не трогаем
            </h2>
            <p className="text-[var(--muted)]">
              Сколько нужно в облигациях при той же годовой доходности ({""}
              {parsed.key.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
              %), чтобы{" "}
              <strong className="font-semibold text-[var(--foreground)]">
                полностью оплачивать кредит только за счёт купонов
              </strong>{" "}
              (годовой купонный поток = 12 месячных платежей, накопленная сумма
              номинала не уменьшается).
            </p>
            <p className="text-3xl font-bold text-[var(--accent)] sm:text-4xl">
              {Number.isFinite(result.couponOnlyNominal)
                ? rub.format(result.couponOnlyNominal)
                : "—"}
            </p>
            <div className="space-y-2 text-sm text-[var(--muted)]">
              <p>
                Годовой купонный денежный поток:{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {Number.isFinite(result.annualCoupons)
                    ? rub.format(result.annualCoupons)
                    : "—"}
                </span>{" "}
                ({rub.format(result.annualLoan)} в год уходит на платежи по
                кредиту).
              </p>
              <p>
                Один полугодовой купон:{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {Number.isFinite(result.couponOnlySemi)
                    ? rub.format(result.couponOnlySemi)
                    : "—"}
                </span>{" "}
                ≈{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {rub.format(result.sixMonthsLoan)}
                </span>{" "}
                за 6 месяцев платежей.
              </p>
              <p className="text-xs leading-relaxed">
                Формула: N = 12 × платёж × 100 / ключевая ставка. Обычно N &gt;
                приведённой суммы из п.1 при ограниченном сроке кредита: без
                расходования тела нужен больший номинал.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
