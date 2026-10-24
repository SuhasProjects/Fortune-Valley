/**
 * Read-only derived values for UI, store and AI. Owner: Agent 1.
 */
import type { GameState, StateSummary } from '@/types/domain';
import { debtTotal, investmentsTotal, monthLabel, netWorthOf } from './accounting';

export const selectNetWorth = netWorthOf;
export const selectInvestmentsTotal = (s: GameState): number => investmentsTotal(s.investments);
export const selectDebtTotal = (s: GameState): number => debtTotal(s);
export const selectMonthLabel = (s: GameState): string => monthLabel(s.startMonth, s.monthIndex);

export function selectMonthsOfEssentialsCovered(s: GameState): number {
  const essentials = s.household.housingMonthly + s.household.essentialsMonthly;
  if (essentials <= 0) return 99;
  return Math.round(((s.cash + s.savings) / essentials) * 10) / 10;
}

export function selectMonthlyTakeHome(s: GameState, withholdingAnnual: number): number {
  if (s.employment.status !== 'employed') return 0;
  return Math.round((s.employment.grossAnnualSalary - withholdingAnnual) / 12);
}

/** Ledger entries for a given month, newest first. */
export const selectLedgerForMonth = (s: GameState, monthIndex: number) => s.ledger.filter((l) => l.monthIndex === monthIndex);

export const selectUnreadNotifications = (s: GameState) => s.notifications.filter((n) => !n.read);

/** Pending Type B opportunities (player decisions), excluding engine shock acknowledgements. */
export const selectPendingOpportunities = (s: GameState) => s.activeEvents.filter((e) => e.type === 'B');

/** Educational complexity: grows with months played and number of policy changes made. */
export function selectComplexityLevel(s: GameState): 1 | 2 | 3 {
  const changes = s.policyLog.length;
  if (s.monthIndex >= 18 || changes >= 6) return 3;
  if (s.monthIndex >= 6 || changes >= 2) return 2;
  return 1;
}

/** PII-free summary for the AI director. */
export function summarizeForAi(s: GameState, narrativeFocus: string[], archetype?: StateSummary['archetype']): StateSummary {
  return {
    monthIndex: s.monthIndex,
    monthLabel: selectMonthLabel(s),
    archetype,
    netWorth: netWorthOf(s),
    cash: s.cash,
    savings: s.savings,
    investmentsTotal: investmentsTotal(s.investments),
    debtTotal: debtTotal(s),
    grossAnnualSalary: s.employment.grossAnnualSalary,
    employmentStatus: s.employment.status,
    housingKind: s.household.housingKind,
    housingMonthly: s.household.housingMonthly,
    essentialsMonthly: s.household.essentialsMonthly,
    discretionaryMonthly: s.household.discretionaryMonthly,
    insurance: { ...s.insurance },
    policy: {
      savingsContributionPerMonth: s.policy.savingsContributionPerMonth,
      investmentContributionPerMonth: s.policy.investmentContributionPerMonth,
      targetAllocation: { ...s.policy.targetAllocation },
      extraDebtPaymentPerMonth: s.policy.extraDebtPaymentPerMonth,
    },
    recentShocks: s.realizedShocks.filter((r) => r.monthIndex >= s.monthIndex - 3).map((r) => r.shock.kind),
    monthsOfEssentialsCovered: selectMonthsOfEssentialsCovered(s),
    narrativeFocus,
    complexityLevel: selectComplexityLevel(s),
  };
}

/**
 * Whether the store should ask the AI director for a Type B opportunity after
 * `next` was produced from `prev`. Triggers: every 3 months, a shock, job loss /
 * re-employment, net worth crossing a $5k band, or paying off a debt. Never while
 * a Type B event is already pending.
 */
export function shouldRequestOpportunity(prev: GameState, next: GameState): boolean {
  if (next.status === 'finished') return false;
  if (selectPendingOpportunities(next).length > 0) return false;
  if (next.monthIndex === prev.monthIndex) return false;
  if (next.monthIndex > 0 && next.monthIndex % 3 === 0) return true;
  if (next.realizedShocks.length > prev.realizedShocks.length) return true;
  if (next.employment.status !== prev.employment.status) return true;
  if (next.debts.length < prev.debts.length) return true;
  const band = 5000;
  return Math.floor(netWorthOf(prev) / band) !== Math.floor(netWorthOf(next) / band);
}
