/**
 * Validation for actions, effects and configs. Owner: Agent 1.
 * Pure functions returning { ok, message }.
 */
import type { Allocation, Assumptions, EventEffect, GameEvent, GameConfig, HousingKind, InsuranceLine } from '@/types/domain';
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
      // Matches the gateway schema (api/_lib/schemas.ts): at least $1.
      if (!isFiniteNonNeg(e.principal) || e.principal < 1 || e.principal > BOUNDS.loanPrincipalMax) return fail('loan_choice: principal out of bounds');
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

function validateConfigFields(c: GameConfig): Validation {
  if (!c.scenarioId) return fail('scenarioId required');
  if (!Number.isInteger(c.durationMonths) || c.durationMonths < BOUNDS.durationMonthsMin || c.durationMonths > BOUNDS.durationMonthsMax) return fail('durationMonths out of bounds');
  if (!Number.isSafeInteger(c.seed)) return fail('seed must be a safe integer');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(c.startMonth)) return fail('startMonth must be YYYY-MM');
  const assumptions = validateAssumptions(c.assumptions);
  if (!assumptions.ok) return assumptions;
  const s = c.initialState;
  if (!['employed', 'unemployed', 'student'].includes(s.employment.status)) return fail('Invalid employment status');
  if (!isFiniteNonNeg(s.employment.priorGrossAnnualSalary) || s.employment.priorGrossAnnualSalary > BOUNDS.salaryMax || !Number.isInteger(s.employment.monthsUnemployedRemaining) || s.employment.monthsUnemployedRemaining < 0) return fail('Invalid employment history');
  if (!HOUSING_KINDS.includes(s.household.housingKind) || !Number.isInteger(s.household.dependents) || s.household.dependents < 0 || s.household.dependents > 8) return fail('Invalid household');
  if (!['single', 'married_joint'].includes(s.taxProfile.filingStatus)) return fail('Invalid tax filing assumption');
  if (!Array.isArray(s.policy.emergencyFundingOrder) || s.policy.emergencyFundingOrder.some(source => !['savings', 'investments', 'borrow'].includes(source)) || new Set(s.policy.emergencyFundingOrder).size !== s.policy.emergencyFundingOrder.length) return fail('Invalid emergency funding order');
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
    if (s.insurance[line] !== s.policy.insurancePlanIds[line]) return fail(`Active ${line} plan must match policy`);
    const v2 = validatePlanId(c.assumptions, line, s.insurance[line]);
    if (!v2.ok) return v2;
  }
  if (!isFiniteNonNeg(s.policy.savingsContributionPerMonth) || !isFiniteNonNeg(s.policy.investmentContributionPerMonth) || !isFiniteNonNeg(s.policy.extraDebtPaymentPerMonth) || !isFiniteNonNeg(s.policy.minCashBuffer)) return fail('policy amounts must be non-negative');
  return ok;
}

/** Validates externally loaded demo assumptions before any accounting or random draws. */
export function validateAssumptions(a: Assumptions): Validation {
  const bounded = (n: unknown, max: number) => isFiniteNonNeg(n) && n <= max;
  const probability = (n: unknown) => bounded(n, 1);
  if (a.version !== 1) return fail('Unsupported assumptions version');
  for (const key of ASSET_CLASSES) {
    const asset = a.assets[key];
    if (!Number.isFinite(asset.expectedAnnualReturn) || asset.expectedAnnualReturn <= -1 || asset.expectedAnnualReturn > 1 || !bounded(asset.annualVolatility, 2)) return fail(`Invalid ${key} return assumption`);
  }
  if (![a.correlation.stockEtf, a.correlation.stockBond].every(r => Number.isFinite(r) && Math.abs(r) <= 1)) return fail('Invalid return correlation');
  if (!bounded(a.savingsApy, 1) || !bounded(a.overdraftApr, BOUNDS.aprMax) || !bounded(a.liquidityShortfallThresholdMonths, 240)) return fail('Invalid interest or liquidity assumption');
  const tax = a.tax;
  if (tax.kind !== 'illustrative_progressive' || !bounded(tax.standardDeductionAnnual, BOUNDS.salaryMax) || !probability(tax.payrollRate) || !tax.brackets.length) return fail('Invalid tax assumptions');
  let previous = 0;
  for (const [index, bracket] of tax.brackets.entries()) {
    if (!probability(bracket.rate) || bracket.rate + tax.payrollRate > 1) return fail('Invalid withholding rate');
    if (bracket.upTo === null) {
      if (index !== tax.brackets.length - 1) return fail('Unbounded bracket must be last');
    } else {
      if (!Number.isFinite(bracket.upTo) || bracket.upTo <= previous) return fail('Tax brackets must increase');
      previous = bracket.upTo;
    }
  }
  if (tax.brackets[tax.brackets.length - 1]?.upTo !== null) return fail('Tax brackets must end with an unbounded bracket');
  const ids = new Set<string>();
  for (const plan of a.insurancePlans) {
    if (!plan.id || ids.has(plan.id) || !INSURANCE_LINES.includes(plan.line)) return fail('Invalid or duplicate insurance plan');
    ids.add(plan.id);
    if (![plan.monthlyPremium, plan.deductible].every(n => bounded(n, BOUNDS.cashMax)) || !probability(plan.coinsurance) || (plan.outOfPocketMax !== null && !bounded(plan.outOfPocketMax, BOUNDS.cashMax)) || (plan.coverageCap !== null && !bounded(plan.coverageCap, BOUNDS.cashMax))) return fail('Invalid insurance costs or coverage');
  }
  const shockKinds = new Set<string>();
  for (const shock of a.shocks) {
    if (!['medical', 'auto', 'home'].includes(shock.kind) || shockKinds.has(shock.kind) || !INSURANCE_LINES.includes(shock.coveredBy)) return fail('Invalid or duplicate shock');
    shockKinds.add(shock.kind);
    if (!probability(shock.monthlyIncidence) || !bounded(shock.costSigma, 3) || ![shock.costMedian, shock.costMin, shock.costMax].every(n => bounded(n, BOUNDS.cashMax)) || shock.costMin > shock.costMax) return fail('Invalid shock probability or severity');
  }
  const le = a.lifeEvents;
  if (le !== undefined && (!probability(le.monthlyIncidence) || ![le.amountMin, le.amountMax, le.netCap].every(n => bounded(n, BOUNDS.cashMax)) || le.amountMin > le.amountMax)) return fail('Invalid life event assumptions');
  const e = a.employment;
  if (!probability(e.jobLossMonthlyIncidence) || !probability(e.unemploymentReplacementRate) || !bounded(e.unemploymentBenefitMonthlyCap, BOUNDS.monthlySpendMax) || !bounded(e.annualRaiseRate, 1) || !Number.isInteger(e.unemploymentDurationMonthsMin) || !Number.isInteger(e.unemploymentDurationMonthsMax) || e.unemploymentDurationMonthsMin < 1 || e.unemploymentDurationMonthsMax < e.unemploymentDurationMonthsMin || e.unemploymentDurationMonthsMax > 240) return fail('Invalid employment assumptions');
  return ok;
}

/** Malformed persisted JSON is a validation failure, never an uncaught property error. */
export function validateConfig(c: GameConfig): Validation {
  try { return validateConfigFields(c); }
  catch { return fail('Malformed game configuration'); }
}

/** Enqueued narrative decisions cannot impersonate engine shocks. */
export function validateNarrativeEvent(assumptions: Assumptions, event: GameEvent, month: number): Validation {
  try {
    if (event.type !== 'B' || !['ai', 'fallback'].includes(event.source) || event.shock !== undefined) return fail('Only narrative opportunities can be enqueued');
    if (!['bank', 'office', 'home', 'hospital', 'market'].includes(event.buildingTarget)) return fail('Invalid event building');
    if (typeof event.id !== 'string' || !event.id || event.id.length > 200 || typeof event.title !== 'string' || !event.title || event.title.length > 200 || typeof event.body !== 'string' || event.body.length > 2000) return fail('Invalid event metadata');
    if (!Number.isInteger(event.createdAtMonth) || event.createdAtMonth < 0 || (event.expiresAtMonth !== undefined && (!Number.isInteger(event.expiresAtMonth) || event.expiresAtMonth < month))) return fail('Invalid event dates');
    if (!Array.isArray(event.options) || event.options.length < 1 || event.options.length > 4) return fail('Event must have 1–4 options');
    const ids = new Set<string>();
    for (const option of event.options) {
      if (typeof option.id !== 'string' || !option.id || ids.has(option.id) || typeof option.label !== 'string' || !option.label || option.label.length > 300) return fail('Invalid or duplicate event option');
      ids.add(option.id);
      const effect = validateEffect(assumptions, option.effect);
      if (!effect.ok) return effect;
    }
    return ok;
  } catch { return fail('Malformed narrative event'); }
}
