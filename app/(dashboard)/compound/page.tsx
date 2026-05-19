import CompoundInterestCalculator from "@/components/CompoundInterestCalculator";
import { Suspense } from "react";

export default function CompoundPage() {
  return (
    <Suspense fallback={null}>
      <CompoundInterestCalculator />
    </Suspense>
  );
}
