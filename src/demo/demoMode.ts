/**
 * The /demo route: a scripted run for recordings. Whatever the custom-story letter says, the valley answers with
 * "The Overloaded Graduate" (fixed seed, no AI call), and the engine lands these happenings on fixed months instead
 * of random rolls. The flag lives in sessionStorage so it survives the title → town → ending transitions and reloads
 * in the same tab; a new tab without /demo is an ordinary game. Owner: Agent 1.
 */
import type { GameConfig, RunScript } from '@/types/domain';
import { archetypeConfig } from '@/config/archetypes';

export const DEMO_STORAGE_KEY = 'fv-demo';
export const DEMO_SEED = 20261025;

const storage = (): Storage | null => {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; }
};

/** Reads the URL once per call: `/demo` or `?demo=1` turns the mode on, `?demo=0` turns it off; otherwise the stored flag. */
export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  const st = storage();
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('demo');
    const on = q === '1' || q === 'true' || /^\/demo\/?$/.test(url.pathname);
    if (on) { st?.setItem(DEMO_STORAGE_KEY, '1'); return true; }
    if (q === '0' || q === 'false') { st?.removeItem(DEMO_STORAGE_KEY); return false; }
    return st?.getItem(DEMO_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** The happenings of the demo, in story order. Amounts are gross; the active health plan decides who pays the hospital. */
export const DEMO_SCRIPT: RunScript = {
  exclusive: 'played',
  // What the 1,000 simulated futures roll instead of the scripted hospital bills: ordinary health luck, most bills
  // modest, the odd huge one (where the plans differ most). The played run, with its two big bills, lands unlucky.
  simulationShocks: [
    { kind: 'medical', label: 'Medical emergency', monthlyIncidence: 0.085, costMedian: 1600, costSigma: 1.5, costMin: 100, costMax: 60000, coveredBy: 'health' },
  ],
  events: [
    { monthIndex: 6, kind: 'life', amountSigned: -250, label: 'college textbooks', headline: 'Textbook bill lands', scene: 'The reading list for your evening course came with three required textbooks. The campus shop took $250 for the lot.' },
    { monthIndex: 8, kind: 'life', amountSigned: 200, label: 'birthday gift from your grandma', headline: 'Grandma remembers', scene: 'A card in your grandmother\'s handwriting arrived two days before your birthday with $200 folded inside.' },
    { monthIndex: 12, kind: 'shock', shockKind: 'medical', grossCost: 20000, variant: 'er_night' },
    { monthIndex: 16, kind: 'life', amountSigned: 50, label: 'credit card cashback', headline: 'Cashback credited', scene: 'The card company posted $50 of cashback to your account, the reward for a year of on-time payments.' },
    { monthIndex: 22, kind: 'shock', shockKind: 'medical', grossCost: 12000, variant: 'er_night' },
  ],
};

/** The scripted run: a graduate on $30k with ~$50k of debt, no car, rent $340, starting on the $340 Plus Health plan. */
export function demoConfig(): GameConfig {
  const cfg = archetypeConfig('entry_worker', DEMO_SEED);
  const st = cfg.initialState;
  st.cash = 900;
  st.savings = 400;
  st.employment = { status: 'employed', title: 'Junior lab technician', grossAnnualSalary: 30000, monthsUnemployedRemaining: 0, priorGrossAnnualSalary: 30000 };
  st.household = { housingKind: 'rent', housingMonthly: 340, essentialsMonthly: 560, discretionaryMonthly: 160, dependents: 0 };
  st.debts = [
    { id: 'debt_1', name: 'Student loan', kind: 'student_loan', balance: 38000, apr: 0.06, minimumPayment: 380 },
    { id: 'debt_2', name: 'Credit card', kind: 'credit_card', balance: 12000, apr: 0.249, minimumPayment: 300 },
  ];
  st.car = { owned: false, valueBand: 'none' };
  st.insurance = { health: 'health_plus', auto: null, renters: null };
  st.policy = { ...st.policy, savingsContributionPerMonth: 0, investmentContributionPerMonth: 0, extraDebtPaymentPerMonth: 0, insurancePlanIds: { health: 'health_plus', auto: null, renters: null }, minCashBuffer: 0 };
  // Nothing but the script moves: no raises, no job loss, no random shocks or life events (exclusive script above).
  cfg.assumptions.employment = { ...cfg.assumptions.employment, annualRaiseRate: 0, jobLossMonthlyIncidence: 0 };
  return {
    ...cfg,
    scenarioId: 'demo:overloaded-graduate',
    title: 'The Overloaded Graduate',
    description: 'Fresh out of college with $50,000 of loans, a $30,000 lab job, no car and a $340 room: every dollar has a job, and one bad month could undo a year.',
    mode: 'personalized',
    narrativeFocus: ['insurance', 'debt_payoff', 'emergency_fund'],
    script: structuredClone(DEMO_SCRIPT),
  };
}
