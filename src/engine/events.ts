/**
 * Type A shocks (engine-owned randomness) and whitelisted effect application.
 * Insurance changes payout, never incidence. Owner: Agent 1.
 */
import type { EventEffect, GameEvent, GameState, InsurancePlan, LifeEventAssumptions, RealizedLifeEvent, RealizedShock, ShockAssumption, ShockKind, ScriptedEvent } from '@/types/domain';
import { DEFAULT_LIFE_EVENTS } from '@/config/defaults';
import { hashSeed, type Rng } from './rng';
import { coverShortfall, makeId, post, round2 } from './accounting';
import { validateEffect } from './validation';
import { carBand, hasCar, shockMedianFor } from './car';
import { GENERIC_TEMPLATE, LIFE_TEMPLATE_BY_ID, chooseTemplate, eligibilityContext, type LifeEventTemplate } from './lifeEvents';

/**
 * Shock variants: one tag per incident family. A run uses each variant of a kind once before any
 * repeats, and never the same one twice in a row; the pick is a hash of (seed, month, kind) so the
 * shocks RNG stream is untouched and insurance still cannot change which shocks occur.
 */
export const SHOCK_VARIANTS: Record<Exclude<ShockKind, 'life'>, readonly string[]> = {
  medical: ['wrist', 'er_night', 'stitches', 'dental', 'flu'],
  auto: ['windshield', 'rear_ended', 'transmission', 'brakes', 'flat_tyre'],
  home: ['water_heater', 'break_in', 'burst_pipe', 'fridge', 'window'],
  job_loss: ['shift_cut', 'department_closed', 'contract_ended'],
};

export function chooseShockVariant(s: Pick<GameState, 'seed' | 'monthIndex' | 'realizedShocks'>, kind: Exclude<ShockKind, 'life'>): string {
  const all = SHOCK_VARIANTS[kind];
  const used = s.realizedShocks.filter((r) => r.shock.kind === kind && r.shock.variant).map((r) => r.shock.variant!);
  const last = used[used.length - 1];
  const fresh = all.filter((v) => !used.includes(v));
  const pool = fresh.length > 0 ? fresh : all.filter((v) => v !== last);
  return pool[hashSeed(s.seed, s.monthIndex, kind, 'variant') % pool.length]!;
}

/** Car rule lives in ./car.ts: `state.car.owned`, forced on by an outstanding auto loan. */
export { hasCar };

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
    const median = shockMedianFor(a.coveredBy, a.costMedian, carBand(s)); // a nicer car costs more to fix
    const grossCost = round2(Math.min(a.costMax, Math.max(a.costMin, median * Math.exp(a.costSigma * z))));
    events.push(realizeShock(s, a, grossCost, chooseShockVariant(s, a.kind), lean, events.length));
  }
  return events;
}

/** Book one shock of `grossCost`: claim settlement with the active plan, cash shortfall cover, realized record, event. */
export function realizeShock(s: GameState, a: ShockAssumption, grossCost: number, variant: string, lean: boolean, n: number): GameEvent {
  const plan = activePlan(s, a.coveredBy);
  const { insurerPaid, outOfPocket } = settleClaim(grossCost, plan);
  post(s, 'cash', 'shock_cost', -grossCost, `${a.label}: total cost`, lean);
  if (insurerPaid > 0) post(s, 'cash', 'insurance_claim', insurerPaid, `${plan?.name ?? 'Insurance'} paid claim`, lean);
  const fundedFrom = coverShortfall(s, a.label.toLowerCase(), lean);
  const shock: RealizedShock = { kind: a.kind, variant, grossCost, insurerPaid, outOfPocket, planId: plan?.id ?? null, fundedFrom };
  s.realizedShocks.push({ monthIndex: s.monthIndex, shock });
  return {
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
  };
}

/** The script's events for this month (empty when the run has no script). */
export function scriptedThisMonth(s: Pick<GameState, 'script' | 'monthIndex'>): ScriptedEvent[] {
  return (s.script?.events ?? []).filter((e) => e.monthIndex === s.monthIndex);
}

/** A scripted shock: same bookkeeping as a rolled one, with the given gross cost (the plan still decides who pays). */
export function applyScriptedShock(s: GameState, e: Extract<ScriptedEvent, { kind: 'shock' }>, lean: boolean, n: number): GameEvent | null {
  const a = s.assumptions.shocks.find((x) => x.kind === e.shockKind);
  if (!a) return null;
  if (a.coveredBy === 'auto' && !hasCar(s)) return null;
  const grossCost = round2(Math.max(0, e.grossCost));
  const variant = e.variant ?? chooseShockVariant(s, a.kind);
  return realizeShock(s, a, grossCost, variant, lean, n);
}

/** A scripted life event: posted like a rolled one, labelled by the script (`templateId` = `scripted:<label>`). */
export function applyScriptedLife(s: GameState, e: Extract<ScriptedEvent, { kind: 'life' }>, lean: boolean): RealizedLifeEvent {
  const amountSigned = round2(e.amountSigned);
  post(s, 'cash', 'life_event', amountSigned, amountSigned > 0 ? `Life event: ${e.label}` : `Life event: ${e.label}`, lean);
  if (amountSigned < 0) coverShortfall(s, e.label, lean);
  if (!s.lifeEvents) s.lifeEvents = [];
  const ev: RealizedLifeEvent = { monthIndex: s.monthIndex, amountSigned, eventId: makeId('EVL', s, s.lifeEvents.length), templateId: `scripted:${e.label}` };
  s.lifeEvents.push(ev);
  return ev;
}

export function lifeEventAssumptions(s: Pick<GameState, 'assumptions'>): LifeEventAssumptions {
  return s.assumptions.lifeEvents ?? DEFAULT_LIFE_EVENTS;
}

/** Signed running total of realized life events (gifts − costs). */
export function lifeEventNet(s: Pick<GameState, 'lifeEvents'>): number {
  return round2((s.lifeEvents ?? []).reduce((acc, e) => acc + e.amountSigned, 0));
}

/**
 * Life event roll on the dedicated `life` stream: a small unavoidable cost or a small gift, shaped
 * by a template (lifeEvents.ts) that fits the household and its cadence rules. Four draws are
 * consumed every month (incidence, amount, sign, template pick) so streams stay aligned.
 * The sign is paired with the running net: whenever a draw would push |gifts − costs| past
 * `netCap` the sign flips, and if both signs would, the amount is trimmed so the net lands
 * exactly on the cap. An annual template whose month it is (birthday, holidays, tax season,
 * back to school) takes precedence over the sign draw. Expected net ≈ $0; any single run stays
 * within ±netCap. Not insured; a cost that overdraws cash uses the normal shortfall order.
 * Returns the realized event (with `templateId`) or null.
 */
export function rollLifeEvent(s: GameState, rng: Rng, lean: boolean): RealizedLifeEvent | null {
  const a = lifeEventAssumptions(s);
  const u = rng.next();
  const v = rng.next();
  const w = rng.next();
  const p = rng.next();
  if (u >= a.monthlyIncidence) return null;
  const ctx = eligibilityContext(s, hasCar(s));
  const net = lifeEventNet(s);
  const amountFor = (t: LifeEventTemplate): number => {
    const lo = Math.max(a.amountMin, Math.min(a.amountMax, t.amountMin));
    const hi = Math.max(lo, Math.min(a.amountMax, t.amountMax));
    return Math.round(lo + v * (hi - lo));
  };
  const fits = (sign: 1 | -1, amount: number) => Math.abs(net + sign * amount) <= a.netCap;
  let sign: 1 | -1 = w < 0.5 ? -1 : 1;
  // An annual event in its month wins the sign draw (a birthday should not lose to a parking ticket).
  const annualFirst = ([1, -1] as const).find((sg) => chooseTemplate(ctx, sg, p)?.cadence.kind === 'annual');
  if (annualFirst !== undefined) sign = annualFirst;
  let template = chooseTemplate(ctx, sign, p);
  let amount = template ? amountFor(template) : 0;
  if (!template || !fits(sign, amount)) {
    sign = -sign as 1 | -1;
    template = chooseTemplate(ctx, sign, p);
    amount = template ? amountFor(template) : 0;
  }
  if (!template || !fits(sign, amount)) {
    sign = net >= 0 ? -1 : 1;
    amount = Math.max(1, Math.round(a.netCap + Math.abs(net)));
    template = chooseTemplate(ctx, sign, p) ?? LIFE_TEMPLATE_BY_ID.get(GENERIC_TEMPLATE[sign])!;
  }
  const amountSigned = round2(sign * amount);
  post(s, 'cash', 'life_event', amountSigned, amountSigned > 0 ? 'Life event: small gift' : 'Life event: small cost', lean);
  if (amountSigned < 0) coverShortfall(s, 'a small unplanned cost', lean);
  if (!s.lifeEvents) s.lifeEvents = [];
  const ev: RealizedLifeEvent = { monthIndex: s.monthIndex, amountSigned, eventId: makeId('EVL', s, s.lifeEvents.length), templateId: template.id };
  s.lifeEvents.push(ev);
  return ev;
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
      if (effect.line === 'auto' && effect.planId !== null && !hasCar(s)) return 'No car on file; add one at Your Home before choosing auto cover';
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
