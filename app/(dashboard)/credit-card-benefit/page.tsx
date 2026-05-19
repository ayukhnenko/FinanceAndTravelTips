import CreditCardBenefitCalculator from "@/components/CreditCardBenefitCalculator";
import { getDefaultKeyRatePercent } from "@/lib/cbr-key-rate";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function CreditCardBenefitPage() {
  const defaultRate = await getDefaultKeyRatePercent();

  return (
    <Suspense fallback={null}>
      <CreditCardBenefitCalculator defaultRatePercent={defaultRate} />
    </Suspense>
  );
}
