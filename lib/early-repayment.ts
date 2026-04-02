/** Доля превышения ориентира над ставкой кредита для «сильной» рекомендации во вкладку/ОФЗ */
export const BENCHMARK_EXCESS_RATIO_STRONG = 0.13;

export type EarlyRepaymentVerdict = "invest_strong" | "invest_flexible" | "repay_early";

/**
 * Ориентир сравнения: если ставка депозита выше НАОС — берём её, иначе НАОС.
 */
export function effectiveBenchmark(naosPercent: number, depositPercent: number | null): number {
  const naos = Number(naosPercent);
  if (!Number.isFinite(naos)) return NaN;
  if (depositPercent == null || !Number.isFinite(depositPercent)) return naos;
  return depositPercent > naos ? depositPercent : naos;
}

/**
 * Эффективная ставка по кредиту: +0,5 п.п. для ипотеки.
 */
export function effectiveCreditRate(
  annualRatePercent: number,
  isMortgage: boolean
): number {
  const r = Number(annualRatePercent);
  if (!Number.isFinite(r)) return NaN;
  return isMortgage ? r + 0.5 : r;
}

export function getEarlyRepaymentVerdict(
  creditEffectivePercent: number,
  benchmarkPercent: number
): EarlyRepaymentVerdict {
  const credit = creditEffectivePercent;
  const bench = benchmarkPercent;
  if (!Number.isFinite(credit) || !Number.isFinite(bench)) {
    return "repay_early";
  }
  if (credit <= 0) return "repay_early";

  if (bench <= credit) {
    return "repay_early";
  }

  const margin = (bench - credit) / credit;
  if (margin > BENCHMARK_EXCESS_RATIO_STRONG) {
    return "invest_strong";
  }
  return "invest_flexible";
}
