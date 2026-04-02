import BondsForCreditCalculator from "@/components/BondsForCreditCalculator";
import { getDefaultKeyRatePercent } from "@/lib/cbr-key-rate";

export const revalidate = 43200;

export default async function BondsForCreditPage() {
  const defaultKey = await getDefaultKeyRatePercent();
  return <BondsForCreditCalculator defaultKeyRatePercent={defaultKey} />;
}
