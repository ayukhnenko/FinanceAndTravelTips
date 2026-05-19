import MortgageConditionsCompareCalculator from "@/components/MortgageConditionsCompareCalculator";
import { getDefaultKeyRatePercent } from "@/lib/cbr-key-rate";
import { Suspense } from "react";

export const revalidate = 43200;

export default async function MortgageConditionsComparePage() {
  const defaultRate = await getDefaultKeyRatePercent();
  return (
    <Suspense fallback={null}>
      <MortgageConditionsCompareCalculator defaultDepositRatePercent={defaultRate} />
    </Suspense>
  );
}
