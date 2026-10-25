/**
 * Turns a validated ScenarioProposal into a GameConfig using existing archetype
 * mechanics. Owner: Agent 1.
 */
import type { GameConfig, OpportunityProposal, GameEvent, GameState, ScenarioProposal } from '@/types/domain';
import { archetypeConfig } from '@/config/archetypes';
import { BOUNDS, DEFAULT_DURATION_MONTHS } from '@/config/defaults';
import { validateConfig, validateEffect } from '@/engine/validation';
import { bandFromMonthlyCost, hasCar, normalizeCar } from '@/engine/car';
import { round2 } from '@/engine/accounting';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function scenarioToConfig(p: ScenarioProposal, seed: number, source: 'ai' | 'fallback'): GameConfig {
  const cfg = archetypeConfig(p.baseArchetype, seed, { durationMonths: clamp(p.overrides.durationMonths ?? DEFAULT_DURATION_MONTHS, BOUNDS.durationMonthsMin, BOUNDS.durationMonthsMax) });
  const st = cfg.initialState;
  const o = p.overrides;
  if (o.grossAnnualSalary !== undefined) {
    const sal = round2(clamp(o.grossAnnualSalary, 0, BOUNDS.salaryMax));
    st.employment = { ...st.employment, grossAnnualSalary: sal, priorGrossAnnualSalary: sal, status: sal > 0 ? 'employed' : 'unemployed' };
  }
  if (o.housingMonthly !== undefined) st.household.housingMonthly = round2(clamp(o.housingMonthly, 0, BOUNDS.housingMax));
  if (o.housingKind !== undefined) st.household.housingKind = o.housingKind;
  if (o.essentialsMonthly !== undefined) st.household.essentialsMonthly = round2(clamp(o.essentialsMonthly, 0, BOUNDS.monthlySpendMax));
  if (o.discretionaryMonthly !== undefined) st.household.discretionaryMonthly = round2(clamp(o.discretionaryMonthly, 0, BOUNDS.monthlySpendMax));
  if (o.cash !== undefined) st.cash = round2(clamp(o.cash, 0, BOUNDS.cashMax));
  if (o.savings !== undefined) st.savings = round2(clamp(o.savings, 0, BOUNDS.cashMax));
  if (o.dependents !== undefined) st.household.dependents = clamp(Math.round(o.dependents), 0, 8);
  if (o.debts !== undefined) {
    st.debts = o.debts.slice(0, 6).map((d, i) => ({
      id: `debt_${i + 1}`,
      name: d.name.slice(0, 60),
      kind: d.kind,
      balance: round2(clamp(d.balance, 0, BOUNDS.debtMax)),
      apr: clamp(d.apr, 0, BOUNDS.aprMax),
      minimumPayment: round2(clamp(d.minimumPayment, 0, BOUNDS.debtMax)),
    })).filter((d) => d.balance > 0);
  }
  // Car: an explicit statement wins; otherwise the archetype default, forced on by any auto loan in the debts.
  if (o.car !== undefined) {
    if (!o.car.owned) st.car = { owned: false, valueBand: 'none' };
    else {
      const current = normalizeCar(st.car, st.debts);
      const band = o.car.valueBand ?? (o.car.monthlyCost !== undefined ? bandFromMonthlyCost(clamp(o.car.monthlyCost, 0, BOUNDS.monthlySpendMax)) : current.owned ? current.valueBand : 'cheap');
      st.car = { owned: true, valueBand: band === 'none' ? 'cheap' : band };
    }
  }
  st.car = normalizeCar(st.car, st.debts);
  if (!st.car.owned) { st.insurance = { ...st.insurance, auto: null }; st.policy = { ...st.policy, insurancePlanIds: { ...st.policy.insurancePlanIds, auto: null } }; }
  // Keep policy contributions plausible relative to income: cap at 40% of gross monthly.
  const grossMonthly = st.employment.grossAnnualSalary / 12;
  const capContrib = Math.max(0, Math.round(grossMonthly * 0.4));
  st.policy.savingsContributionPerMonth = Math.min(st.policy.savingsContributionPerMonth, capContrib);
  st.policy.investmentContributionPerMonth = Math.min(st.policy.investmentContributionPerMonth, Math.max(0, capContrib - st.policy.savingsContributionPerMonth));

  const config: GameConfig = {
    ...cfg,
    scenarioId: `personalized:${p.baseArchetype}:${source}`,
    title: p.title.slice(0, 80),
    description: p.description.slice(0, 400),
    mode: 'personalized',
    narrativeFocus: p.narrativeFocus.slice(0, 6),
    defaultsApplied: p.defaultsApplied,
  };
  const v = validateConfig(config);
  if (!v.ok) throw new Error(`Scenario mapping produced an invalid config: ${v.message}`);
  return config;
}

/** Convert an AI/fallback opportunity into a GameEvent the engine will validate on enqueue. */
export function proposalToEvent(p: OpportunityProposal, state: GameState, source: 'ai' | 'fallback'): GameEvent | null {
  const options = p.options.slice(0, 3).map((o, i) => ({ id: `opt_${i}`, label: o.label.slice(0, 60), description: o.description.slice(0, 200), effect: o.effect }));
  if (options.length === 0 || options.some((o) => !validateEffect(state.assumptions, o.effect).ok)) return null;
  // Auto cover is only for lives with a car; an offer to insure a car that does not exist is dropped whole.
  if (!hasCar(state) && options.some((o) => o.effect.template === 'change_insurance' && o.effect.line === 'auto' && o.effect.planId !== null)) return null;
  if (!options.some((o) => o.effect.template === 'none')) options.push({ id: `opt_${options.length}`, label: 'Not now', description: 'Decline this opportunity.', effect: { template: 'none' } });
  return {
    id: `EVB_${source}_${state.seed.toString(36)}_${state.monthIndex}`,
    type: 'B',
    title: p.title.slice(0, 80),
    body: p.body.slice(0, 600),
    buildingTarget: p.buildingTarget,
    options,
    createdAtMonth: state.monthIndex,
    expiresAtMonth: state.monthIndex + Math.min(6, Math.max(1, Math.round(p.expiresInMonths))),
    source,
    learningNote: p.learningNote.slice(0, 300),
  };
}
