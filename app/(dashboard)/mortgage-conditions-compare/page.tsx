import MortgageConditionsCompareCalculator from "@/components/MortgageConditionsCompareCalculator";
import { getDefaultKeyRatePercent } from "@/lib/cbr-key-rate";

export const revalidate = 43200;

export default async function MortgageConditionsComparePage() {
  const defaultRate = await getDefaultKeyRatePercent();
  return (
    <MortgageConditionsCompareCalculator defaultDepositRatePercent={defaultRate} />
  );
}
