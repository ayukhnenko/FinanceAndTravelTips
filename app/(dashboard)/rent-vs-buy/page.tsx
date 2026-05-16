import RentVsBuyCalculator from "@/components/RentVsBuyCalculator";
import { getDefaultKeyRatePercent } from "@/lib/cbr-key-rate";

export const revalidate = 43200;

export default async function RentVsBuyPage() {
  const defaultRate = await getDefaultKeyRatePercent();

  return <RentVsBuyCalculator defaultDepositRatePercent={defaultRate} />;
}
