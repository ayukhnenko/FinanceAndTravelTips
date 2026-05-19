import { NextRequest, NextResponse } from "next/server";
import {
  escapeHtml,
  parseNonNegativeNumber,
  parseOutputFormat,
  respondByFormat,
} from "@/lib/api-output";

type Payload = {
  input: {
    monthlySpending: number;
    graceDays: number;
    savingsRatePercent: number;
  };
  output: {
    effectiveDays: number;
    permanentAmount: number;
    monthlyBenefit: number;
    yearlyBenefit: number;
  };
};

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function buildPayload(params: Payload["input"]): Payload {
  const effectiveDays = params.graceDays - 17;
  const permanentAmount = (params.monthlySpending * effectiveDays * 12) / 365;
  const monthlyBenefit =
    params.monthlySpending * (params.savingsRatePercent / 100) * (effectiveDays / 365);
  const yearlyBenefit = monthlyBenefit * 12;
  return {
    input: params,
    output: { effectiveDays, permanentAmount, monthlyBenefit, yearlyBenefit },
  };
}

function renderHtml(payload: Payload): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Отчет: выгода оплаты кредиткой</title></head><body style="font-family:Inter,-apple-system,sans-serif;background:#f8fafc;padding:20px"><h1>Выгода от оплаты кредиткой</h1><p>Траты: <strong>${escapeHtml(
    rub.format(payload.input.monthlySpending)
  )}</strong>, грейс: <strong>${payload.input.graceDays}</strong> дн., ставка: <strong>${payload.input.savingsRatePercent}%</strong>.</p><ul><li>Сумма на накопительном: <strong>${escapeHtml(
    rub.format(payload.output.permanentAmount)
  )}</strong></li><li>Выгода в месяц: <strong>${escapeHtml(
    rub.format(payload.output.monthlyBenefit)
  )}</strong></li><li>Выгода в год: <strong>${escapeHtml(
    rub.format(payload.output.yearlyBenefit)
  )}</strong></li></ul></body></html>`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const monthlySpending = parseNonNegativeNumber(searchParams.get("monthlySpending"));
  const graceDays = parseNonNegativeNumber(searchParams.get("graceDays"));
  const savingsRatePercent = parseNonNegativeNumber(searchParams.get("savingsRatePercent"));
  const format = parseOutputFormat(searchParams.get("format"));
  if (
    monthlySpending == null ||
    graceDays == null ||
    savingsRatePercent == null ||
    graceDays <= 17 ||
    format == null
  ) {
    return NextResponse.json(
      {
        error:
          "Некорректные параметры. Нужны: monthlySpending>=0, graceDays>17, savingsRatePercent>=0, format=json|ui.",
        example:
          "/api/credit-card-benefit/report?monthlySpending=100000&graceDays=50&savingsRatePercent=18&format=json",
      },
      { status: 400 }
    );
  }
  if (format === "ui") {
    const target = new URL("/credit-card-benefit", url.origin);
    target.searchParams.set("monthlySpending", String(monthlySpending));
    target.searchParams.set("graceDays", String(graceDays));
    target.searchParams.set("savingsRatePercent", String(savingsRatePercent));
    target.searchParams.set("autocalc", "1");
    return NextResponse.redirect(target);
  }
  const payload = buildPayload({ monthlySpending, graceDays, savingsRatePercent });
  return respondByFormat({
    format,
    payload,
  });
}
