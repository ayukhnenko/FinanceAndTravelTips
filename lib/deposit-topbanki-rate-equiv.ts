const DAYS_PER_YEAR = 365;

function hasCapitalization(conditionsText: string): boolean {
  return conditionsText.toLowerCase().includes("капитализац");
}

/** Итоговый множитель капитала (1 = без дохода) по номинальной годовой ставке и условиям вклада. */
export function computeTopbankiMaturityFactor(
  nominalRatePercent: number,
  termDays: number,
  conditionsText: string
): number {
  if (termDays <= 0 || !Number.isFinite(nominalRatePercent)) return 1;

  const r = nominalRatePercent / 100;
  const t = termDays / DAYS_PER_YEAR;

  if (hasCapitalization(conditionsText)) {
    const months = termDays / (DAYS_PER_YEAR / 12);
    return Math.pow(1 + r / 12, months);
  }

  return 1 + r * t;
}

/**
 * Годовой эквивалент для Topbanki:
 * — срок < 1 года: эквивалентная ставка сложного процента с рефинансированием по той же ставке;
 * — срок ≥ 1 года: ставка годового реинвестирования, дающая тот же итог к сроку вклада.
 */
export function computeTopbankiAnnualEquivalentPercent(
  nominalRatePercent: number,
  termDays: number,
  conditionsText: string
): number | null {
  if (termDays <= 0 || !Number.isFinite(nominalRatePercent)) return null;

  const t = termDays / DAYS_PER_YEAR;
  const r = nominalRatePercent / 100;
  let growth: number;

  if (termDays < DAYS_PER_YEAR) {
    if (hasCapitalization(conditionsText)) {
      growth = computeTopbankiMaturityFactor(nominalRatePercent, termDays, conditionsText);
    } else {
      growth = Math.pow(1 + r, t);
    }
  } else {
    growth = computeTopbankiMaturityFactor(nominalRatePercent, termDays, conditionsText);
  }

  if (!Number.isFinite(growth) || growth <= 0) return null;
  const annualRate = Math.pow(growth, DAYS_PER_YEAR / termDays) - 1;
  if (!Number.isFinite(annualRate)) return null;
  return Math.round(annualRate * 10000) / 100;
}
