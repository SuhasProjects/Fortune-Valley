/**
 * Validation for actions, effects and configs. Owner: Agent 1.
 * Pure functions returning { ok, message }.
 */
import type { Allocation, Assumptions, EventEffect, GameConfig, HousingKind, InsuranceLine } from '@/types/domain';
import { ASSET_CLASSES, INSURANCE_LINES } from '@/types/domain';
import { BOUNDS } from '@/config/defaults';

export interface Validation { ok: boolean; message: string }
const ok: Validation = { ok: true, message: '' };
const fail = (message: string): Validation => ({ ok: false, message });

export const isFiniteNonNeg = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

export function validateAllocation(a: Allocation | undefined): Validation {
  if (!a) return fail('Allocation missing');
  let sum = 0;
  for (const c of ASSET_CLASSES) {
    const w = a[c];
    if (typeof w !== 'number' || !Number.isFinite(w)) return fail(`Allocation weight for ${c} must be a number`);
    if (w < 0 || w > 1) return fail(`Allocation weight for ${c} must be between 0 and 1`);
    sum += w;
  }
  if (Math.abs(sum - 1) > BOUNDS.allocationTolerance) return fail(`Allocation weights must sum to 1 (got ${sum.toFixed(3)})`);
  return ok;
}

export const HOUSING_KINDS: HousingKind[] = ['rent', 'dorm', 'family', 'own'];

export function validatePlanId(assumptions: Assumptions, line: InsuranceLine, planId: string | null): Validation {
  if (!INSURANCE_LINES.includes(line)) return fail(`Unknown insurance line ${String(line)}`);
  if (planId === null) return ok;
  const plan = assumptions.insurancePlans.find((p) => p.id === planId);
  if (!plan) return fail(`Unknown insurance plan ${planId}`);
  if (plan.line !== line) return fail(`Plan ${planId} is not a ${line} plan`);
  return ok;
}

/** Bounds check for whitelisted event effects (AI or engine authored). */
export function validateEffect(assumptions: Assumptions, e: EventEffect | undefined): Validation {
  if (!e || typeof e !== 'object' || typeof (e as { template?: unknown }).template !== 'string') return fail('Effect missing template');
  switch (e.template) {
    case 'none':
      return ok;
    case 'offer_job':
      if (!isFiniteNonNeg(e.grossAnnualSalary) || e.grossAnnualSalary > BOUNDS.salaryMax) return fail('offer_job: salary out of bounds');
      if (typeof e.title !== 'string' || e.title.length === 0 || e.title.length > 60) return fail('offer_job: bad title');
      return ok;
    case 'change_housing':
      if (!isFiniteNonNeg(e.housingMonthly) || e.housingMonthly > BOUNDS.housingMax) return fail('change_housing: housing cost out of bounds');
      if (!HOUSING_KINDS.includes(e.housingKind)) return fail('change_housing: bad housing kind');
      return ok;
    case 'change_insurance':
      return validatePlanId(assumptions, e.line, e.planId);
    case 'budget_choice':
      if (!isFiniteNonNeg(e.discretionaryMonthly) || e.discretionaryMonthly > BOUNDS.monthlySpendMax) return fail('budget_choice: amount out of bounds');
      return ok;
    case 'loan_choice':
      if (!isFiniteNonNeg(e.principal) || e.principal <= 0 || e.principal > BOUNDS.loanPrincipalMax) return fail('loan_choice: principal out of bounds');
      if (!isFiniteNonNeg(e.apr) || e.apr > BOUNDS.aprMax) return fail('loan_choice: APR out of bounds');
      if (!Number.isInteger(e.termMonths) || e.termMonths < BOUNDS.loanTermMonthsMin || e.termMonths > BOUNDS.loanTermMonthsMax) return fail('loan_choice: term out of bounds');
      if (typeof e.name !== 'string' || e.name.length === 0 || e.name.length > 60) return fail('loan_choice: bad name');
      return ok;
    case 'contribution_choice':
      if (!isFiniteNonNeg(e.savingsContributionPerMonth) || e.savingsContributionPerMonth > BOUNDS.contributionMax) return fail('contribution_choice: savings out of bounds');
      if (!isFiniteNonNeg(e.investmentContributionPerMonth) || e.investmentContributionPerMonth > BOUNDS.contributionMax) return fail('contribution_choice: investment out of bounds');
      return ok;
    default:
      return fail(`Unknown effect template ${(e as { template: string }).template}`);
  }
}

export function validateConfig(c: GameConfig): Validation {
  if (!c.scenarioId) return fail('scenarioId required');
  if (!Number.isInteger(c.durationMonths) || c.durationMonths < BOUNDS.durationMonthsMin || c.durationMonths > BOUNDS.durationMonthsMax) return fail('durationMonths out of bounds');
  if (!Number.isFinite(c.seed)) return fail('seed must be a number');
  if (!/^\d{4}-\d{2}$/.test(c.startMonth)) return fail('startMonth must be YYYY-MM');
  const s = c.initialState;
  if (!isFiniteNonNeg(s.cash) || s.cash > BOUNDS.cashMax) return fail('initial cash out of bounds');
  if (!isFiniteNonNeg(s.savings) || s.savings > BOUNDS.cashMax) return fail('initial savings out of bounds');
  for (const k of ASSET_CLASSES) if (!isFiniteNonNeg(s.investments[k]) || s.investments[k] > BOUNDS.cashMax) return fail(`initial ${k} out of bounds`);
  if (!isFiniteNonNeg(s.employment.grossAnnualSalary) || s.employment.grossAnnualSalary > BOUNDS.salaryMax) return fail('salary out of bounds');
  if (!isFiniteNonNeg(s.household.housingMonthly) || s.household.housingMonthly > BOUNDS.housingMax) return fail('housing out of bounds');
  if (!isFiniteNonNeg(s.household.essentialsMonthly) || s.household.essentialsMonthly > BOUNDS.monthlySpendMax) return fail('essentials out of bounds');
  if (!isFiniteNonNeg(s.household.discretionaryMonthly) || s.household.discretionaryMonthly > BOUNDS.monthlySpendMax) return fail('discretionary out of bounds');
  const ids = new Set<string>();
  for (const d of s.debts) {
    if (ids.has(d.id)) return fail(`duplicate debt id ${d.id}`);
    ids.add(d.id);
    if (!isFiniteNonNeg(d.balance) || d.balance > BOUNDS.debtMax) return fail(`debt ${d.id} balance out of bounds`);
    if (!isFiniteNonNeg(d.apr) || d.apr > BOUNDS.aprMax) return fail(`debt ${d.id} APR out of bounds`);
    if (!isFiniteNonNeg(d.minimumPayment)) return fail(`debt ${d.id} minimum payment invalid`);
  }
  const alloc = validateAllocation(s.policy.targetAllocation);
  if (!alloc.ok) return alloc;
  for (const line of INSURANCE_LINES) {
    const v = validatePlanId(c.assumptions, line, s.policy.insurancePlanIds[line]);
    if (!v.ok) return v;
    const v2 = validatePlanId(c.assumptions, line, s.insurance[line]);
    if (!v2.ok) return v2;
  }
  if (!isFiniteNonNeg(s.policy.savingsContributionPerMonth) || !isFiniteNonNeg(s.policy.investmentContributionPerMonth) || !isFiniteNonNeg(s.policy.extraDebtPaymentPerMonth) || !isFiniteNonNeg(s.policy.minCashBuffer)) return fail('policy amounts must be non-negative');
  return ok;
}
