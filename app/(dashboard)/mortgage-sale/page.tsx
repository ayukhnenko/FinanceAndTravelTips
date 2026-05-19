import MortgageSaleCalculator from "@/components/MortgageSaleCalculator";
import { getDefaultKeyRatePercent } from "@/lib/cbr-key-rate";
import { Suspense } from "react";

export const revalidate = 43200;

export default async function MortgageSalePage() {
  const defaultNaos = await getDefaultKeyRatePercent();

  return (
    <Suspense fallback={null}>
      <MortgageSaleCalculator defaultNaosPercent={defaultNaos} />
    </Suspense>
  );
}
