/**
 * Validated demo assumptions. All numbers are illustrative teaching defaults,
 * NOT calibrated real-world probabilities or forecasts. Owner: Agent 1.
 */
import type { Allocation, Assumptions, InsurancePlan, Policy } from '@/types/domain';

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

export const DEFAULT_ALLOCATION: Allocation = { stock: 0.2, bond: 0.3, etf: 0.5 };

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  version: 1,
  assets: {
    stock: { label: 'Single-stock basket', expectedAnnualReturn: 0.08, annualVolatility: 0.3 },
    bond: { label: 'Bond fund', expectedAnnualReturn: 0.035, annualVolatility: 0.06 },
    etf: { label: 'Diversified stock ETF', expectedAnnualReturn: 0.07, annualVolatility: 0.16 },
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
    { kind: 'medical', label: 'Medical emergency', monthlyIncidence: 0.025, costMedian: 2500, costSigma: 0.9, costMin: 150, costMax: 60000, coveredBy: 'health' },
    { kind: 'auto', label: 'Car repair / accident', monthlyIncidence: 0.02, costMedian: 1200, costSigma: 0.8, costMin: 100, costMax: 20000, coveredBy: 'auto' },
    { kind: 'home', label: 'Theft / apartment damage', monthlyIncidence: 0.008, costMedian: 1500, costSigma: 0.7, costMin: 100, costMax: 15000, coveredBy: 'renters' },
  ],
  employment: {
    jobLossMonthlyIncidence: 0.006,
    unemploymentDurationMonthsMin: 2,
    unemploymentDurationMonthsMax: 6,
    unemploymentReplacementRate: 0.45,
    unemploymentBenefitMonthlyCap: 2200,
    annualRaiseRate: 0.03,
  },
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

export const DEFAULT_DURATION_MONTHS = 60;
export const DEFAULT_MONTE_CARLO_PATHS = 1000;
