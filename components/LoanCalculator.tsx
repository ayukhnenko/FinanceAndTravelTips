"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildSchedule,
  scheduleTotals,
  type LoanInput,
  type PaymentType,
  type ScheduleRow,
} from "@/lib/amortization";
import { useI18n } from "@/components/I18nProvider";

export type LoanCalculatorInitial = {
  principal?: string;
  annualRate?: string;
  termYears?: string;
  paymentType?: PaymentType;
};

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const rubCompact = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  notation: "compact",
  maximumFractionDigits: 1,
});

function aggregateByYear(rows: ScheduleRow[]) {
  const map = new Map<
    number,
    { payment: number; principalPart: number; interestPart: number }
  >();
  for (const row of rows) {
    const year = Math.ceil(row.period / 12);
    const cur = map.get(year) ?? {
      payment: 0,
      principalPart: 0,
      interestPart: 0,
    };
    cur.payment += row.payment;
    cur.principalPart += row.principalPart;
    cur.interestPart += row.interestPart;
    map.set(year, cur);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, v]) => ({
      label: `${year} г.`,
      period: year,
      ...v,
    }));
}

function normalizePrincipalInput(raw: string | undefined): string {
  if (raw == null || String(raw).trim() === "") return "";
  const n = Number(String(raw).replace(/\s/g, ""));
  if (!Number.isFinite(n) || n <= 0) return String(raw);
  return n.toLocaleString("ru-RU").replace(/\u202f/g, " ");
}

export default function LoanCalculator({
  initial,
}: {
  initial?: LoanCalculatorInitial;
}) {
  const { tr } = useI18n();
  const [principal, setPrincipal] = useState(() =>
    initial?.principal != null && String(initial.principal).trim() !== ""
      ? normalizePrincipalInput(initial.principal)
      : ""
  );
  const [annualRate, setAnnualRate] = useState(
    () =>
      initial?.annualRate != null && String(initial.annualRate).trim() !== ""
        ? initial.annualRate
        : ""
  );
  const [termYears, setTermYears] = useState(
    () =>
      initial?.termYears != null && String(initial.termYears).trim() !== ""
        ? initial.termYears
        : ""
  );
  const [paymentType, setPaymentType] = useState<PaymentType>(
    () => initial?.paymentType ?? "annuity"
  );
  const [viewMode, setViewMode] = useState<"month" | "year">("month");

  const parsed = useMemo(() => {
    const p = Number(principal.replace(/\s/g, "").replace(/_/g, ""));
    const rate = Number(annualRate.replace(",", "."));
    const years = Number(termYears.replace(",", "."));
    return {
      principal: p,
      annualRatePercent: rate,
      termMonths: Math.max(1, Math.round(years * 12)),
      valid:
        Number.isFinite(p) &&
        p > 0 &&
        Number.isFinite(rate) &&
        rate >= 0 &&
        Number.isFinite(years) &&
        years > 0,
    };
  }, [principal, annualRate, termYears]);

  const loanInput: LoanInput | null = useMemo(() => {
    if (!parsed.valid) return null;
    return {
      principal: parsed.principal,
      annualRatePercent: parsed.annualRatePercent,
      termMonths: parsed.termMonths,
      paymentType,
    };
  }, [parsed, paymentType]);

  const schedule = useMemo(
    () => (loanInput ? buildSchedule(loanInput) : []),
    [loanInput]
  );

  const totals = useMemo(() => scheduleTotals(schedule), [schedule]);

  const useYearlyChart = schedule.length > 120 || viewMode === "year";

  const chartData = useMemo(() => {
    if (schedule.length === 0) return [];
    if (useYearlyChart) {
      return aggregateByYear(schedule);
    }
    return schedule.map((r) => ({
      label: `${r.period}`,
      period: r.period,
      payment: r.payment,
      principalPart: r.principalPart,
      interestPart: r.interestPart,
    }));
  }, [schedule, useYearlyChart]);

  const firstPayment = schedule[0]?.payment ?? 0;
  const lastPayment = schedule[schedule.length - 1]?.payment ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
          {tr("Калькулятор кредита", "Loan Calculator")}
        </h1>
      </header>

      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        <aside
          className="card-panel h-fit space-y-5 !shadow-[var(--shadow-card)]"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--muted)]">
              {tr("Сумма кредита, ₽", "Loan Amount, ₽")}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              className="field-input"
              placeholder={tr("например 3 000 000", "e.g. 3 000 000")}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--muted)]">
              {tr("Процентная ставка в год, %", "Annual interest rate, %")}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={annualRate}
              onChange={(e) => setAnnualRate(e.target.value)}
              className="field-input"
              placeholder={tr("например 12", "e.g. 12")}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--muted)]">
              {tr("Срок, лет", "Term, years")}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={termYears}
              onChange={(e) => setTermYears(e.target.value)}
              className="field-input"
              placeholder={tr("например 20", "e.g. 20")}
            />
          </label>

          <fieldset>
            <legend className="mb-2 text-sm text-[var(--muted)]">
              {tr("Тип платежей", "Payment type")}
            </legend>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)]">
                <input
                  type="radio"
                  name="ptype"
                  checked={paymentType === "annuity"}
                  onChange={() => setPaymentType("annuity")}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span>{tr("Аннуитетный", "Annuity")}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)]">
                <input
                  type="radio"
                  name="ptype"
                  checked={paymentType === "differentiated"}
                  onChange={() => setPaymentType("differentiated")}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span>{tr("Дифференцированный", "Differentiated")}</span>
              </label>
            </div>
          </fieldset>

          <div>
            <span className="mb-2 block text-sm text-[var(--muted)]">
              {tr("График", "Chart")}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setViewMode("month")}
                disabled={schedule.length > 120}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  !useYearlyChart
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--input-bg)] hover:bg-[var(--accent-soft)]/40"
                }`}
              >
                {tr("По месяцам", "By months")}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("year")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
                  useYearlyChart
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--input-bg)] hover:bg-[var(--accent-soft)]/40"
                }`}
              >
                {tr("По годам", "By years")}
              </button>
            </div>
            {schedule.length > 120 && (
              <p className="mt-2 text-xs text-[var(--muted)]">
                {tr(
                  "Срок > 10 лет: график по умолчанию агрегирован по годам.",
                  "Term > 10 years: chart is aggregated by years by default."
                )}
              </p>
            )}
          </div>
        </aside>

        <section className="space-y-6">
          {!parsed.valid ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-amber-900">
              {tr(
                "Проверьте ввод: сумма и срок должны быть больше нуля.",
                "Check input: amount and term must be greater than zero."
              )}
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label={tr("Срок", "Term")}
                  value={`${parsed.termMonths} ${tr("мес.", "mo.")}`}
                  sub={`≈ ${(parsed.termMonths / 12).toFixed(1)} ${tr("г.", "yr.")}`}
                />
                <StatCard
                  label={
                    paymentType === "annuity"
                      ? tr("Ежемесячный платёж", "Monthly payment")
                      : tr("Платёж (1-й / последн.)", "Payment (first / last)")
                  }
                  value={
                    paymentType === "annuity"
                      ? rub.format(firstPayment)
                      : `${rub.format(firstPayment)} / ${rub.format(lastPayment)}`
                  }
                />
                <StatCard
                  label={tr("Всего процентов", "Total interest")}
                  value={rub.format(totals.totalInterest)}
                />
                <StatCard
                  label={tr("Всего к доплате", "Total Paid")}
                  value={rub.format(totals.totalPayment)}
                />
              </div>

              <div className="card-panel !p-4 pb-2 sm:!p-6 !shadow-[var(--shadow-card)]">
                <h3 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
                  {tr("Структура платежа: тело долга и проценты", "Payment structure: principal and interest")}
                </h3>
                <div className="h-[320px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="colorPrincipal"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#21a038"
                            stopOpacity={0.85}
                          />
                          <stop
                            offset="95%"
                            stopColor="#21a038"
                            stopOpacity={0.15}
                          />
                        </linearGradient>
                        <linearGradient
                          id="colorInterest"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#f97316"
                            stopOpacity={0.85}
                          />
                          <stop
                            offset="95%"
                            stopColor="#f97316"
                            stopOpacity={0.15}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--chart-grid)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "var(--chart-tick)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--chart-grid)" }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fill: "var(--chart-tick)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => rubCompact.format(v as number)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#ffffff",
                          border: "1px solid var(--border)",
                          borderRadius: "12px",
                          boxShadow: "var(--shadow-card)",
                        }}
                        labelStyle={{ color: "var(--foreground)" }}
                        formatter={(value: number, name: string) => [
                          rub.format(value),
                          name === "principalPart"
                            ? tr("Погашение долга", "Principal repayment")
                            : tr("Проценты", "Interest"),
                        ]}
                      />
                      <Legend
                        formatter={(value) =>
                          value === "principalPart"
                            ? tr("Погашение долга", "Principal repayment")
                            : tr("Проценты", "Interest")
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="interestPart"
                        name="interestPart"
                        stackId="1"
                        stroke="#f97316"
                        fill="url(#colorInterest)"
                      />
                      <Area
                        type="monotone"
                        dataKey="principalPart"
                        name="principalPart"
                        stackId="1"
                        stroke="#198030"
                        fill="url(#colorPrincipal)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <ScheduleTable rows={schedule} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card-panel !p-5 !shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-[var(--foreground)] sm:text-xl">
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>
      ) : null}
    </div>
  );
}

function ScheduleTable({ rows }: { rows: ScheduleRow[] }) {
  const { tr } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, 12);

  return (
    <div className="card-panel !overflow-hidden !p-0 !shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">
          {tr("График платежей", "Payment schedule")}
        </h3>
        {rows.length > 12 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-sm font-medium text-[var(--link)] hover:text-[var(--accent-hover)]"
          >
            {showAll
              ? tr("Свернуть", "Collapse")
              : tr(`Все ${rows.length} месяцев`, `Show all ${rows.length} months`)}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--muted)]">
              <th className="px-5 py-3 font-medium">#</th>
              <th className="px-5 py-3 font-medium">{tr("Платёж", "Payment")}</th>
              <th className="px-5 py-3 font-medium">{tr("Долг", "Principal")}</th>
              <th className="px-5 py-3 font-medium">{tr("Проценты", "Interest")}</th>
              <th className="px-5 py-3 font-medium">{tr("Остаток", "Balance")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {visible.map((r) => (
              <tr key={r.period} className="hover:bg-[var(--accent-soft)]/35">
                <td className="px-5 py-2.5 tabular-nums text-[var(--muted)]">
                  {r.period}
                </td>
                <td className="px-5 py-2.5 tabular-nums">{rub.format(r.payment)}</td>
                <td className="px-5 py-2.5 tabular-nums font-medium text-[var(--accent)]">
                  {rub.format(r.principalPart)}
                </td>
                <td className="px-5 py-2.5 tabular-nums text-[#b45309]">
                  {rub.format(r.interestPart)}
                </td>
                <td className="px-5 py-2.5 tabular-nums text-[var(--muted)]">
                  {rub.format(r.balanceAfter)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
