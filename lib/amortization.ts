export type PaymentType = "annuity" | "differentiated";

export type LoanInput = {
  principal: number;
  annualRatePercent: number;
  termMonths: number;
  paymentType: PaymentType;
};

export type ScheduleRow = {
  period: number;
  payment: number;
  principalPart: number;
  interestPart: number;
  balanceAfter: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Месячная ставка (доля, не %) */
function monthlyRate(annualPercent: number): number {
  return annualPercent / 100 / 12;
}

/** Аннуитетный платёж */
export function annuityMonthlyPayment(
  principal: number,
  annualPercent: number,
  termMonths: number
): number {
  const r = monthlyRate(annualPercent);
  if (r === 0) return round2(principal / termMonths);
  const pow = Math.pow(1 + r, termMonths);
  return round2((principal * r * pow) / (pow - 1));
}

export function buildSchedule(input: LoanInput): ScheduleRow[] {
  const { principal, annualRatePercent, termMonths, paymentType } = input;
  const r = monthlyRate(annualRatePercent);
  const rows: ScheduleRow[] = [];
  let balance = principal;

  if (paymentType === "annuity") {
    const monthly = annuityMonthlyPayment(
      principal,
      annualRatePercent,
      termMonths
    );
    for (let p = 1; p <= termMonths; p++) {
      const interestPart = round2(balance * r);
      let principalPart = round2(monthly - interestPart);
      if (principalPart > balance) principalPart = round2(balance);
      const payment = round2(principalPart + interestPart);
      balance = round2(balance - principalPart);
      if (p === termMonths && balance !== 0) {
        principalPart = round2(principalPart + balance);
        balance = 0;
      }
      rows.push({
        period: p,
        payment,
        principalPart,
        interestPart,
        balanceAfter: Math.max(0, balance),
      });
    }
    return rows;
  }

  const principalBase = round2(principal / termMonths);
  for (let p = 1; p <= termMonths; p++) {
    const interestPart = round2(balance * r);
    const isLast = p === termMonths;
    const principalPart = isLast
      ? round2(balance)
      : round2(Math.min(principalBase, balance));
    const payment = round2(principalPart + interestPart);
    balance = round2(balance - principalPart);
    rows.push({
      period: p,
      payment,
      principalPart,
      interestPart,
      balanceAfter: Math.max(0, balance),
    });
  }
  return rows;
}

export function scheduleTotals(rows: ScheduleRow[]) {
  let totalPayment = 0;
  let totalInterest = 0;
  for (const row of rows) {
    totalPayment += row.payment;
    totalInterest += row.interestPart;
  }
  return {
    totalPayment: round2(totalPayment),
    totalInterest: round2(totalInterest),
  };
}
