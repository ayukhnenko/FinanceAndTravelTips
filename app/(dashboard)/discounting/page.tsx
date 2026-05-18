import DiscountingCalculator from "@/components/DiscountingCalculator";
import { getDefaultKeyRatePercent } from "@/lib/cbr-key-rate";

export const revalidate = 43200;

export default async function DiscountingPage() {
  const defaultDiscountRatePercent = await getDefaultKeyRatePercent();

  return (
    <DiscountingCalculator
      defaultDiscountRatePercent={defaultDiscountRatePercent}
    />
  );
}
