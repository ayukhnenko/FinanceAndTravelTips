import CreditCardBenefitCalculator from "@/components/CreditCardBenefitCalculator";
import { getDefaultKeyRatePercent } from "@/lib/cbr-key-rate";

export const revalidate = 43200;

export default async function CreditCardBenefitPage() {
  const defaultRate = await getDefaultKeyRatePercent();

  return <CreditCardBenefitCalculator defaultRatePercent={defaultRate} />;
}
