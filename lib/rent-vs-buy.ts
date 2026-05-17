export type RentVsBuyYearRow = {
  year: number;
  rentCapital: number;
  buyApartmentValue: number;
  buySavings: number;
  buyCapital: number;
};

export type RentVsBuyProjection = {
  monthlyMortgagePayment: number;
  depRateAfterTax: number;
  yearlyRows: RentVsBuyYearRow[];
  finalRentCapital: number;
  finalBuyCapital: number;
};

const DEPOSIT_TAX_RATE_PERCENT = 13;

export function depositRateAfterTax(annualRatePercent: number): number {
  return annualRatePercent * (1 - DEPOSIT_TAX_RATE_PERCENT / 100);
}

export function presentValue(
  futureValue: number,
  annualDiscountPercent: number,
  years: number
): number {
  if (years <= 0) return futureValue;
  const r = annualDiscountPercent / 100;
  return futureValue / Math.pow(1 + r, years);
}

/** Суммарный рост за весь срок при постоянном годовом % (сложный процент). */
export function totalGrowthPercent(annualPercent: number, years: number): number {
  if (years <= 0) return 0;
  return (Math.pow(1 + annualPercent / 100, years) - 1) * 100;
}

export function monthlyRentScenarioContribution(
  monthlyMortgagePayment: number,
  monthlyRent: number
): number {
  if (monthlyRent < monthlyMortgagePayment) {
    return monthlyMortgagePayment - monthlyRent;
  }
  return 0;
}

export function monthlyBuyScenarioContribution(
  monthlyMortgagePayment: number,
  monthlyRent: number
): number {
  if (monthlyMortgagePayment < monthlyRent) {
    return monthlyRent - monthlyMortgagePayment;
  }
  return 0;
}

export function buildRentVsBuyProjection(params: {
  downPayment: number;
  apartmentPrice: number;
  baseMonthlyRent: number;
  monthlyMortgagePayment: number;
  depositRatePercent: number;
  termYears: number;
  annualGrowthPercent?: number;
}): RentVsBuyProjection {
  const {
    downPayment,
    apartmentPrice,
    baseMonthlyRent,
    monthlyMortgagePayment,
    depositRatePercent,
    termYears,
    annualGrowthPercent = 0,
  } = params;

  const termMonths = Math.round(termYears * 12);
  const monthlyDepositRate = depositRatePercent / 100 / 12;
  const annualGrowth = annualGrowthPercent / 100;

  let rentDeposit = downPayment;
  let buySavings = 0;

  const yearlyRows: RentVsBuyYearRow[] = [
    {
      year: 0,
      rentCapital: downPayment,
      buyApartmentValue: apartmentPrice,
      buySavings: 0,
      buyCapital: apartmentPrice,
    },
  ];

  const pushYearRow = (yearsElapsed: number) => {
    const buyApartmentValue = apartmentPrice * Math.pow(1 + annualGrowth, yearsElapsed);
    yearlyRows.push({
      year: yearsElapsed,
      rentCapital: rentDeposit,
      buyApartmentValue,
      buySavings,
      buyCapital: buyApartmentValue + buySavings,
    });
  };

  for (let month = 1; month <= termMonths; month++) {
    rentDeposit *= 1 + monthlyDepositRate;
    buySavings *= 1 + monthlyDepositRate;

    const yearIndex = Math.floor((month - 1) / 12);
    const rentThisMonth = baseMonthlyRent * Math.pow(1 + annualGrowth, yearIndex);

    rentDeposit += monthlyRentScenarioContribution(monthlyMortgagePayment, rentThisMonth);
    buySavings += monthlyBuyScenarioContribution(monthlyMortgagePayment, rentThisMonth);

    if (month % 12 === 0) {
      pushYearRow(month / 12);
    }
  }

  if (termMonths % 12 !== 0) {
    pushYearRow(termYears);
  }

  const last = yearlyRows[yearlyRows.length - 1];
  return {
    monthlyMortgagePayment,
    depRateAfterTax: depositRatePercent,
    yearlyRows,
    finalRentCapital: last.rentCapital,
    finalBuyCapital: last.buyCapital,
  };
}

export function findBreakEvenGrowthPercent(params: {
  downPayment: number;
  apartmentPrice: number;
  baseMonthlyRent: number;
  monthlyMortgagePayment: number;
  depositRatePercent: number;
  termYears: number;
}): number | null {
  const diff = (growth: number) => {
    const projection = buildRentVsBuyProjection({ ...params, annualGrowthPercent: growth });
    return projection.finalBuyCapital - projection.finalRentCapital;
  };

  let left = -30;
  let right = 30;
  let fLeft = diff(left);
  let fRight = diff(right);

  for (let i = 0; i < 6 && fLeft * fRight > 0; i++) {
    left -= 20;
    right += 20;
    fLeft = diff(left);
    fRight = diff(right);
  }

  if (fLeft === 0) return left;
  if (fRight === 0) return right;
  if (fLeft * fRight > 0) return null;

  for (let i = 0; i < 80; i++) {
    const mid = (left + right) / 2;
    const fMid = diff(mid);
    if (Math.abs(fMid) < 1) return mid;
    if (fLeft * fMid <= 0) {
      right = mid;
      fRight = fMid;
    } else {
      left = mid;
      fLeft = fMid;
    }
  }

  return (left + right) / 2;
}
