import type { GameConfig, GameState, Policy } from '../types/domain'

const policy = (savings: number, investments: number): Policy => ({ savingsContributionPerMonth: savings, investmentContributionPerMonth: investments, extraDebtPaymentPerMonth: 0, targetAllocation: { stock: .2, bond: .2, etf: .6 }, insurancePlanIds: ['health-basic'], emergencyFundingOrder: ['cash', 'savings', 'borrow'] })
const state = (id: string, seed: number, values: { cash: number; savings: number; stock?: number; bond?: number; etf?: number; pay: number; employment?: 'employed'|'part_time'; expenses: number; rent: number; debt: number; debtName: string; debtApr: number; minimum: number; save: number; invest: number }): GameState => ({
  monthIndex: 0, status: 'setup', cash: values.cash, savings: values.savings, investments: { stock: values.stock ?? 0, bond: values.bond ?? 0, etf: values.etf ?? 0 }, debts: [{ id: `${id}-debt`, name: values.debtName, balance: values.debt, apr: values.debtApr, minimumPayment: values.minimum }], employment: { grossAnnualPay: values.pay, status: values.employment ?? 'employed' }, household: { monthlyEssentialExpenses: values.expenses, rent: values.rent }, insurance: [{ id: 'health-basic', name: 'Basic health plan', premium: 180, deductible: 2500, coverage: .8 }], taxProfile: { withholdingRate: .18 }, marketState: { lastMonthlyReturn: 0 }, activeEvent: null, ledger: [], notifications: [], timeline: [], policies: policy(values.save, values.invest), replayLog: [], seed, scenarioId: id
})
const assumptions = { taxRate: .18, monthlyReturn: .004, savingsApy: .035, shockChance: .06, notes: ['Illustrative demo assumptions, not population averages or personal forecasts.', 'Insurance changes out-of-pocket cost, never event likelihood.'] }
const make = (scenarioId: string, title: string, description: string, seed: number, initialState: GameState, narrativeFocus: string[]): GameConfig => ({ scenarioId, title, description, mode: 'sandbox', startMonth: '2026-01', durationMonths: 24, seed, assumptions, initialState, narrativeFocus })

export const scenarios: GameConfig[] = [
  make('college_student', 'College Student', 'Balance part-time income, rent, student debt, and a first emergency fund.', 104729, state('college_student', 104729, { cash: 900, savings: 700, pay: 18000, employment: 'part_time', expenses: 560, rent: 650, debt: 12500, debtName: 'Student loan', debtApr: .052, minimum: 125, save: 50, invest: 0 }), ['debt', 'emergency fund']),
  make('entry_level', 'Entry-Level Worker', 'Build steady habits while managing rent, a car loan, and new benefits.', 130363, state('entry_level', 130363, { cash: 1800, savings: 2200, etf: 600, pay: 52000, expenses: 1050, rent: 1350, debt: 9200, debtName: 'Auto loan', debtApr: .069, minimum: 245, save: 250, invest: 150 }), ['benefits', 'investing']),
  make('established_professional', 'Established Professional', 'Revisit allocation and protection while lifestyle costs grow.', 155921, state('established_professional', 155921, { cash: 6500, savings: 18000, stock: 12000, bond: 8000, etf: 32000, pay: 118000, expenses: 2200, rent: 2600, debt: 18000, debtName: 'Auto loan', debtApr: .049, minimum: 390, save: 700, invest: 1000 }), ['allocation', 'insurance']),
  make('young_family', 'Young Family', 'Coordinate a simplified two-earner household budget and family coverage.', 196613, state('young_family', 196613, { cash: 4800, savings: 11500, etf: 12500, pay: 96000, expenses: 2700, rent: 2200, debt: 23500, debtName: 'Auto and education debt', debtApr: .061, minimum: 520, save: 450, invest: 350 }), ['liquidity', 'household insurance'])
]
export const scenarioById = (id: string) => scenarios.find(s => s.scenarioId === id)

export interface FallbackOpportunity { template: 'offer_job'|'budget_choice'|'loan_choice'; title: string; body: string; building: 'office'|'home'|'bank' }
export const fallbackOpportunities: FallbackOpportunity[] = [
  { template: 'offer_job', title: 'New role to consider', body: 'A role with higher gross pay is available. Benefits and commute are simplified in this demo.', building: 'office' },
  { template: 'budget_choice', title: 'Subscription check-in', body: 'Review a recurring discretionary cost and decide whether to redirect it toward savings.', building: 'home' },
  { template: 'loan_choice', title: 'Debt payment check-in', body: 'Your bank invites you to review your extra-payment policy. No refinance terms are assumed.', building: 'bank' }
]
