/**
 * The four starting lives. Seed parameters are demo values. Owner: Agent 1.
 * Agent 4's src/data/scenarios.ts should wrap these (titles, art, copy), not redefine numbers.
 */
import type { ArchetypeId, GameConfig, InitialState } from '@/types/domain';
import { DEFAULT_ASSUMPTIONS, DEFAULT_DURATION_MONTHS, DEFAULT_POLICY } from './defaults';

export interface ArchetypeDefinition {
  id: ArchetypeId;
  title: string;
  description: string;
  narrativeFocus: string[];
  initialState: InitialState;
}

const base = (over: Partial<InitialState> & Pick<InitialState, 'employment' | 'household'>): InitialState => ({
  cash: 1500,
  savings: 0,
  investments: { stock: 0, bond: 0, etf: 0 },
  debts: [],
  insurance: { health: 'health_basic', auto: null, renters: null },
  taxProfile: { filingStatus: 'single', note: DEFAULT_ASSUMPTIONS.tax.note },
  policy: { ...DEFAULT_POLICY, insurancePlanIds: { health: 'health_basic', auto: null, renters: null } },
  ...over,
});

export const ARCHETYPES: Record<ArchetypeId, ArchetypeDefinition> = {
  college_student: {
    id: 'college_student',
    title: 'College Student',
    description: 'A part-time job, dorm housing and student loans deferred until graduation teach budgeting and the real cost of credit.',
    narrativeFocus: ['budgeting', 'credit_cards', 'emergency_fund'],
    initialState: base({
      cash: 800,
      savings: 300,
      employment: { status: 'employed', title: 'Part-time barista', grossAnnualSalary: 22000, monthsUnemployedRemaining: 0, priorGrossAnnualSalary: 22000 },
      household: { housingKind: 'dorm', housingMonthly: 550, essentialsMonthly: 400, discretionaryMonthly: 180, dependents: 0 },
      debts: [
        { id: 'cc_1', name: 'Credit card', kind: 'credit_card', balance: 1200, apr: 0.249, minimumPayment: 40 },
        { id: 'student_1', name: 'Student loan', kind: 'student_loan', balance: 14000, apr: 0.055, minimumPayment: 0 },
      ],
      insurance: { health: 'health_basic', auto: null, renters: null },
      policy: { ...DEFAULT_POLICY, savingsContributionPerMonth: 50, investmentContributionPerMonth: 0, extraDebtPaymentPerMonth: 25, insurancePlanIds: { health: 'health_basic', auto: null, renters: null }, minCashBuffer: 150 },
    }),
  },
  entry_worker: {
    id: 'entry_worker',
    title: 'Entry-Level Worker',
    description: 'A first salaried job, renting alone with a car loan and student loans, teaches take-home pay, insurance and how to start investing.',
    narrativeFocus: ['taxes', 'insurance', 'investing_basics', 'debt_payoff'],
    initialState: base({
      cash: 2200,
      savings: 1500,
      employment: { status: 'employed', title: 'Junior analyst', grossAnnualSalary: 58000, monthsUnemployedRemaining: 0, priorGrossAnnualSalary: 58000 },
      household: { housingKind: 'rent', housingMonthly: 1350, essentialsMonthly: 900, discretionaryMonthly: 450, dependents: 0 },
      debts: [
        { id: 'student_1', name: 'Student loan', kind: 'student_loan', balance: 18000, apr: 0.06, minimumPayment: 200 },
        { id: 'auto_1', name: 'Car loan', kind: 'auto_loan', balance: 9000, apr: 0.079, minimumPayment: 220 },
      ],
      insurance: { health: 'health_basic', auto: 'auto_liability', renters: null },
      policy: { ...DEFAULT_POLICY, savingsContributionPerMonth: 250, investmentContributionPerMonth: 150, insurancePlanIds: { health: 'health_basic', auto: 'auto_liability', renters: null } },
    }),
  },
  professional: {
    id: 'professional',
    title: 'Established Professional',
    description: 'A solid income with meaningful investments and higher lifestyle costs teaches allocation, concentration risk and protecting what you have.',
    narrativeFocus: ['allocation', 'concentration_risk', 'insurance', 'tax_awareness'],
    initialState: base({
      cash: 6000,
      savings: 12000,
      investments: { stock: 15000, bond: 5000, etf: 20000 },
      employment: { status: 'employed', title: 'Senior engineer', grossAnnualSalary: 118000, monthsUnemployedRemaining: 0, priorGrossAnnualSalary: 118000 },
      household: { housingKind: 'rent', housingMonthly: 2400, essentialsMonthly: 1500, discretionaryMonthly: 1200, dependents: 0 },
      debts: [{ id: 'auto_1', name: 'Car loan', kind: 'auto_loan', balance: 18000, apr: 0.065, minimumPayment: 420 }],
      insurance: { health: 'health_plus', auto: 'auto_full', renters: 'renters_basic' },
      policy: { ...DEFAULT_POLICY, savingsContributionPerMonth: 500, investmentContributionPerMonth: 1200, targetAllocation: { stock: 0.35, bond: 0.15, etf: 0.5 }, insurancePlanIds: { health: 'health_plus', auto: 'auto_full', renters: 'renters_basic' }, minCashBuffer: 1500 },
    }),
  },
  young_family: {
    id: 'young_family',
    title: 'Young Family',
    description: 'Two dependents on one income with tight margins and real exposure to shocks teach emergency funds, coverage and trade-offs.',
    narrativeFocus: ['emergency_fund', 'insurance', 'budgeting', 'debt_payoff'],
    initialState: base({
      cash: 3000,
      savings: 4000,
      investments: { stock: 0, bond: 2000, etf: 6000 },
      employment: { status: 'employed', title: 'Operations manager', grossAnnualSalary: 86000, monthsUnemployedRemaining: 0, priorGrossAnnualSalary: 86000 },
      household: { housingKind: 'rent', housingMonthly: 1900, essentialsMonthly: 2100, discretionaryMonthly: 450, dependents: 2 },
      debts: [
        { id: 'cc_1', name: 'Credit card', kind: 'credit_card', balance: 4500, apr: 0.229, minimumPayment: 135 },
        { id: 'auto_1', name: 'Minivan loan', kind: 'auto_loan', balance: 16000, apr: 0.071, minimumPayment: 380 },
      ],
      insurance: { health: 'health_family', auto: 'auto_full', renters: 'renters_basic' },
      taxProfile: { filingStatus: 'married_joint', note: DEFAULT_ASSUMPTIONS.tax.note },
      policy: { ...DEFAULT_POLICY, savingsContributionPerMonth: 300, investmentContributionPerMonth: 200, extraDebtPaymentPerMonth: 100, insurancePlanIds: { health: 'health_family', auto: 'auto_full', renters: 'renters_basic' }, minCashBuffer: 1000 },
    }),
  },
};

export function archetypeConfig(id: ArchetypeId, seed: number, opts: { durationMonths?: number; startMonth?: string } = {}): GameConfig {
  const a = ARCHETYPES[id];
  return {
    scenarioId: `archetype:${id}`,
    title: a.title,
    description: a.description,
    mode: 'sandbox',
    archetype: id,
    startMonth: opts.startMonth ?? '2026-01',
    durationMonths: opts.durationMonths ?? DEFAULT_DURATION_MONTHS,
    seed,
    assumptions: structuredClone(DEFAULT_ASSUMPTIONS),
    initialState: structuredClone(a.initialState),
    narrativeFocus: [...a.narrativeFocus],
  };
}
