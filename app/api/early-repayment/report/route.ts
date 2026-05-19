import { NextRequest, NextResponse } from "next/server";
import {
  BENCHMARK_EXCESS_RATIO_STRONG,
  calculateEarlyRepaymentSnapshot,
  type EarlyRepaymentVerdict,
} from "@/lib/early-repayment";
import {
  escapeHtml,
  parseBoolean,
  parseNonNegativeNumber,
  parseOutputFormat,
  respondByFormat,
} from "@/lib/api-output";

type VerdictText = {
  title: string;
  body: string;
};

type ReportPayload = {
  input: {
    rate: number;
    benchmarkRate: number;
    isMortgage: boolean;
  };
  output: {
    effectiveCreditRate: number;
    benchmarkForComparison: number;
    marginRatio: number;
    marginPercent: number;
    verdict: {
      code: EarlyRepaymentVerdict;
      title: string;
      body: string;
    };
    strongRecommendationThresholdPercent: number;
  };
};

function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}%`;
}

function getVerdictText(verdict: EarlyRepaymentVerdict): VerdictText {
  if (verdict === "invest_strong") {
    return {
      title: "Вывод",
      body:
        "Ориентир заметно выше вашей эффективной ставки по кредиту (более чем на 13%). Рекомендуем не гасить кредит досрочно, а разместить средства на депозите или вложить в ОФЗ.",
    };
  }
  if (verdict === "invest_flexible") {
    return {
      title: "Вывод",
      body:
        "Ориентир выше вашей эффективной ставки по кредиту, но не более чем на 13%. Рекомендуем также держать деньги на депозите или в ОФЗ с целью обеспечения гибкости. При большом желании досрочное погашение возможно.",
    };
  }
  return {
    title: "Вывод",
    body: "Ориентир ниже или равен вашей эффективной ставке по кредиту. Рекомендуем досрочно гасить кредит.",
  };
}

function buildPayload(params: {
  rate: number;
  benchmarkRate: number;
  isMortgage: boolean;
}): ReportPayload {
  const snapshot = calculateEarlyRepaymentSnapshot(
    params.rate,
    params.isMortgage,
    params.benchmarkRate
  );
  const verdict = getVerdictText(snapshot.verdict);
  return {
    input: {
      rate: params.rate,
      benchmarkRate: params.benchmarkRate,
      isMortgage: params.isMortgage,
    },
    output: {
      effectiveCreditRate: snapshot.creditEff,
      benchmarkForComparison: snapshot.bench,
      marginRatio: snapshot.margin,
      marginPercent: snapshot.margin * 100,
      verdict: {
        code: snapshot.verdict,
        title: verdict.title,
        body: verdict.body,
      },
      strongRecommendationThresholdPercent:
        BENCHMARK_EXCESS_RATIO_STRONG * 100,
    },
  };
}

function renderHtml(params: {
  rate: number;
  benchmarkRate: number;
  isMortgage: boolean;
}) {
  const payload = buildPayload(params);
  const snapshot = {
    creditEff: payload.output.effectiveCreditRate,
    bench: payload.output.benchmarkForComparison,
    margin: payload.output.marginRatio,
  };
  const verdict = payload.output.verdict;
  const marginText =
    Number.isFinite(snapshot.margin) && snapshot.bench > snapshot.creditEff
      ? `Ориентир выше ставки по кредиту на <strong>${(
          snapshot.margin * 100
        ).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%</strong> относительно (порог «сильной» рекомендации во вклад/ОФЗ: ${(BENCHMARK_EXCESS_RATIO_STRONG * 100).toLocaleString("ru-RU")}%).`
      : "";

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Отчет: выгодно ли гасить кредит досрочно</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f8fafc;
      color: #0f172a;
      line-height: 1.45;
    }
    .wrap { max-width: 860px; margin: 0 auto; padding: 28px 16px 40px; }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 18px;
      box-shadow: 0 6px 20px rgba(2, 6, 23, 0.06);
    }
    h1 { font-size: 24px; margin: 0 0 14px; }
    .meta { color: #475569; font-size: 14px; margin: 0 0 12px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .kpi {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
      background: #ffffff;
    }
    .label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
    .value { font-size: 26px; font-weight: 700; margin-top: 6px; }
    .hint { margin-top: 8px; font-size: 13px; color: #64748b; }
    .margin { margin-top: 14px; font-size: 14px; color: #334155; }
    .verdict {
      margin-top: 14px;
      border-radius: 12px;
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      padding: 14px;
    }
    .verdict h2 { margin: 0; font-size: 17px; }
    .verdict p { margin: 8px 0 0; }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="card">
      <h1>Выгодно ли гасить кредит досрочно</h1>
      <p class="meta">
        Входные параметры: ставка по кредиту — <strong>${escapeHtml(
          pct(params.rate)
        )}</strong>,
        ипотека — <strong>${params.isMortgage ? "да" : "нет"}</strong>,
        ставка по вкладу/облигациям — <strong>${escapeHtml(
          pct(params.benchmarkRate)
        )}</strong>.
      </p>
      <div class="grid">
        <section class="kpi">
          <div class="label">Эффективная ставка по кредиту</div>
          <div class="value">${escapeHtml(pct(snapshot.creditEff))}</div>
          ${
            params.isMortgage
              ? '<div class="hint">С учетом +0,5 п.п. для ипотеки</div>'
              : ""
          }
        </section>
        <section class="kpi">
          <div class="label">Ориентир для сравнения</div>
          <div class="value">${escapeHtml(pct(snapshot.bench))}</div>
          <div class="hint">Используется введенная ставка для вклада/облигаций</div>
        </section>
      </div>
      ${marginText ? `<p class="margin">${marginText}</p>` : ""}
      <section class="verdict">
        <h2>${escapeHtml(verdict.title)}</h2>
        <p>${escapeHtml(verdict.body)}</p>
      </section>
    </div>
  </main>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const rate = parseNonNegativeNumber(searchParams.get("rate"));
  const benchmarkRate = parseNonNegativeNumber(searchParams.get("benchmarkRate"));
  const isMortgage = parseBoolean(searchParams.get("isMortgage"));
  const format = parseOutputFormat(searchParams.get("format"));

  if (rate == null || benchmarkRate == null || isMortgage == null || format == null) {
    return NextResponse.json(
      {
        error:
          "Некорректные параметры. Нужны: rate>=0, benchmarkRate>=0, isMortgage=true|false, format=json|ui.",
        example:
          "/api/early-repayment/report?rate=12.5&benchmarkRate=18.2&isMortgage=true&format=json",
      },
      { status: 400 }
    );
  }
  if (format === "ui") {
    const target = new URL("/", url.origin);
    target.searchParams.set("rate", String(rate));
    target.searchParams.set("benchmarkRate", String(benchmarkRate));
    target.searchParams.set("isMortgage", String(isMortgage));
    target.searchParams.set("autocalc", "1");
    return NextResponse.redirect(target);
  }

  const params = { rate, benchmarkRate, isMortgage };
  const payload = buildPayload(params);
  return respondByFormat({
    format,
    payload,
  });
}
