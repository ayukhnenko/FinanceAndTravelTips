"use client";

import Link from "next/link";
import { useState } from "react";

export default function EarlyRepaymentApiDocsPage() {
  const endpoint = "/api/early-repayment/report";
  const jsonQuery = "?rate=12.5&benchmarkRate=18.2&isMortgage=true&format=json";
  const uiQuery = "?rate=12.5&benchmarkRate=18.2&isMortgage=true&format=ui";
  const jsonUrl = `${endpoint}${jsonQuery}`;
  const uiUrl = `${endpoint}${uiQuery}`;
  const [showJsonExample, setShowJsonExample] = useState(false);
  const jsonExample = `{
  "input": {
    "rate": 12.5,
    "benchmarkRate": 18.2,
    "isMortgage": true
  },
  "output": {
    "effectiveCreditRate": 13,
    "benchmarkForComparison": 18.2,
    "marginRatio": 0.4,
    "marginPercent": 40,
    "verdict": {
      "code": "invest_strong",
      "title": "Вывод",
      "body": "Ориентир заметно выше вашей эффективной ставки по кредиту..."
    },
    "strongRecommendationThresholdPercent": 13
  }
}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
        API: Выгодно ли гасить кредит досрочно
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
        Этот API возвращает JSON-результат расчета по входным параметрам.
        В формате <code>ui</code> API перенаправляет на страницу калькулятора с
        заполненной формой и уже отображенным результатом.
      </p>

      <section className="card-panel mt-8 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Endpoint</h2>
        <code className="block rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm">
          {endpoint}
        </code>
      </section>

      <section className="card-panel mt-5 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Входные параметры (query)
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--foreground)]">
          <li>
            <code>rate</code> - ставка по кредиту в процентах годовых, число
            больше или равно 0
          </li>
          <li>
            <code>benchmarkRate</code> - ставка, по которой можно открыть вклад
            или купить облигации, число больше или равно 0
          </li>
          <li>
            <code>isMortgage</code> - признак ипотеки: <code>true</code> или{" "}
            <code>false</code>
          </li>
          <li>
            <code>format</code> - формат ответа: <code>json</code>,{" "}
            <code>ui</code> (по умолчанию: <code>json</code>)
          </li>
        </ul>
      </section>

      <section className="card-panel mt-5 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Выходные параметры (JSON)</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--foreground)]">
          <li><code>input.rate</code> - ставка по кредиту из запроса</li>
          <li><code>input.benchmarkRate</code> - ставка вклада/облигаций из запроса</li>
          <li><code>input.isMortgage</code> - признак ипотеки из запроса</li>
          <li><code>output.effectiveCreditRate</code> - эффективная ставка кредита (с учетом +0.5 п.п. для ипотеки)</li>
          <li><code>output.benchmarkForComparison</code> - ставка ориентира для сравнения</li>
          <li><code>output.marginRatio</code> - относительный разрыв (доля)</li>
          <li><code>output.marginPercent</code> - относительный разрыв в процентах</li>
          <li><code>output.verdict.code</code> - код рекомендации</li>
          <li><code>output.verdict.title</code> / <code>output.verdict.body</code> - текст рекомендации</li>
          <li><code>output.strongRecommendationThresholdPercent</code> - порог для сильной рекомендации</li>
        </ul>
      </section>

      <section className="card-panel mt-5 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Примеры вызова</h2>
        <code className="block overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm">
          {jsonUrl}
        </code>
        <code className="block overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm">
          {uiUrl}
        </code>
        <a href={uiUrl} className="btn-primary inline-flex w-auto">
          Открыть в интерфейсе калькулятора
        </a>
        <button
          type="button"
          onClick={() => setShowJsonExample((v) => !v)}
          className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
        >
          Открыть пример
        </button>
        {showJsonExample ? (
          <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--foreground)]">
            {jsonExample}
          </pre>
        ) : null}
      </section>

      <section className="card-panel mt-5 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Ошибки</h2>
        <p className="text-sm text-[var(--muted)]">
          При некорректных параметрах API вернет <code>400</code> и JSON с
          описанием ошибки и примером валидного URL.
        </p>
      </section>

      <div className="mt-6">
        <Link href="/" className="link-accent text-sm">
          Перейти к калькулятору
        </Link>
      </div>
    </div>
  );
}
