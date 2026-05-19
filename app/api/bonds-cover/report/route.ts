import { NextRequest, NextResponse } from "next/server";
import {
  nominalForCouponOnlyNoDrawdown,
  presentValueOfMonthlyPayments,
  semiannualCouponFromNominal,
} from "@/lib/bonds-for-credit";
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
    monthlyPayment: number;
    monthsLeft: number;
    annualYieldPercent: number;
    remainingDebt: number | null;
  };
  output: {
    presentValueInvestment: number;
    semiannualCouponOnPresentValue: number;
    sixMonthsLoanPayments: number;
    couponOnlyNominal: number;
    couponOnlySemiannualCoupon: number;
    couponOnlyAnnualFlow: number;
    annualLoanPayments: number;
    debtComparison: {
      diffInvestmentMinusDebt: number;
    } | null;
  };
};

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function buildPayload(params: {
  monthlyPayment: number;
  monthsLeft: number;
  annualYieldPercent: number;
  remainingDebt: number | null;
}): Payload {
  const pv = presentValueOfMonthlyPayments(
    params.monthlyPayment,
    params.monthsLeft,
    params.annualYieldPercent
  );
  const semi = semiannualCouponFromNominal(pv, params.annualYieldPercent);
  const sixMonthsLoan = params.monthlyPayment * 6;
  const couponOnlyNominal = nominalForCouponOnlyNoDrawdown(
    params.monthlyPayment,
    params.annualYieldPercent
  );
  const couponOnlySemiannualCoupon = semiannualCouponFromNominal(
    couponOnlyNominal,
    params.annualYieldPercent
  );
  const couponOnlyAnnualFlow = (couponOnlyNominal * params.annualYieldPercent) / 100;
  const annualLoanPayments = params.monthlyPayment * 12;
  return {
    input: {
      monthlyPayment: params.monthlyPayment,
      monthsLeft: params.monthsLeft,
      annualYieldPercent: params.annualYieldPercent,
      remainingDebt: params.remainingDebt,
    },
    output: {
      presentValueInvestment: pv,
      semiannualCouponOnPresentValue: semi,
      sixMonthsLoanPayments: sixMonthsLoan,
      couponOnlyNominal,
      couponOnlySemiannualCoupon,
      couponOnlyAnnualFlow,
      annualLoanPayments,
      debtComparison:
        params.remainingDebt == null
          ? null
          : { diffInvestmentMinusDebt: pv - params.remainingDebt },
    },
  };
}

function renderHtml(payload: Payload): string {
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Отчет: покрытие кредита инвестициями</title>
<style>body{font-family:Inter,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;margin:0}.w{max-width:920px;margin:0 auto;padding:24px}.c{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.k{border:1px solid #e2e8f0;border-radius:10px;padding:10px}.l{font-size:12px;color:#64748b;text-transform:uppercase}.v{font-size:24px;font-weight:700;margin-top:6px}</style>
</head><body><main class="w"><section class="c">
<h1>Сколько инвестиций нужно, чтобы покрыть кредит</h1>
<p>Ежемесячный платеж: <strong>${escapeHtml(
    rub.format(payload.input.monthlyPayment)
  )}</strong>, месяцев: <strong>${payload.input.monthsLeft}</strong>, доходность: <strong>${payload.input.annualYieldPercent}%</strong></p>
<div class="g">
<div class="k"><div class="l">Приведенная сумма вложений</div><div class="v">${escapeHtml(
    rub.format(payload.output.presentValueInvestment)
  )}</div></div>
<div class="k"><div class="l">Номинал только купонами</div><div class="v">${escapeHtml(
    rub.format(payload.output.couponOnlyNominal)
  )}</div></div>
</div>
<p>Полугодовой купон на приведенную сумму: <strong>${escapeHtml(
    rub.format(payload.output.semiannualCouponOnPresentValue)
  )}</strong>.</p>
</section></main></body></html>`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const monthlyPayment = parsePositiveNumber(searchParams.get("monthlyPayment"));
  const monthsLeft = parsePositiveInteger(searchParams.get("monthsLeft"));
  const annualYieldPercent = parsePositiveNumber(searchParams.get("annualYieldPercent"));
  const remainingDebtRaw = searchParams.get("remainingDebt");
  const remainingDebt =
    remainingDebtRaw == null || remainingDebtRaw === ""
      ? null
      : parseNonNegativeNumber(remainingDebtRaw);
  const format = parseOutputFormat(searchParams.get("format"));
  if (
    monthlyPayment == null ||
    monthsLeft == null ||
    annualYieldPercent == null ||
    format == null ||
    (remainingDebtRaw != null && remainingDebtRaw !== "" && remainingDebt == null)
  ) {
    return NextResponse.json(
      {
        error:
          "Некорректные параметры. Нужны: monthlyPayment>0, monthsLeft>0, annualYieldPercent>0, remainingDebt>=0 (опционально), format=json|ui.",
        example:
          "/api/bonds-cover/report?monthlyPayment=35000&monthsLeft=120&annualYieldPercent=18&remainingDebt=2500000&format=json",
      },
      { status: 400 }
    );
  }
  if (format === "ui") {
    const target = new URL("/bonds", url.origin);
    target.searchParams.set("monthlyPayment", String(monthlyPayment));
    target.searchParams.set("monthsLeft", String(monthsLeft));
    target.searchParams.set("annualYieldPercent", String(annualYieldPercent));
    if (remainingDebt != null) {
      target.searchParams.set("remainingDebt", String(remainingDebt));
    }
    target.searchParams.set("autocalc", "1");
    return NextResponse.redirect(target);
  }
  const payload = buildPayload({
    monthlyPayment,
    monthsLeft,
    annualYieldPercent,
    remainingDebt,
  });
  return respondByFormat({
    format,
    payload,
  });
}
