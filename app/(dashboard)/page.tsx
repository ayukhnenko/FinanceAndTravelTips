import EarlyRepaymentCalculator from "@/components/EarlyRepaymentCalculator";
import { getDefaultKeyRatePercent } from "@/lib/cbr-key-rate";

export const revalidate = 43200;

export default async function EarlyRepaymentPage() {
  const defaultNaos = await getDefaultKeyRatePercent();

  return <EarlyRepaymentCalculator defaultNaosPercent={defaultNaos} />;
}
