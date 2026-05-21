export function formatDepositPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function parseDepositPercentText(value: string): number | null {
  const text = value.trim().replace("%", "").replace(/\s/g, "").replace(",", ".");
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > 200) return null;
  return n;
}

export function getDepositOfferRatePercent(offer: {
  nominalRatePercent: number | null;
  rateAnnualEquivPercent: number | null;
}): number | null {
  if (offer.rateAnnualEquivPercent != null && Number.isFinite(offer.rateAnnualEquivPercent)) {
    return offer.rateAnnualEquivPercent;
  }
  return null;
}

export function filterDepositOffersByMinRate<
  T extends {
    nominalRatePercent: number | null;
    rateAnnualEquivPercent: number | null;
  },
>(offers: T[], minRatePercent: number | null): T[] {
  if (minRatePercent == null) return offers;
  return offers.filter((offer) => {
    const rate = getDepositOfferRatePercent(offer);
    return rate != null && rate > minRatePercent;
  });
}
