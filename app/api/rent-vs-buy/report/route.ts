import { NextRequest, NextResponse } from "next/server";
import { annuityMonthlyPayment } from "@/lib/amortization";
import { effectiveCreditRate } from "@/lib/early-repayment";
import {
  buildRentVsBuyProjection,
  depositRateAfterTax,
  findBreakEvenGrowthPercent,
} from "@/lib/rent-vs-buy";
import {
  escapeHtml,
  parseNonNegativeNumber,
  parseOutputFormat,
  parsePositiveNumber,
  respondByFormat,
} from "@/lib/api-output";

type Payload = {
  input: {
    rentCost: number;
    apartmentPrice: number;
    mortgageRatePercent: number;
    downPayment: number;
    depositRatePercent: number;
    mortgageTermYears: number;
  };
  output: {
    effectiveMortgageRatePercent: number;
    monthlyMortgagePayment: number;
    finalRentCapital: number;
    finalBuyCapital: number;
    diffBuyMinusRent: number;
    verdict: "buy" | "rent" | "equal";
    equalGrowthPercent: number | null;
  };
};

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function buildPayload(input: Payload["input"]): Payload {
  const loanPrincipal = input.apartmentPrice - input.downPayment;
  const termMonths = Math.round(input.mortgageTermYears * 12);
  const effectiveMortgageRatePercent = effectiveCreditRate(
    input.mortgageRatePercent,
    true
  );
  const monthlyMortgagePayment =
    loanPrincipal > 0
      ? annuityMonthlyPayment(loanPrincipal, effectiveMortgageRatePercent, termMonths)
      : 0;
  const depRateAfterTax = depositRateAfterTax(input.depositRatePercent);
  const projection = buildRentVsBuyProjection({
    downPayment: input.downPayment,
    apartmentPrice: input.apartmentPrice,
    baseMonthlyRent: input.rentCost,
    monthlyMortgagePayment,
    depositRatePercent: depRateAfterTax,
    termYears: input.mortgageTermYears,
    annualGrowthPercent: 0,
  });
  const equalGrowthPercent = findBreakEvenGrowthPercent({
    downPayment: input.downPayment,
    apartmentPrice: input.apartmentPrice,
    baseMonthlyRent: input.rentCost,
    monthlyMortgagePayment,
    depositRatePercent: depRateAfterTax,
    termYears: input.mortgageTermYears,
  });
  const diff = projection.finalBuyCapital - projection.finalRentCapital;
  const verdict: "buy" | "rent" | "equal" =
    Math.abs(diff) < 1 ? "equal" : diff > 0 ? "buy" : "rent";
  return {
    input,
    output: {
      effectiveMortgageRatePercent,
      monthlyMortgagePayment,
      finalRentCapital: projection.finalRentCapital,
      finalBuyCapital: projection.finalBuyCapital,
      diffBuyMinusRent: diff,
      verdict,
      equalGrowthPercent,
    },
  };
}

function renderHtml(payload: Payload): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Отчет: аренда или покупка</title></head><body style="font-family:Inter,-apple-system,sans-serif;background:#f8fafc;padding:20px"><h1>Аренда против покупки</h1><p>Капитал при аренде: <strong>${escapeHtml(
    rub.format(payload.output.finalRentCapital)
  )}</strong>, при покупке: <strong>${escapeHtml(
    rub.format(payload.output.finalBuyCapital)
  )}</strong>.</p><p>Разница: <strong>${escapeHtml(
    rub.format(payload.output.diffBuyMinusRent)
  )}</strong>, вердикт: <strong>${payload.output.verdict}</strong>.</p></body></html>`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const rentCost = parseNonNegativeNumber(searchParams.get("rentCost"));
  const apartmentPrice = parsePositiveNumber(searchParams.get("apartmentPrice"));
  const mortgageRatePercent = parseNonNegativeNumber(searchParams.get("mortgageRatePercent"));
  const downPayment = parseNonNegativeNumber(searchParams.get("downPayment"));
  const depositRatePercent = parseNonNegativeNumber(searchParams.get("depositRatePercent"));
  const mortgageTermYears = parsePositiveNumber(searchParams.get("mortgageTermYears"));
  const format = parseOutputFormat(searchParams.get("format"));
  if (
    rentCost == null ||
    apartmentPrice == null ||
    mortgageRatePercent == null ||
    downPayment == null ||
    depositRatePercent == null ||
    mortgageTermYears == null ||
    downPayment > apartmentPrice ||
    format == null
  ) {
    return NextResponse.json(
      {
        error:
          "Некорректные параметры. Нужны: rentCost>=0, apartmentPrice>0, mortgageRatePercent>=0, downPayment>=0, downPayment<=apartmentPrice, depositRatePercent>=0, mortgageTermYears>0, format=json|ui.",
        example:
          "/api/rent-vs-buy/report?rentCost=65000&apartmentPrice=12000000&mortgageRatePercent=14&downPayment=3000000&depositRatePercent=18&mortgageTermYears=20&format=json",
      },
      { status: 400 }
    );
  }
  if (format === "ui") {
    const target = new URL("/rent-vs-buy", url.origin);
    target.searchParams.set("rentCost", String(rentCost));
    target.searchParams.set("apartmentPrice", String(apartmentPrice));
    target.searchParams.set("mortgageRatePercent", String(mortgageRatePercent));
    target.searchParams.set("downPayment", String(downPayment));
    target.searchParams.set("depositRatePercent", String(depositRatePercent));
    target.searchParams.set("mortgageTermYears", String(mortgageTermYears));
    target.searchParams.set("autocalc", "1");
    return NextResponse.redirect(target);
  }
  const payload = buildPayload({
    rentCost,
    apartmentPrice,
    mortgageRatePercent,
    downPayment,
    depositRatePercent,
    mortgageTermYears,
  });
  return respondByFormat({
    format,
    payload,
  });
}
