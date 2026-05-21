import {
  readDepositOffers,
  type DepositOfferRecord,
} from "@/lib/deposit-offers-store";
import { getDepositOfferRatePercent } from "@/lib/deposit-offers-format";

export function sortDepositOffersByRate(
  offers: DepositOfferRecord[]
): DepositOfferRecord[] {
  const sorted = [...offers];
  sorted.sort((left, right) => {
    const leftRate = getDepositOfferRatePercent(left) ?? -1;
    const rightRate = getDepositOfferRatePercent(right) ?? -1;
    if (rightRate !== leftRate) return rightRate - leftRate;
    return left.sortOrder - right.sortOrder;
  });
  return sorted.map((offer, index) => ({ ...offer, sortOrder: index + 1 }));
}

export async function readSortedDepositOffers(
  dataSource: string,
  limit = 200
): Promise<DepositOfferRecord[]> {
  const offers = await readDepositOffers(dataSource, limit);
  return sortDepositOffersByRate(offers);
}
