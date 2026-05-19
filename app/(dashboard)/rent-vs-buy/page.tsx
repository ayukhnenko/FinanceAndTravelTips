import RentVsBuyCalculator from "@/components/RentVsBuyCalculator";
import { getDefaultKeyRatePercent } from "@/lib/cbr-key-rate";
import { Suspense } from "react";

export const revalidate = 43200;

export default async function RentVsBuyPage() {
  const defaultRate = await getDefaultKeyRatePercent();

  return (
    <Suspense fallback={null}>
      <RentVsBuyCalculator defaultDepositRatePercent={defaultRate} />
    </Suspense>
  );
}
