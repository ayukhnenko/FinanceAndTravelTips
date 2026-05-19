import DiscountingCalculator from "@/components/DiscountingCalculator";
import { getDefaultKeyRatePercent } from "@/lib/cbr-key-rate";
import { Suspense } from "react";

export const revalidate = 43200;

export default async function DiscountingPage() {
  const defaultDiscountRatePercent = await getDefaultKeyRatePercent();

  return (
    <Suspense fallback={null}>
      <DiscountingCalculator
        defaultDiscountRatePercent={defaultDiscountRatePercent}
      />
    </Suspense>
  );
}
