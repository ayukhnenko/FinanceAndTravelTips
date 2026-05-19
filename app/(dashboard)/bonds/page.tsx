import BondsForCreditCalculator from "@/components/BondsForCreditCalculator";
import { getDefaultKeyRatePercent } from "@/lib/cbr-key-rate";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function BondsForCreditPage() {
  const defaultKey = await getDefaultKeyRatePercent();
  return (
    <Suspense fallback={null}>
      <BondsForCreditCalculator defaultKeyRatePercent={defaultKey} />
    </Suspense>
  );
}
