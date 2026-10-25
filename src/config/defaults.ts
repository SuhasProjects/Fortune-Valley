/**
 * Validated demo assumptions. All numbers are illustrative teaching defaults,
 * NOT calibrated real-world probabilities or forecasts. Owner: Agent 1.
 */
import type { Allocation, Assumptions, CarValueBand, InsurancePlan, LifeEventAssumptions, Policy } from '@/types/domain';

export const DISCLAIMER =
  'Fictional educational simulation. All returns, costs, tax rates and event probabilities are illustrative demo assumptions, not forecasts or advice.';

export const INSURANCE_PLANS: InsurancePlan[] = [
  // Health
  { id: 'health_basic', line: 'health', name: 'Basic Health (high deductible)', monthlyPremium: 180, deductible: 4000, coinsurance: 0.3, outOfPocketMax: 8000, coverageCap: null },
  { id: 'health_plus', line: 'health', name: 'Plus Health (low deductible)', monthlyPremium: 340, deductible: 1000, coinsurance: 0.2, outOfPocketMax: 4000, coverageCap: null },
  { id: 'health_family', line: 'health', name: 'Family Health', monthlyPremium: 620, deductible: 2500, coinsurance: 0.2, outOfPocketMax: 7000, coverageCap: null },
  // Auto
  { id: 'auto_liability', line: 'auto', name: 'Auto Liability Only', monthlyPremium: 70, deductible: 0, coinsurance: 1, outOfPocketMax: null, coverageCap: 0 },
  { id: 'auto_full', line: 'auto', name: 'Auto Full Coverage', monthlyPremium: 145, deductible: 1000, coinsurance: 0, outOfPocketMax: null, coverageCap: 25000 },
  // Renters
  { id: 'renters_basic', line: 'renters', name: 'Renters Insurance', monthlyPremium: 18, deductible: 500, coinsurance: 0, outOfPocketMax: null, coverageCap: 20000 },
];

/**
 * Car value bands (illustrative). `runningCost` is billed monthly as `car_costs` (fuel + maintenance +
 * registration); `shockScale` multiplies the auto shock's median cost; `premiumScale` multiplies auto premiums.
 */
export interface CarBandDefinition { label: string; value: string; runningCost: number; shockScale: number; premiumScale: number }
export const CAR_BANDS: Record<CarValueBand, CarBandDefinition> = {
  none: { label: 'No car', value: '—', runningCost: 0, shockScale: 0, premiumScale: 0 },
  cheap: { label: 'Cheap', value: '$3–8k', runningCost: 180, shockScale: 0.8, premiumScale: 0.85 },
  mid: { label: 'Mid-range', value: '$10–20k', runningCost: 260, shockScale: 1, premiumScale: 1 },
  nice: { label: 'Nice', value: '$25k+', runningCost: 380, shockScale: 1.5, premiumScale: 1.3 },
};

export const DEFAULT_ALLOCATION: Allocation = { stock: 0.2, bond: 0.3, etf: 0.5 };

/** Life events: about one every two months, $20–$300, signs paired so a run nets within ±$100. */
export const DEFAULT_LIFE_EVENTS: LifeEventAssumptions = { monthlyIncidence: 0.45, amountMin: 20, amountMax: 300, netCap: 100 };

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  version: 1,
  /**
   * Monthly lognormal (GBM) step per asset: `expectedAnnualReturn` is the ARITHMETIC mean return (the drift is
   * `ln(1+r)/12 − σ²/12/2`, so the monthly mean is (1+r)^(1/12) and the median sits below it, as for a real index).
   * Rounded long-run nominal figures, in the spirit of US data 1926–2024 (Ibbotson/SBBI, Damodaran's NYU history
   * tables, Bloomberg US Aggregate): large-cap stocks ~10%/yr at ~17% vol, a concentrated tech basket
   * ~12%/yr at ~35% vol (single names carry idiosyncratic risk), aggregate bonds ~4.5%/yr at ~6% vol; stock–index
   * correlation ~0.75, stock–bond ~0.1 (ETF–bond follows from the construction). Teaching defaults, not forecasts.
   */
  assets: {
    stock: { label: 'Tech stock basket', expectedAnnualReturn: 0.12, annualVolatility: 0.35 },
    bond: { label: 'Bond fund', expectedAnnualReturn: 0.045, annualVolatility: 0.06 },
    etf: { label: 'S&P 500 index ETF', expectedAnnualReturn: 0.10, annualVolatility: 0.17 },
  },
  correlation: { stockEtf: 0.75, stockBond: 0.1 },
  savingsApy: 0.04,
  tax: {
    kind: 'illustrative_progressive',
    standardDeductionAnnual: 14600,
    brackets: [
      { upTo: 11600, rate: 0.1 },
      { upTo: 47150, rate: 0.12 },
      { upTo: 100525, rate: 0.22 },
      { upTo: 191950, rate: 0.24 },
      { upTo: null, rate: 0.32 },
    ],
    payrollRate: 0.0765,
    note: 'Illustrative withholding: standard deduction + simplified brackets + flat payroll rate. Not tax advice; no state tax, credits or filing logic.',
  },
  insurancePlans: INSURANCE_PLANS,
  shocks: [
    { kind: 'medical', label: 'Medical emergency', monthlyIncidence: 0.04, costMedian: 2500, costSigma: 0.9, costMin: 150, costMax: 60000, coveredBy: 'health' },
    { kind: 'auto', label: 'Car repair / accident', monthlyIncidence: 0.035, costMedian: 1200, costSigma: 0.8, costMin: 100, costMax: 20000, coveredBy: 'auto' },
    { kind: 'home', label: 'Theft / apartment damage', monthlyIncidence: 0.015, costMedian: 1500, costSigma: 0.7, costMin: 100, costMax: 15000, coveredBy: 'renters' },
  ],
  employment: {
    jobLossMonthlyIncidence: 0.009,
    unemploymentDurationMonthsMin: 2,
    unemploymentDurationMonthsMax: 6,
    unemploymentReplacementRate: 0.45,
    unemploymentBenefitMonthlyCap: 2200,
    annualRaiseRate: 0.03,
  },
  lifeEvents: DEFAULT_LIFE_EVENTS,
  overdraftApr: 0.24,
  liquidityShortfallThresholdMonths: 1,
  disclaimer: DISCLAIMER,
};

export const DEFAULT_POLICY: Policy = {
  savingsContributionPerMonth: 200,
  investmentContributionPerMonth: 100,
  targetAllocation: DEFAULT_ALLOCATION,
  extraDebtPaymentPerMonth: 0,
  insurancePlanIds: { health: 'health_basic', auto: null, renters: null },
  emergencyFundingOrder: ['savings', 'investments', 'borrow'],
  minCashBuffer: 300,
};

/** Hard bounds used by validation (engine and AI gateway). */
export const BOUNDS = {
  salaryMax: 1_000_000,
  housingMax: 20_000,
  monthlySpendMax: 50_000,
  cashMax: 10_000_000,
  debtMax: 5_000_000,
  aprMax: 0.6,
  loanPrincipalMax: 100_000,
  loanTermMonthsMin: 6,
  loanTermMonthsMax: 120,
  durationMonthsMin: 6,
  durationMonthsMax: 240,
  contributionMax: 50_000,
  allocationTolerance: 0.001,
} as const;

/** Default playable horizon for every archetype and the custom story (24/48/60 stay allowed via `durationMonths`). Monte Carlo and what-if replay whatever horizon was played. */
export const DEFAULT_DURATION_MONTHS = 36;
export const DEFAULT_MONTE_CARLO_PATHS = 1000;
