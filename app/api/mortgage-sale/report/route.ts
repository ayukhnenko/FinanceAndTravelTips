import { NextRequest, NextResponse } from "next/server";
import {
  escapeHtml,
  parseNonNegativeNumber,
  parseOutputFormat,
  parsePositiveInteger,
  parsePositiveNumber,
  respondByFormat,
} from "@/lib/api-output";

type Payload = {
  input: {
    propertyValue: number;
    debt: number;
    monthlyPayment: number;
    monthsLeft: number;
    rentPayment: number;
    rentGrowthPercent: number;
    naosPercent: number;
  };
  output: {
    proceedsAfterSale: number;
    sellFuture: number;
    holdFuture: number;
    diffHoldMinusSell: number;
    verdict: "sell" | "hold" | "equal";
  };
};

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function annualToMonthlyRate(ratePercent: number): number {
  return ratePercent / 100 / 12;
}

function futureValueLumpSum(principal: number, monthlyRate: number, months: number): number {
  return principal * Math.pow(1 + monthlyRate, months);
}

function futureValueHoldCashFlowWithRentGrowth(
  baseMonthlyRent: number,
  monthlyPayment: number,
  annualRentGrowthPercent: number,
  monthlyRate: number,
  months: number
): number {
  const annualGrowth = annualRentGrowthPercent / 100;
  let acc = 0;
  for (let m = 1; m <= months; m++) {
    const yearIndex = Math.floor((m - 1) / 12);
    const rentThisMonth = baseMonthlyRent * Math.pow(1 + annualGrowth, yearIndex);
    const netFlow = rentThisMonth - monthlyPayment;
    acc = acc * (1 + monthlyRate) + netFlow;
  }
  return acc;
}

function buildPayload(input: Payload["input"]): Payload {
  const monthlyRate = annualToMonthlyRate(input.naosPercent);
  const proceedsAfterSale = input.propertyValue - input.debt;
  const sellFuture = futureValueLumpSum(proceedsAfterSale, monthlyRate, input.monthsLeft);
  const holdCashFlowFuture = futureValueHoldCashFlowWithRentGrowth(
    input.rentPayment,
    input.monthlyPayment,
    input.rentGrowthPercent,
    monthlyRate,
    input.monthsLeft
  );
  const holdFuture = input.propertyValue + holdCashFlowFuture;
  const diff = holdFuture - sellFuture;
  const verdict: "sell" | "hold" | "equal" =
    Math.abs(diff) < 1 ? "equal" : diff > 0 ? "hold" : "sell";
  return {
    input,
    output: {
      proceedsAfterSale,
      sellFuture,
      holdFuture,
      diffHoldMinusSell: diff,
      verdict,
    },
  };
}

function renderHtml(payload: Payload): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Отчет: продавать квартиру в ипотеке</title></head><body style="font-family:Inter,-apple-system,sans-serif;background:#f8fafc;padding:20px"><h1>Выгодно ли продавать квартиру в ипотеке</h1><p>Продажа и инвестиции: <strong>${escapeHtml(
    rub.format(payload.output.sellFuture)
  )}</strong>; оставить и сдавать: <strong>${escapeHtml(
    rub.format(payload.output.holdFuture)
  )}</strong>.</p><p>Разница (оставить − продать): <strong>${escapeHtml(
    rub.format(payload.output.diffHoldMinusSell)
  )}</strong>, вердикт: <strong>${payload.output.verdict}</strong>.</p></body></html>`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const propertyValue = parsePositiveNumber(searchParams.get("propertyValue"));
  const debt = parseNonNegativeNumber(searchParams.get("debt"));
  const monthlyPayment = parseNonNegativeNumber(searchParams.get("monthlyPayment"));
  const monthsLeft = parsePositiveInteger(searchParams.get("monthsLeft"));
  const rentPayment = parseNonNegativeNumber(searchParams.get("rentPayment")) ?? 0;
  const rentGrowthPercent = parseNonNegativeNumber(searchParams.get("rentGrowthPercent")) ?? 0;
  const naosPercent = parseNonNegativeNumber(searchParams.get("naosPercent"));
  const format = parseOutputFormat(searchParams.get("format"));
  if (
    propertyValue == null ||
    debt == null ||
    monthlyPayment == null ||
    monthsLeft == null ||
    naosPercent == null ||
    debt > propertyValue ||
    format == null
  ) {
    return NextResponse.json(
      {
        error:
          "Некорректные параметры. Нужны: propertyValue>0, debt>=0, debt<=propertyValue, monthlyPayment>=0, monthsLeft>0, naosPercent>=0, rentPayment>=0 (опц.), rentGrowthPercent>=0 (опц.), format=json|ui.",
        example:
          "/api/mortgage-sale/report?propertyValue=12500000&debt=5000000&monthlyPayment=65000&monthsLeft=180&rentPayment=70000&rentGrowthPercent=5&naosPercent=18&format=json",
      },
      { status: 400 }
    );
  }
  if (format === "ui") {
    const target = new URL("/mortgage-sale", url.origin);
    target.searchParams.set("propertyValue", String(propertyValue));
    target.searchParams.set("debt", String(debt));
    target.searchParams.set("monthlyPayment", String(monthlyPayment));
    target.searchParams.set("monthsLeft", String(monthsLeft));
    target.searchParams.set("rentPayment", String(rentPayment));
    target.searchParams.set("rentGrowthPercent", String(rentGrowthPercent));
    target.searchParams.set("naosPercent", String(naosPercent));
    target.searchParams.set("autocalc", "1");
    return NextResponse.redirect(target);
  }
  const payload = buildPayload({
    propertyValue,
    debt,
    monthlyPayment,
    monthsLeft,
    rentPayment,
    rentGrowthPercent,
    naosPercent,
  });
  return respondByFormat({
    format,
    payload,
  });
}
