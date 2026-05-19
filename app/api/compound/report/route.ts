import { NextRequest, NextResponse } from "next/server";
import {
  escapeHtml,
  parseNonNegativeNumber,
  parseOutputFormat,
  parsePositiveNumber,
  respondByFormat,
} from "@/lib/api-output";

type Period = "monthly" | "quarterly" | "yearly";

type Payload = {
  input: {
    principal: number;
    annualRatePercent: number;
    years: number;
    period: Period;
  };
  output: {
    nPerYear: number;
    amount: number;
    interest: number;
  };
};

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function nPerYear(period: Period): number {
  return period === "monthly" ? 12 : period === "quarterly" ? 4 : 1;
}

function compoundAmount(
  principal: number,
  annualRatePercent: number,
  years: number,
  n: number
): number {
  const r = annualRatePercent / 100 / n;
  const periods = years * n;
  return principal * Math.pow(1 + r, periods);
}

function buildPayload(input: Payload["input"]): Payload {
  const n = nPerYear(input.period);
  const amount = compoundAmount(input.principal, input.annualRatePercent, input.years, n);
  return {
    input,
    output: {
      nPerYear: n,
      amount,
      interest: amount - input.principal,
    },
  };
}

function parsePeriod(value: string | null): Period | null {
  if (!value) return "monthly";
  const v = value.toLowerCase();
  if (v === "monthly" || v === "quarterly" || v === "yearly") return v;
  return null;
}

function renderHtml(payload: Payload): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Отчет: сложный процент</title></head><body style="font-family:Inter,-apple-system,sans-serif;background:#f8fafc;padding:20px"><h1>Калькулятор сложных процентов</h1><p>Итоговая сумма: <strong>${escapeHtml(
    rub.format(payload.output.amount)
  )}</strong>, начисленные проценты: <strong>${escapeHtml(
    rub.format(payload.output.interest)
  )}</strong>.</p></body></html>`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const principal = parsePositiveNumber(searchParams.get("principal"));
  const annualRatePercent = parseNonNegativeNumber(searchParams.get("annualRatePercent"));
  const years = parsePositiveNumber(searchParams.get("years"));
  const period = parsePeriod(searchParams.get("period"));
  const format = parseOutputFormat(searchParams.get("format"));
  if (
    principal == null ||
    annualRatePercent == null ||
    years == null ||
    period == null ||
    format == null
  ) {
    return NextResponse.json(
      {
        error:
          "Некорректные параметры. Нужны: principal>0, annualRatePercent>=0, years>0, period=monthly|quarterly|yearly (опц.), format=json|ui.",
        example:
          "/api/compound/report?principal=100000&annualRatePercent=12&years=5&period=monthly&format=json",
      },
      { status: 400 }
    );
  }
  if (format === "ui") {
    const target = new URL("/compound", url.origin);
    target.searchParams.set("principal", String(principal));
    target.searchParams.set("annualRatePercent", String(annualRatePercent));
    target.searchParams.set("years", String(years));
    target.searchParams.set("period", period);
    target.searchParams.set("autocalc", "1");
    return NextResponse.redirect(target);
  }
  const payload = buildPayload({ principal, annualRatePercent, years, period });
  return respondByFormat({
    format,
    payload,
  });
}
