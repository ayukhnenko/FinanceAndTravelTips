import MortgageSaleCalculator from "@/components/MortgageSaleCalculator";
import { getDefaultKeyRatePercent } from "@/lib/cbr-key-rate";

export const revalidate = 43200;

export default async function MortgageSalePage() {
  const defaultNaos = await getDefaultKeyRatePercent();

  return <MortgageSaleCalculator defaultNaosPercent={defaultNaos} />;
}
