import LoanCalculator from "@/components/LoanCalculator";
import type { PaymentType } from "@/lib/amortization";

function one(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function parsePaymentType(raw: string | undefined): PaymentType | undefined {
  if (!raw) return undefined;
  const t = raw.toLowerCase();
  if (t === "annuity" || t === "annuitet" || t === "аннуитет") {
    return "annuity";
  }
  if (
    t === "differentiated" ||
    t === "diff" ||
    t === "different" ||
    t === "дифф"
  ) {
    return "differentiated";
  }
  return undefined;
}

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function LoanCalculatorPage({ searchParams }: PageProps) {
  const initial = {
    principal: one(searchParams.sum) ?? one(searchParams.principal),
    annualRate: one(searchParams.rate) ?? one(searchParams.stavka),
    termYears:
      one(searchParams.years) ??
      one(searchParams.termYears) ??
      one(searchParams.srok),
    paymentType: parsePaymentType(one(searchParams.type)),
  };

  return <LoanCalculator initial={initial} />;
}
