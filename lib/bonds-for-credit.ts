/**
 * Приведённая стоимость аннуитета: сколько нужно вложить сегодня под rate%/год
 * (ставка делится на 12 помесячно без сложного учёта внутриполугодичных купонов),
 * чтобы теоретически покрыть n ежемесячных платежей размера monthlyPayment.
 */
export function presentValueOfMonthlyPayments(
  monthlyPayment: number,
  remainingMonths: number,
  annualYieldPercent: number
): number {
  const n = Math.floor(remainingMonths);
  const pmt = monthlyPayment;
  const key = annualYieldPercent;

  if (!Number.isFinite(pmt) || !Number.isFinite(n) || n < 1 || pmt <= 0) {
    return NaN;
  }
  if (!Number.isFinite(key) || key < 0) return NaN;

  const r = key / 100 / 12;
  if (r === 0) {
    return round2(pmt * n);
  }

  const factor = (1 - Math.pow(1 + r, -n)) / r;
  return round2(pmt * factor);
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Ожидаемый разовый купон (2 раза в год) от номинала при годовой ставке key% */
export function semiannualCouponFromNominal(
  nominalRub: number,
  annualYieldPercent: number
): number {
  return round2((nominalRub * (annualYieldPercent / 100)) / 2);
}

/**
 * Номинал при годовой купонной доходности = key% (2 выплаты в год),
 * чтобы **только купоны** покрывали платежи по кредиту без расходования тела:
 * годовой купонный денежный поток = N × key/100 = 12 × monthly.
 */
export function nominalForCouponOnlyNoDrawdown(
  monthlyPayment: number,
  annualYieldPercent: number
): number {
  const m = monthlyPayment;
  const key = annualYieldPercent;
  if (!Number.isFinite(m) || m <= 0) return NaN;
  if (!Number.isFinite(key) || key <= 0) return NaN;
  return round2((12 * m * 100) / key);
}
