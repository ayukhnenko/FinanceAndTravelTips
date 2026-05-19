/** Доля превышения ориентира над ставкой кредита для «сильной» рекомендации во вкладку/ОФЗ */
export const BENCHMARK_EXCESS_RATIO_STRONG = 0.13;

export type EarlyRepaymentVerdict = "invest_strong" | "invest_flexible" | "repay_early";
export type EarlyRepaymentSnapshot = {
  creditEff: number;
  bench: number;
  verdict: EarlyRepaymentVerdict;
  margin: number;
};

/** Ориентир сравнения: используем введённую пользователем ставку. */
export function effectiveBenchmark(naosPercent: number): number {
  const naos = Number(naosPercent);
  if (!Number.isFinite(naos)) return NaN;
  return naos;
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

export function calculateEarlyRepaymentSnapshot(
  annualRatePercent: number,
  isMortgage: boolean,
  benchmarkPercent: number
): EarlyRepaymentSnapshot {
  const creditEff = effectiveCreditRate(annualRatePercent, isMortgage);
  const bench = effectiveBenchmark(benchmarkPercent);
  const verdict = getEarlyRepaymentVerdict(creditEff, bench);
  const margin =
    creditEff > 0 && Number.isFinite(bench) ? (bench - creditEff) / creditEff : NaN;
  return { creditEff, bench, verdict, margin };
}
