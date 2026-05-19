import { NextRequest, NextResponse } from "next/server";
import { buildSchedule, scheduleTotals, type PaymentType } from "@/lib/amortization";
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
    principal: number;
    annualRatePercent: number;
    termYears: number;
    paymentType: PaymentType;
  };
  output: {
    termMonths: number;
    firstPayment: number;
    lastPayment: number;
    totalPayment: number;
    totalInterest: number;
    scheduleSample: Array<{
      period: number;
      payment: number;
      principalPart: number;
      interestPart: number;
      balanceAfter: number;
    }>;
  };
};

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function parsePaymentType(value: string | null): PaymentType | null {
  if (!value) return "annuity";
  const t = value.toLowerCase();
  if (t === "annuity") return "annuity";
  if (t === "differentiated") return "differentiated";
  return null;
}

function buildPayload(input: Payload["input"]): Payload {
  const termMonths = Math.max(1, Math.round(input.termYears * 12));
  const schedule = buildSchedule({
    principal: input.principal,
    annualRatePercent: input.annualRatePercent,
    termMonths,
    paymentType: input.paymentType,
  });
  const totals = scheduleTotals(schedule);
  return {
    input,
    output: {
      termMonths,
      firstPayment: schedule[0]?.payment ?? 0,
      lastPayment: schedule[schedule.length - 1]?.payment ?? 0,
      totalPayment: totals.totalPayment,
      totalInterest: totals.totalInterest,
      scheduleSample: schedule.slice(0, 12),
    },
  };
}

function renderHtml(payload: Payload): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Отчет: кредитный калькулятор</title></head><body style="font-family:Inter,-apple-system,sans-serif;background:#f8fafc;padding:20px"><h1>Кредитный калькулятор</h1><p>Первый платеж: <strong>${escapeHtml(
    rub.format(payload.output.firstPayment)
  )}</strong>, последний: <strong>${escapeHtml(
    rub.format(payload.output.lastPayment)
  )}</strong>.</p><p>Всего процентов: <strong>${escapeHtml(
    rub.format(payload.output.totalInterest)
  )}</strong>.</p></body></html>`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const principal = parsePositiveNumber(searchParams.get("principal"));
  const annualRatePercent = parseNonNegativeNumber(searchParams.get("annualRatePercent"));
  const termYears = parsePositiveNumber(searchParams.get("termYears"));
  const paymentType = parsePaymentType(searchParams.get("paymentType"));
  const format = parseOutputFormat(searchParams.get("format"));
  const sampleLimit = parsePositiveInteger(searchParams.get("sampleLimit")) ?? 12;
  if (
    principal == null ||
    annualRatePercent == null ||
    termYears == null ||
    paymentType == null ||
    format == null
  ) {
    return NextResponse.json(
      {
        error:
          "Некорректные параметры. Нужны: principal>0, annualRatePercent>=0, termYears>0, paymentType=annuity|differentiated (опц.), format=json|ui.",
        example:
          "/api/loan/report?principal=3000000&annualRatePercent=12&termYears=20&paymentType=annuity&format=json",
      },
      { status: 400 }
    );
  }
  if (format === "ui") {
    const target = new URL("/loan", url.origin);
    target.searchParams.set("principal", String(principal));
    target.searchParams.set("annualRatePercent", String(annualRatePercent));
    target.searchParams.set("termYears", String(termYears));
    target.searchParams.set("paymentType", paymentType);
    target.searchParams.set("autocalc", "1");
    return NextResponse.redirect(target);
  }
  const payload = buildPayload({ principal, annualRatePercent, termYears, paymentType });
  payload.output.scheduleSample = payload.output.scheduleSample.slice(0, sampleLimit);
  return respondByFormat({
    format,
    payload,
  });
}
