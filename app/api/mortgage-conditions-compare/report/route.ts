import { NextRequest, NextResponse } from "next/server";
import {
  buildMortgageConditionsComparison,
  type MortgageConditionInput,
} from "@/lib/mortgage-conditions-compare";
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
    propertyPrice: number;
    maxDownPayment: number;
    annualDepositRatePercent: number;
    termMonths: number;
    annualDiscountRatePercent: number;
    conditions: MortgageConditionInput[];
  };
  output: {
    options: Array<{
      id: string;
      label: string;
      totalPayment: number;
      totalNetPayment: number;
      discountedTotalNetPayment: number;
    }>;
    bestByNominal: string | null;
    bestByDiscounted: string | null;
  };
};

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function parseConditions(raw: string | null): MortgageConditionInput[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length < 2) return null;
    const result: MortgageConditionInput[] = parsed.map((c: unknown, i: number) => {
      const item = c as Record<string, unknown>;
      const annualRatePercent = Number(item.annualRatePercent);
      const minDownPaymentPercent = Number(item.minDownPaymentPercent);
      const gracePeriodMonths = Number(item.gracePeriodMonths ?? 0);
      const graceRatePercent =
        item.graceRatePercent == null ? null : Number(item.graceRatePercent);
      if (
        !Number.isFinite(annualRatePercent) ||
        annualRatePercent < 0 ||
        !Number.isFinite(minDownPaymentPercent) ||
        minDownPaymentPercent < 0 ||
        minDownPaymentPercent > 100 ||
        !Number.isFinite(gracePeriodMonths) ||
        gracePeriodMonths < 0 ||
        (graceRatePercent != null &&
          (!Number.isFinite(graceRatePercent) || graceRatePercent < 0))
      ) {
        throw new Error("invalid");
      }
      return {
        id: String(item.id ?? `option-${i + 1}`),
        label: String(item.label ?? `Вариант ${i + 1}`),
        annualRatePercent,
        minDownPaymentPercent,
        gracePeriodMonths: Math.round(gracePeriodMonths),
        graceRatePercent,
      };
    });
    return result;
  } catch {
    return null;
  }
}

function buildPayload(input: Payload["input"]): Payload {
  const result = buildMortgageConditionsComparison(input);
  const options = result.options.map((opt) => ({
    id: opt.id,
    label: opt.label,
    totalPayment: opt.totalPayment,
    totalNetPayment: opt.totalNetPayment,
    discountedTotalNetPayment: opt.discountedTotalNetPayment,
  }));
  const nominal = [...options].sort((a, b) => a.totalNetPayment - b.totalNetPayment);
  const discounted = [...options].sort(
    (a, b) => a.discountedTotalNetPayment - b.discountedTotalNetPayment
  );
  return {
    input,
    output: {
      options,
      bestByNominal: nominal[0]?.label ?? null,
      bestByDiscounted: discounted[0]?.label ?? null,
    },
  };
}

function renderHtml(payload: Payload): string {
  const rows = payload.output.options
    .map(
      (o) =>
        `<tr><td>${escapeHtml(o.label)}</td><td>${escapeHtml(
          rub.format(o.totalNetPayment)
        )}</td><td>${escapeHtml(rub.format(o.discountedTotalNetPayment))}</td></tr>`
    )
    .join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Отчет: сравнение ипотечных условий</title></head><body style="font-family:Inter,-apple-system,sans-serif;background:#f8fafc;padding:20px"><h1>Сравнение ипотечных условий</h1><p>Лучший вариант (номинал): <strong>${escapeHtml(
    payload.output.bestByNominal ?? "—"
  )}</strong>; с учетом дисконта: <strong>${escapeHtml(
    payload.output.bestByDiscounted ?? "—"
  )}</strong>.</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Вариант</th><th>Чистые выплаты</th><th>Дисконтированные</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const propertyPrice = parsePositiveNumber(searchParams.get("propertyPrice"));
  const maxDownPayment = parseNonNegativeNumber(searchParams.get("maxDownPayment"));
  const annualDepositRatePercent = parseNonNegativeNumber(
    searchParams.get("annualDepositRatePercent")
  );
  const termMonths = parsePositiveInteger(searchParams.get("termMonths"));
  const annualDiscountRatePercent =
    parseNonNegativeNumber(searchParams.get("annualDiscountRatePercent")) ?? 0;
  const conditions = parseConditions(searchParams.get("conditions"));
  const format = parseOutputFormat(searchParams.get("format"));
  if (
    propertyPrice == null ||
    maxDownPayment == null ||
    annualDepositRatePercent == null ||
    termMonths == null ||
    conditions == null ||
    maxDownPayment > propertyPrice ||
    format == null
  ) {
    return NextResponse.json(
      {
        error:
          "Некорректные параметры. Нужны: propertyPrice>0, maxDownPayment>=0 (<=propertyPrice), annualDepositRatePercent>=0, termMonths>0, conditions=[...] (JSON-массив минимум из 2 вариантов), annualDiscountRatePercent>=0 (опц.), format=json|ui.",
        example:
          "/api/mortgage-conditions-compare/report?propertyPrice=12000000&maxDownPayment=4000000&annualDepositRatePercent=18&termMonths=240&conditions=[{\"id\":\"a\",\"label\":\"Вариант%201\",\"annualRatePercent\":14,\"minDownPaymentPercent\":20,\"gracePeriodMonths\":0,\"graceRatePercent\":null},{\"id\":\"b\",\"label\":\"Вариант%202\",\"annualRatePercent\":13.5,\"minDownPaymentPercent\":25,\"gracePeriodMonths\":24,\"graceRatePercent\":8}]&format=json",
      },
      { status: 400 }
    );
  }
  if (format === "ui") {
    const target = new URL("/mortgage-conditions-compare", url.origin);
    target.searchParams.set("propertyPrice", String(propertyPrice));
    target.searchParams.set("maxDownPayment", String(maxDownPayment));
    target.searchParams.set("annualDepositRatePercent", String(annualDepositRatePercent));
    target.searchParams.set("termMonths", String(termMonths));
    target.searchParams.set("annualDiscountRatePercent", String(annualDiscountRatePercent));
    target.searchParams.set("conditions", JSON.stringify(conditions));
    target.searchParams.set("applyDiscount", annualDiscountRatePercent > 0 ? "1" : "0");
    target.searchParams.set("autocalc", "1");
    return NextResponse.redirect(target);
  }
  const payload = buildPayload({
    propertyPrice,
    maxDownPayment,
    annualDepositRatePercent,
    termMonths,
    annualDiscountRatePercent,
    conditions,
  });
  return respondByFormat({
    format,
    payload,
  });
}
