/**
 * What-if preview for panels: run ONE month from the current state with
 * overrides applied, using the same seed streams (so the same shocks and
 * returns happen) and compare to the month without overrides. Pure; never
 * touches the real state or logs anything. Owner: Agent 1.
 */
import type { CarState, GameState, Household, Policy } from '@/types/domain';
import { advanceMonth } from './advanceMonth';
import { applyAction } from './actions';
import { investmentsTotal, netWorthOf, round2 } from './accounting';

export interface PreviewOverrides {
  policy?: Partial<Policy>;
  household?: Partial<Pick<Household, 'discretionaryMonthly' | 'housingMonthly'>>;
  insurance?: Partial<GameState['insurance']>;
  car?: CarState;
}

export interface MonthSnapshot { cash: number; savings: number; investments: number; debt: number; netWorth: number; shortfall: boolean }

export interface MonthPreview {
  /** Next month if nothing changes. */
  baseline: MonthSnapshot;
  /** Next month with the overrides applied. */
  withChange: MonthSnapshot;
  /** withChange − baseline, per field. */
  delta: Omit<MonthSnapshot, 'shortfall'>;
  /** Overrides the engine refused (e.g. allocation not summing to 1); preview then ignores them. */
  rejected: string[];
}

const snap = (s: GameState): MonthSnapshot => ({
  cash: s.cash,
  savings: s.savings,
  investments: investmentsTotal(s.investments),
  debt: round2(s.debts.reduce((a, d) => a + d.balance, 0)),
  netWorth: netWorthOf(s),
  shortfall: s.shortfallMonths.includes(s.monthIndex - 1),
});

export function previewMonth(state: GameState, overrides: PreviewOverrides): MonthPreview {
  const rejected: string[] = [];
  let s: GameState = structuredClone(state);
  if (s.status === 'finished' || s.status === 'paused' || s.status === 'setup') s.status = 'playing';
  const tryAction = (label: string, a: Parameters<typeof applyAction>[1]) => {
    const r = applyAction(s, a);
    if (r.ok) s = r.state; else rejected.push(`${label}: ${r.message}`);
  };
  const p = overrides.policy ?? {};
  if (p.targetAllocation) tryAction('allocation', { type: 'set_allocation', allocation: p.targetAllocation });
  if (p.savingsContributionPerMonth !== undefined || p.investmentContributionPerMonth !== undefined) {
    tryAction('contributions', { type: 'set_contributions', savingsContributionPerMonth: p.savingsContributionPerMonth ?? s.policy.savingsContributionPerMonth, investmentContributionPerMonth: p.investmentContributionPerMonth ?? s.policy.investmentContributionPerMonth });
  }
  if (p.extraDebtPaymentPerMonth !== undefined) tryAction('extra debt payment', { type: 'set_extra_debt_payment', amount: p.extraDebtPaymentPerMonth });
  if (p.minCashBuffer !== undefined) tryAction('cash buffer', { type: 'set_min_cash_buffer', amount: p.minCashBuffer });
  if (overrides.household?.discretionaryMonthly !== undefined) tryAction('budget', { type: 'set_budget', discretionaryMonthly: overrides.household.discretionaryMonthly });
  if (overrides.household?.housingMonthly !== undefined) tryAction('housing', { type: 'set_housing', housingMonthly: overrides.household.housingMonthly, housingKind: s.household.housingKind });
  if (overrides.car) tryAction('car', { type: 'set_car', owned: overrides.car.owned, valueBand: overrides.car.valueBand });
  for (const line of ['health', 'auto', 'renters'] as const) {
    const v = overrides.insurance?.[line];
    if (v !== undefined) tryAction(`${line} insurance`, { type: 'set_insurance', line, planId: v });
  }
  const base = structuredClone(state);
  if (base.status === 'finished' || base.status === 'paused' || base.status === 'setup') base.status = 'playing';
  const baseline = snap(advanceMonth(base, { lean: true, inPlace: true }));
  const withChange = snap(advanceMonth(s, { lean: true, inPlace: true }));
  return {
    baseline,
    withChange,
    delta: {
      cash: round2(withChange.cash - baseline.cash),
      savings: round2(withChange.savings - baseline.savings),
      investments: round2(withChange.investments - baseline.investments),
      debt: round2(withChange.debt - baseline.debt),
      netWorth: round2(withChange.netWorth - baseline.netWorth),
    },
    rejected,
  };
}

/**
 * Multi-month what-if (for "12-month runway" style previews). Deterministic: both
 * paths use the game's own seed streams, so they differ only by the overrides.
 * Returns one snapshot per month for each path (index 0 = after month 1).
 */
export function previewHorizon(state: GameState, overrides: PreviewOverrides, months = 12): { baseline: MonthSnapshot[]; withChange: MonthSnapshot[]; rejected: string[]; monthsUntilShortfall: { baseline: number | null; withChange: number | null } } {
  const first = previewMonth(state, overrides);
  const run = (apply: boolean): MonthSnapshot[] => {
    let s: GameState = structuredClone(state);
    if (s.status !== 'playing') s.status = 'playing';
    if (apply) {
      const p = overrides.policy ?? {};
      s.policy = { ...s.policy, ...p, targetAllocation: p.targetAllocation ?? s.policy.targetAllocation };
      if (overrides.household) s.household = { ...s.household, ...overrides.household };
      if (overrides.car) {
        s.car = { ...overrides.car };
        if (!s.car.owned) { s.insurance = { ...s.insurance, auto: null }; s.policy.insurancePlanIds = { ...s.policy.insurancePlanIds, auto: null }; }
      }
      if (overrides.insurance) {
        s.insurance = { ...s.insurance, ...overrides.insurance };
        s.policy.insurancePlanIds = { ...s.policy.insurancePlanIds, ...overrides.insurance };
      }
    }
    s.durationMonths = s.monthIndex + Math.max(1, months);
    const out: MonthSnapshot[] = [];
    for (let i = 0; i < months; i++) {
      s = advanceMonth(s, { lean: true, inPlace: true });
      out.push(snap(s));
    }
    return out;
  };
  const baseline = run(false);
  // Only apply overrides the single-month preview accepted (same validation path).
  const withChange = first.rejected.length ? baseline : run(true);
  const firstShort = (arr: MonthSnapshot[]) => { const i = arr.findIndex((m) => m.shortfall); return i === -1 ? null : i + 1; };
  return { baseline, withChange, rejected: first.rejected, monthsUntilShortfall: { baseline: firstShort(baseline), withChange: firstShort(withChange) } };
}
