import { annuityMonthlyPayment } from "@/lib/amortization";

export type MortgageConditionInput = {
  id: string;
  label: string;
  annualRatePercent: number;
  minDownPaymentPercent: number;
  gracePeriodMonths: number;
  graceRatePercent: number | null;
};

export type MortgageConditionProjection = {
  id: string;
  label: string;
  initialDownPayment: number;
  monthlyPayments: number[];
  monthlyNetPayments: number[];
  monthlyDepositInterest: number[];
  monthlyExtraPrepayment: number[];
  depositCapitalization: number[];
  finalValues: number[];
  cumulativeNetPayments: number[];
  totalPayment: number;
  totalNetPayment: number;
  discountedTotalNetPayment: number;
};

export type MortgageComparisonResult = {
  termMonths: number;
  periods: number[];
  options: MortgageConditionProjection[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function paymentStreamPresentValue(
  payments: number[],
  annualDiscountRatePercent: number
): number {
  const monthlyRate = annualDiscountRatePercent / 100 / 12;
  if (monthlyRate <= 0) {
    return round2(payments.reduce((sum, payment) => sum + payment, 0));
  }
  let total = 0;
  for (let month = 1; month <= payments.length; month++) {
    total += payments[month - 1] / Math.pow(1 + monthlyRate, month);
  }
  return round2(total);
}

function monthlyRate(annualPercent: number): number {
  return annualPercent / 100 / 12;
}

function buildSingleOptionProjection(params: {
  propertyPrice: number;
  maxDownPayment: number;
  termMonths: number;
  annualRatePercent: number;
  minDownPaymentPercent: number;
  gracePeriodMonths: number;
  graceRatePercent: number | null;
  annualDepositRatePercent: number;
  annualDiscountRatePercent: number;
}): Omit<MortgageConditionProjection, "id" | "label"> {
  const {
    propertyPrice,
    maxDownPayment,
    termMonths,
    annualRatePercent,
    minDownPaymentPercent,
    gracePeriodMonths,
    graceRatePercent,
    annualDepositRatePercent,
    annualDiscountRatePercent,
  } = params;

  const initialDownPayment = Math.min(maxDownPayment, propertyPrice);
  const minDownAmountFromPercent = propertyPrice * (minDownPaymentPercent / 100);
  const minDown = Math.min(Math.max(0, minDownAmountFromPercent), initialDownPayment);
  const initialDepositExtra = Math.max(0, initialDownPayment - minDown);

  const monthlyPayments: number[] = [];
  const monthlyNetPayments: number[] = [];
  const monthlyDepositInterest: number[] = [];
  const monthlyExtraPrepayment: number[] = [];
  const depositCapitalization: number[] = [];
  const finalValues: number[] = [];
  const cumulativeNetPayments: number[] = [];

  const graceMonths = Math.max(0, Math.min(gracePeriodMonths, termMonths));
  let balance = Math.max(0, propertyPrice - minDown);
  let cumulativeNet = 0;
  let depositBalance = initialDepositExtra;
  const depositMonthly = monthlyRate(annualDepositRatePercent);

  const mainMonthlyRate = monthlyRate(annualRatePercent);
  const graceMonthlyRate =
    graceMonths > 0 && graceRatePercent != null ? monthlyRate(graceRatePercent) : null;

  let activeRate = graceMonthlyRate ?? mainMonthlyRate;
  let activePayment = annuityMonthlyPayment(balance, activeRate * 12 * 100, termMonths);

  for (let month = 1; month <= termMonths; month++) {
    const inGrace = month <= graceMonths && graceMonthlyRate != null;
    const monthRate = inGrace ? graceMonthlyRate! : mainMonthlyRate;
    let extraPrepayment = 0;

    // If deposit is no longer more profitable, use full deposit as one-time prepayment.
    if (depositBalance > 0 && annualDepositRatePercent <= monthRate * 12 * 100) {
      extraPrepayment = depositBalance;
      balance = Math.max(0, balance - depositBalance);
      depositBalance = 0;
      const remainingMonths = termMonths - month + 1;
      activeRate = monthRate;
      activePayment =
        remainingMonths > 0 && balance > 0
          ? annuityMonthlyPayment(balance, activeRate * 12 * 100, remainingMonths)
          : 0;
    } else if (month === graceMonths + 1 && graceMonths > 0) {
      // Recalculate payment after grace period transition.
      const remainingMonths = termMonths - month + 1;
      activeRate = mainMonthlyRate;
      activePayment =
        remainingMonths > 0 && balance > 0
          ? annuityMonthlyPayment(balance, activeRate * 12 * 100, remainingMonths)
          : 0;
    }

    const scheduledPayment = Math.min(
      balance + balance * monthRate,
      Math.max(0, activePayment)
    );

    const depositInterest =
      depositBalance > 0 && annualDepositRatePercent > monthRate * 12 * 100
        ? depositBalance * depositMonthly
        : 0;
    const netPayment = Math.max(0, scheduledPayment - depositInterest);
    const extraToCapitalize = Math.max(0, depositInterest - scheduledPayment);
    depositBalance = Math.max(0, depositBalance + extraToCapitalize);

    const interestPart = balance * monthRate;
    const principalPart = Math.min(balance, Math.max(0, scheduledPayment - interestPart));
    balance = Math.max(0, balance - principalPart);

    cumulativeNet += netPayment;

    monthlyPayments.push(round2(scheduledPayment));
    monthlyNetPayments.push(round2(netPayment));
    monthlyDepositInterest.push(round2(depositInterest));
    monthlyExtraPrepayment.push(round2(extraPrepayment));
    depositCapitalization.push(round2(depositBalance));
    cumulativeNetPayments.push(round2(cumulativeNet));
    finalValues.push(round2(cumulativeNet - depositBalance));

    if (balance <= 0) {
      for (let rest = month + 1; rest <= termMonths; rest++) {
        monthlyPayments.push(0);
        monthlyNetPayments.push(0);
        monthlyDepositInterest.push(0);
        monthlyExtraPrepayment.push(0);
        depositCapitalization.push(round2(depositBalance));
        cumulativeNetPayments.push(round2(cumulativeNet));
        finalValues.push(round2(cumulativeNet - depositBalance));
      }
      break;
    }
  }

  while (monthlyPayments.length < termMonths) {
    monthlyPayments.push(0);
    monthlyNetPayments.push(0);
    monthlyDepositInterest.push(0);
    monthlyExtraPrepayment.push(0);
    depositCapitalization.push(round2(depositBalance));
    cumulativeNetPayments.push(round2(cumulativeNet));
    finalValues.push(round2(cumulativeNet - depositBalance));
  }

  const totalPayment = round2(monthlyPayments.reduce((sum, payment) => sum + payment, 0));
  const totalNetPayment = round2(
    monthlyNetPayments.reduce((sum, payment) => sum + payment, 0)
  );
  const discountedTotalNetPayment = paymentStreamPresentValue(
    monthlyNetPayments,
    annualDiscountRatePercent
  );

  return {
    initialDownPayment: round2(minDown),
    monthlyPayments,
    monthlyNetPayments,
    monthlyDepositInterest,
    monthlyExtraPrepayment,
    depositCapitalization,
    finalValues,
    cumulativeNetPayments,
    totalPayment,
    totalNetPayment,
    discountedTotalNetPayment,
  };
}

export function buildMortgageConditionsComparison(params: {
  propertyPrice: number;
  maxDownPayment: number;
  annualDepositRatePercent: number;
  termMonths: number;
  annualDiscountRatePercent: number;
  conditions: MortgageConditionInput[];
}): MortgageComparisonResult {
  const {
    propertyPrice,
    maxDownPayment,
    annualDepositRatePercent,
    termMonths,
    annualDiscountRatePercent,
    conditions,
  } = params;

  const options: MortgageConditionProjection[] = conditions.map((condition) => {
    const projection = buildSingleOptionProjection({
      propertyPrice,
      maxDownPayment,
      annualDepositRatePercent,
      termMonths,
      annualRatePercent: condition.annualRatePercent,
      minDownPaymentPercent: condition.minDownPaymentPercent,
      gracePeriodMonths: condition.gracePeriodMonths,
      graceRatePercent: condition.graceRatePercent,
      annualDiscountRatePercent,
    });

    return {
      id: condition.id,
      label: condition.label,
      ...projection,
    };
  });

  return {
    termMonths,
    periods: Array.from({ length: termMonths }, (_, i) => i + 1),
    options,
  };
}
