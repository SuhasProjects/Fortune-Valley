/**
 * Type A shocks (engine-owned randomness) and whitelisted effect application.
 * Insurance changes payout, never incidence. Owner: Agent 1.
 */
import type { EventEffect, GameEvent, GameState, InsurancePlan, RealizedShock, ShockAssumption } from '@/types/domain';
import type { Rng } from './rng';
import { coverShortfall, makeId, post, round2 } from './accounting';
import { validateEffect } from './validation';

/**
 * A life has a car when it carries (or has paid off) an auto loan. Car-less lives
 * skip auto shocks and the Health House hides auto cover. Debts stay in the list
 * after payoff, so a car never vanishes mid-game.
 */
export function hasCar(s: Pick<GameState, 'debts'>): boolean {
  return s.debts.some((d) => d.kind === 'auto_loan');
}

export function activePlan(s: GameState, line: InsurancePlan['line']): InsurancePlan | null {
  const id = s.insurance[line];
  if (!id) return null;
  return s.assumptions.insurancePlans.find((p) => p.id === id) ?? null;
}

/**
 * Deterministic claim math: insured pays deductible, then coinsurance share, capped
 * by outOfPocketMax; insurer payout capped by coverageCap. Returns {insurerPaid, outOfPocket}.
 */
export function settleClaim(grossCost: number, plan: InsurancePlan | null): { insurerPaid: number; outOfPocket: number } {
  if (!plan) return { insurerPaid: 0, outOfPocket: round2(grossCost) };
  const afterDeductible = Math.max(0, grossCost - plan.deductible);
  let outOfPocket = Math.min(grossCost, plan.deductible) + afterDeductible * plan.coinsurance;
  if (plan.outOfPocketMax !== null) outOfPocket = Math.min(outOfPocket, plan.outOfPocketMax);
  let insurerPaid = grossCost - outOfPocket;
  if (plan.coverageCap !== null && insurerPaid > plan.coverageCap) {
    insurerPaid = plan.coverageCap;
    outOfPocket = grossCost - insurerPaid;
  }
  return { insurerPaid: round2(Math.max(0, insurerPaid)), outOfPocket: round2(Math.max(0, outOfPocket)) };
}

/** Lognormal severity draw bounded to [costMin, costMax]. */
export function drawShockCost(a: ShockAssumption, rng: Rng): number {
  const z = rng.normal();
  const cost = a.costMedian * Math.exp(a.costSigma * z);
  return round2(Math.min(a.costMax, Math.max(a.costMin, cost)));
}

/**
 * Roll each shock kind for this month using the shocks stream. Incidence draws
 * happen for every kind in fixed order regardless of insurance, so changing a
 * plan never changes which shocks occur (tested).
 */
export function rollShocks(s: GameState, rng: Rng, lean: boolean): GameEvent[] {
  const events: GameEvent[] = [];
  for (const a of s.assumptions.shocks) {
    const u = rng.next();
    const z = rng.normal(); // always consume severity draw to keep streams aligned
    if (u >= a.monthlyIncidence) continue;
    if (a.coveredBy === 'auto' && !hasCar(s)) continue; // no car, no car accident (draws already consumed, streams stay aligned)
    const grossCost = round2(Math.min(a.costMax, Math.max(a.costMin, a.costMedian * Math.exp(a.costSigma * z))));
    const plan = activePlan(s, a.coveredBy);
    const { insurerPaid, outOfPocket } = settleClaim(grossCost, plan);
    post(s, 'cash', 'shock_cost', -grossCost, `${a.label}: total cost`, lean);
    if (insurerPaid > 0) post(s, 'cash', 'insurance_claim', insurerPaid, `${plan?.name ?? 'Insurance'} paid claim`, lean);
    const fundedFrom = coverShortfall(s, a.label.toLowerCase(), lean);
    const shock: RealizedShock = { kind: a.kind, grossCost, insurerPaid, outOfPocket, planId: plan?.id ?? null, fundedFrom };
    s.realizedShocks.push({ monthIndex: s.monthIndex, shock });
    const n = events.length;
    events.push({
      id: makeId('EVA', s, n),
      type: 'A',
      title: a.label,
      body: plan
        ? `A ${a.label.toLowerCase()} cost $${grossCost.toLocaleString()}; your ${plan.name} paid $${insurerPaid.toLocaleString()} and you paid $${outOfPocket.toLocaleString()} after the deductible and coinsurance.`
        : `A ${a.label.toLowerCase()} cost $${grossCost.toLocaleString()}, and with no ${a.coveredBy} coverage you paid the full amount.`,
      buildingTarget: a.coveredBy === 'health' ? 'hospital' : a.coveredBy === 'auto' ? 'hospital' : 'home',
      options: [{ id: 'ack', label: 'Got it', description: 'Acknowledge', effect: { template: 'none' } }],
      createdAtMonth: s.monthIndex,
      expiresAtMonth: s.monthIndex + 2,
      source: 'engine',
      shock,
    });
  }
  return events;
}

/** Job-loss roll on the employment stream. Returns true if a job loss started this month. */
export function rollEmployment(s: GameState, rng: Rng): boolean {
  const e = s.assumptions.employment;
  const u = rng.next();
  const durU = rng.next();
  if (s.employment.status !== 'employed') return false;
  if (u >= e.jobLossMonthlyIncidence) return false;
  const span = e.unemploymentDurationMonthsMax - e.unemploymentDurationMonthsMin;
  const months = e.unemploymentDurationMonthsMin + Math.floor(durU * (span + 1));
  s.employment = {
    ...s.employment,
    status: 'unemployed',
    priorGrossAnnualSalary: s.employment.grossAnnualSalary,
    monthsUnemployedRemaining: months,
  };
  return true;
}

/**
 * Apply a whitelisted effect. Validation happens here again (defense in depth).
 * Returns an error message or null. Mutates the cloned state.
 */
export function applyEffect(s: GameState, effect: EventEffect, lean = false): string | null {
  const v = validateEffect(s.assumptions, effect);
  if (!v.ok) return v.message;
  switch (effect.template) {
    case 'none':
      return null;
    case 'offer_job':
      s.employment = { status: 'employed', title: effect.title, grossAnnualSalary: effect.grossAnnualSalary, monthsUnemployedRemaining: 0, priorGrossAnnualSalary: effect.grossAnnualSalary };
      return null;
    case 'change_housing':
      s.household = { ...s.household, housingMonthly: effect.housingMonthly, housingKind: effect.housingKind };
      return null;
    case 'change_insurance':
      s.insurance = { ...s.insurance, [effect.line]: effect.planId };
      s.policy = { ...s.policy, insurancePlanIds: { ...s.policy.insurancePlanIds, [effect.line]: effect.planId } };
      return null;
    case 'budget_choice':
      s.household = { ...s.household, discretionaryMonthly: effect.discretionaryMonthly };
      return null;
    case 'contribution_choice':
      s.policy = { ...s.policy, savingsContributionPerMonth: effect.savingsContributionPerMonth, investmentContributionPerMonth: effect.investmentContributionPerMonth };
      return null;
    case 'loan_choice': {
      const r = effect.apr / 12;
      const payment = r === 0 ? effect.principal / effect.termMonths : (effect.principal * r) / (1 - Math.pow(1 + r, -effect.termMonths));
      const id = `loan_${s.debts.length + 1}_${s.monthIndex}`;
      s.debts.push({ id, name: effect.name, kind: 'personal_loan', balance: 0, apr: effect.apr, minimumPayment: round2(payment) });
      post(s, `debt:${id}`, 'loan_proceeds', effect.principal, `Took loan: ${effect.name}`, lean);
      post(s, 'cash', 'loan_proceeds', effect.principal, `Loan proceeds: ${effect.name}`, lean);
      return null;
    }
  }
}

export function describeEffect(e: EventEffect): string {
  switch (e.template) {
    case 'none': return 'No change';
    case 'offer_job': return `Took job "${e.title}" at $${e.grossAnnualSalary.toLocaleString()}/yr`;
    case 'change_housing': return `Moved to ${e.housingKind} housing at $${e.housingMonthly.toLocaleString()}/mo`;
    case 'change_insurance': return `${e.line} insurance → ${e.planId ?? 'none'}`;
    case 'budget_choice': return `Discretionary budget → $${e.discretionaryMonthly.toLocaleString()}/mo`;
    case 'contribution_choice': return `Contributions → save $${e.savingsContributionPerMonth}/mo, invest $${e.investmentContributionPerMonth}/mo`;
    case 'loan_choice': return `Borrowed $${e.principal.toLocaleString()} (${e.name}) at ${(e.apr * 100).toFixed(1)}% APR over ${e.termMonths} months`;
  }
}
