import EarlyRepaymentCalculator from "@/components/EarlyRepaymentCalculator";
import { getDefaultKeyRatePercent } from "@/lib/cbr-key-rate";
import { Suspense } from "react";

export const revalidate = 43200;

export default async function EarlyRepaymentPage() {
  const defaultNaos = await getDefaultKeyRatePercent();

  return (
    <Suspense fallback={null}>
      <EarlyRepaymentCalculator defaultNaosPercent={defaultNaos} />
    </Suspense>
  );
}
