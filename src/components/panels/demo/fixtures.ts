import type { PanelModel } from '../contracts';
const field = (value: number, max = 5000) => ({ value, min: 0, max, step: 1 });
/** Explicit UI sample data, never financial engine output. */
export const sampleModel: PanelModel = {
  editable: true, cash: 2400, savings: 4200, netWorth: 4600,
  savingsContribution: field(200), investmentContribution: field(150), discretionaryBudget: field(300, 2000),
  bankTools: {
    transferToSavings: { ...field(0, 2400), min: .01, step: .01 },
    transferToCash: { ...field(0, 4200), min: .01, step: .01 },
    extraDebtPayment: field(0), minCashBuffer: field(200)
  },
  debts: [{ id: 'student-loan', name: 'Student loan', balance: 5000, apr: .055, minimumDue: 85, extraPayment: field(0, 2400) }],
  allocation: { stock: .2, bond: .3, etf: .5 }, positions: { stock: 600, bond: 900, etf: 1500 },
  marketAssumptions: [{ asset: 'stock', annualReturn: .07, annualVolatility: .3 }, { asset: 'bond', annualReturn: .03, annualVolatility: .06 }, { asset: 'etf', annualReturn: .06, annualVolatility: .18 }],
  employment: { status: 'Employed', grossAnnual: 48000, grossMonthly: 4000, withholdingMonthly: 720, takeHomeMonthly: 3280, lastPaycheck: { id: 'pay-1', month: 'January 2026', description: 'Paycheck after illustrative withholding', amount: 3280 } },
  housing: { description: 'A small rented apartment near the town square.', rentMonthly: 1100, essentialsMonthly: 550, recurring: [{ id: 'rent', label: 'Rent', amount: -1100 }, { id: 'essentials', label: 'Essentials', amount: -550 }, { id: 'loan', label: 'Scheduled loan service', amount: -85 }] },
  insurance: {
    selected: { health: 'health-basic', renters: 'renters-basic', auto: 'auto-none' },
    plans: [
      { id: 'health-none', kind: 'health', name: 'No health coverage', premiumMonthly: 0, deductible: 0, coverageLimit: 0, assumptions: 'No claims paid; covered protection is zero.', available: true },
      { id: 'health-basic', kind: 'health', name: 'Town health', premiumMonthly: 180, deductible: 1500, coverageLimit: 50000, assumptions: 'Illustrative eligible medical costs only. Deductible and claim caps are applied by the engine.', available: true },
      { id: 'health-plus', kind: 'health', name: 'Town health plus', premiumMonthly: 280, deductible: 500, coverageLimit: 100000, assumptions: 'Illustrative eligible medical costs only; exclusions still apply.', available: true },
      { id: 'renters-basic', kind: 'renters', name: 'Little cottage renters', premiumMonthly: 18, deductible: 500, coverageLimit: 15000, assumptions: 'Eligible personal property only. No building structure or auto coverage.', available: true },
      { id: 'renters-none', kind: 'renters', name: 'No renters coverage', premiumMonthly: 0, deductible: 0, coverageLimit: 0, assumptions: 'No claims paid.', available: true },
      { id: 'auto-none', kind: 'auto', name: 'No auto coverage', premiumMonthly: 0, deductible: 0, coverageLimit: 0, assumptions: 'No claims paid. Fictional scenario option; not guidance on legal coverage requirements.', available: true }
    ], claims: []
  },
  history: { bank: [{ id: 'save-1', month: 'January 2026', description: 'Monthly contribution to savings', amount: 200 }] },
  event: { id: 'job-offer', building: 'office', title: 'An offer from the town library', body: 'A new role is available. The engine would validate the offer before changing employment.', source: 'fallback', options: [{ id: 'accept', label: 'Accept offer', description: 'Review the engine’s validated terms.' }, { id: 'decline', label: 'Decline offer' }] }
};
export const archetypes = ['College student', 'Entry-level worker', 'Established professional', 'Young family'] as const;
export function fixtureFor(index: number): PanelModel {
  const model = structuredClone(sampleModel);
  if (index === 0) {
    model.cash = 120; model.savings = 0; model.netWorth = -11880; model.positions = { stock: 0, bond: 0, etf: 0 };
    model.employment = { status: 'Student / not employed', grossAnnual: 0, grossMonthly: 0, withholdingMonthly: 0, takeHomeMonthly: 0 };
    model.debts = [{ id: 'student', name: 'Student loan', balance: 12000, apr: .06, minimumDue: 100, extraPayment: field(0, 120) }];
    model.insurance.selected = {}; model.insurance.claims = []; model.bankTools = undefined;
  }
  if (index === 2) {
    model.cash = 8000; model.savings = 22000; model.netWorth = 38000; model.positions = { stock: 3000, bond: 2000, etf: 8000 }; model.debts[0]!.extraPayment.max = 5000;
    model.employment = { status: 'Employed', grossAnnual: 96000, grossMonthly: 8000, withholdingMonthly: 1920, takeHomeMonthly: 6080 };
  }
  if (index === 3) {
    model.cash = 1800; model.savings = 3200; model.netWorth = -1000; model.housing.description = 'A rented family home, with childcare in essentials.';
    model.housing.essentialsMonthly = 1200; model.housing.recurring[1]!.amount = -1200;
    model.debts = [{ id: 'family-loan', name: 'Family loan', balance: 9000, apr: .09, minimumDue: 220, extraPayment: field(0, 1800) }];
  }
  return model;
}
