import DepositsOffersPage from "@/components/DepositsOffersPage";

export default function DepositsBestOffersPage() {
  return (
    <DepositsOffersPage
      title="Лучшие предложения"
      apiPath="/api/deposits/best-offers"
      thresholdStorageKey="deposits-best-offers-rate-threshold"
      source="topbanki"
    />
  );
}
