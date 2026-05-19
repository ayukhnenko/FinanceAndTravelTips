import { NextRequest, NextResponse } from "next/server";
import {
  escapeHtml,
  parseNonNegativeNumber,
  parseOutputFormat,
  parsePositiveNumber,
  respondByFormat,
} from "@/lib/api-output";

type Payload = {
  input: {
    amount: number;
    years: number;
    discountRatePercent: number;
  };
  output: {
    discountedValue: number;
    discountLoss: number;
  };
};

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function discountedValueAfterTerm(
  amount: number,
  years: number,
  discountRatePercent: number
): number {
  return amount / Math.pow(1 + discountRatePercent / 100, years);
}

function buildPayload(input: Payload["input"]): Payload {
  const discountedValue = discountedValueAfterTerm(
    input.amount,
    input.years,
    input.discountRatePercent
  );
  return {
    input,
    output: {
      discountedValue,
      discountLoss: input.amount - discountedValue,
    },
  };
}

function renderHtml(payload: Payload): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Отчет: дисконтирование</title></head><body style="font-family:Inter,-apple-system,sans-serif;background:#f8fafc;padding:20px"><h1>Дисконтирование</h1><p>Будущая стоимость: <strong>${escapeHtml(
    rub.format(payload.output.discountedValue)
  )}</strong>. Снижение стоимости: <strong>${escapeHtml(
    rub.format(payload.output.discountLoss)
  )}</strong>.</p></body></html>`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const amount = parsePositiveNumber(searchParams.get("amount"));
  const years = parsePositiveNumber(searchParams.get("years"));
  const discountRatePercent = parseNonNegativeNumber(searchParams.get("discountRatePercent"));
  const format = parseOutputFormat(searchParams.get("format"));
  if (amount == null || years == null || discountRatePercent == null || format == null) {
    return NextResponse.json(
      {
        error:
          "Некорректные параметры. Нужны: amount>0, years>0, discountRatePercent>=0, format=json|ui.",
        example:
          "/api/discounting/report?amount=100000&years=3&discountRatePercent=21&format=json",
      },
      { status: 400 }
    );
  }
  if (format === "ui") {
    const target = new URL("/discounting", url.origin);
    target.searchParams.set("amount", String(amount));
    target.searchParams.set("years", String(years));
    target.searchParams.set("discountRatePercent", String(discountRatePercent));
    target.searchParams.set("autocalc", "1");
    return NextResponse.redirect(target);
  }
  const payload = buildPayload({ amount, years, discountRatePercent });
  return respondByFormat({
    format,
    payload,
  });
}
