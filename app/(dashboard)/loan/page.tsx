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

function parseAutoCalc(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function LoanCalculatorPage({ searchParams }: PageProps) {
  const initial = {
    principal: one(searchParams.sum) ?? one(searchParams.principal),
    annualRate:
      one(searchParams.annualRatePercent) ??
      one(searchParams.rate) ??
      one(searchParams.stavka),
    termYears:
      one(searchParams.years) ??
      one(searchParams.termYears) ??
      one(searchParams.srok),
    paymentType: parsePaymentType(
      one(searchParams.paymentType) ?? one(searchParams.type)
    ),
    autoCalc: parseAutoCalc(one(searchParams.autocalc)),
  };

  return <LoanCalculator initial={initial} />;
}
