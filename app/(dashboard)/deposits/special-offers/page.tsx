import DepositsOffersPage from "@/components/DepositsOffersPage";

export default function DepositsSpecialOffersPage() {
  return (
    <DepositsOffersPage
      title="Спецпредложения"
      apiPath="/api/deposits/special-offers"
      thresholdStorageKey="deposits-special-offers-rate-threshold"
      source="sheet"
    />
  );
}
