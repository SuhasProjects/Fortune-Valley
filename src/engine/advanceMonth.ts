/**
 * advanceMonth: the single, published monthly accounting order. Owner: Agent 1.
 *
 *  1. Income        gross pay (or unemployment benefit) → illustrative withholding
 *  2. Bills         housing, essentials, discretionary, insurance premiums
 *  3. Debt          interest accrues to each balance FIRST, then scheduled payment
 *                   (minimum + extra on highest-APR debt), never more than the balance
 *     → funding     if cash < 0 after 1–3: savings → investments → borrow (overdraft)
 *  4. Contributions savings then investments (split by target allocation), limited to
 *                   cash above the policy's minCashBuffer — never creates money
 *  5. Returns       savings interest; lognormal monthly asset returns, correlated
 *  6. Shocks        Type A incidence/severity on the shocks stream; claims settled;
 *                   out-of-pocket funded by the same funding order; job-loss roll
 *  7. Alerts        notifications, timeline, event expiry, checkpoint, monthIndex++
 *
 * Deterministic given (seed, monthIndex). Never mutates the input unless opts.inPlace.
 */
import type { GameEvent, GameState, LedgerCategory } from '@/types/domain';
import { ASSET_CLASSES } from '@/types/domain';
import { allocateAmount, coverShortfall, makeId, monthlyRate, netWorthOf, post, round2 } from './accounting';
import { activePlan, rollEmployment, rollShocks } from './events';
import { monthRng, type Rng } from './rng';

export interface AdvanceOptions {
  /** Skip ledger/notification/timeline bookkeeping (Monte Carlo). */
  lean?: boolean;
  /** Mutate the given state instead of cloning (caller owns it). */
  inPlace?: boolean;
  /** Override RNG streams (tests). */
  rng?: { market: Rng; shocks: Rng; employment: Rng };
}

/** Illustrative annual withholding: standard deduction + progressive brackets + flat payroll. */
export function annualWithholding(s: GameState, annualGross: number): { incomeTax: number; payroll: number } {
  const t = s.assumptions.tax;
  const deduction = s.taxProfile.filingStatus === 'married_joint' ? t.standardDeductionAnnual * 2 : t.standardDeductionAnnual;
  const taxable = Math.max(0, annualGross - deduction);
  let tax = 0;
  let lower = 0;
  for (const b of t.brackets) {
    const upper = b.upTo === null ? Infinity : (s.taxProfile.filingStatus === 'married_joint' ? b.upTo * 2 : b.upTo);
    const slice = Math.max(0, Math.min(taxable, upper) - lower);
    tax += slice * b.rate;
    lower = upper;
    if (taxable <= upper) break;
  }
  return { incomeTax: round2(tax), payroll: round2(annualGross * t.payrollRate) };
}

export function advanceMonth(input: GameState, opts: AdvanceOptions = {}): GameState {
  if (input.status === 'finished' || input.status === 'paused') return input;
  const s: GameState = opts.inPlace ? input : structuredClone(input);
  const lean = opts.lean === true;
  const m = s.monthIndex;
  const rng = opts.rng ?? { market: monthRng(s.seed, m, 'market'), shocks: monthRng(s.seed, m, 'shocks'), employment: monthRng(s.seed, m, 'employment') };
  const notes: { kind: 'info' | 'positive' | 'negative' | 'decision'; summary: string; details?: string; building?: GameEvent['buildingTarget'] }[] = [];
  const timeline: { type: 'shock' | 'milestone'; description: string; eventId?: string }[] = [];
  const nwBefore = netWorthOf(s);
  if (s.status === 'setup') s.status = 'playing';

  // ── 1. Income ───────────────────────────────────────────────────────────────
  const emp = s.employment;
  if (m > 0 && m % 12 === 0 && s.assumptions.employment.annualRaiseRate > 0) {
    if (emp.status === 'employed') {
      emp.grossAnnualSalary = round2(emp.grossAnnualSalary * (1 + s.assumptions.employment.annualRaiseRate));
      emp.priorGrossAnnualSalary = emp.grossAnnualSalary;
      notes.push({ kind: 'positive', summary: `Annual raise: salary now $${emp.grossAnnualSalary.toLocaleString()}/yr`, building: 'office' });
    } else if (emp.status === 'unemployed') {
      // The role you return to keeps pace with the market; applied on re-employment.
      emp.priorGrossAnnualSalary = round2(emp.priorGrossAnnualSalary * (1 + s.assumptions.employment.annualRaiseRate));
    }
  }
  let grossPay = 0;
  let withheld = 0;
  if (emp.status === 'employed' && emp.grossAnnualSalary > 0) {
    grossPay = round2(emp.grossAnnualSalary / 12);
    const w = annualWithholding(s, emp.grossAnnualSalary);
    withheld = round2((w.incomeTax + w.payroll) / 12);
    post(s, 'cash', 'salary', grossPay, 'Gross salary', lean);
    post(s, 'cash', 'tax_withholding', -withheld, 'Illustrative tax + payroll withholding', lean);
  } else if (emp.status === 'unemployed') {
    const e = s.assumptions.employment;
    const benefit = round2(Math.min(e.unemploymentBenefitMonthlyCap, (emp.priorGrossAnnualSalary / 12) * e.unemploymentReplacementRate));
    grossPay = benefit;
    post(s, 'cash', 'unemployment_benefit', benefit, 'Unemployment benefit (illustrative)', lean);
    emp.monthsUnemployedRemaining -= 1;
    if (emp.monthsUnemployedRemaining <= 0) {
      emp.status = 'employed';
      emp.monthsUnemployedRemaining = 0;
      emp.grossAnnualSalary = emp.priorGrossAnnualSalary;
      notes.push({ kind: 'positive', summary: `Back to work as ${emp.title} at $${emp.grossAnnualSalary.toLocaleString()}/yr`, building: 'office' });
      timeline.push({ type: 'milestone', description: 'Re-employed after job loss' });
    }
  }

  // ── 2. Bills ────────────────────────────────────────────────────────────────
  const h = s.household;
  const bills: [LedgerCategory, number, string][] = [
    ['housing', h.housingMonthly, `${h.housingKind === 'own' ? 'Mortgage/housing' : 'Rent/housing'}`],
    ['essentials', h.essentialsMonthly, 'Essentials (groceries, utilities, transport)'],
    ['discretionary', h.discretionaryMonthly, 'Discretionary spending'],
  ];
  for (const [cat, amt, desc] of bills) if (amt > 0) post(s, 'cash', cat, -amt, desc, lean);
  let premiums = 0;
  for (const line of ['health', 'auto', 'renters'] as const) {
    const plan = activePlan(s, line);
    if (plan) {
      premiums += plan.monthlyPremium;
      post(s, 'cash', 'insurance_premium', -plan.monthlyPremium, `${plan.name} premium`, lean);
    }
  }

  // ── 3. Debt: interest first, then payments ──────────────────────────────────
  let debtPaid = 0;
  let extra = s.policy.extraDebtPaymentPerMonth;
  const byApr = [...s.debts].sort((a, b) => b.apr - a.apr);
  for (const d of byApr) {
    if (d.balance <= 0) continue;
    const interest = round2(d.balance * (d.apr / 12));
    if (interest > 0) post(s, `debt:${d.id}`, 'debt_interest', interest, `${d.name} interest`, lean);
    if (d.kind === 'overdraft') d.minimumPayment = round2(Math.max(25, d.balance * 0.03));
    let pay = Math.min(d.balance, d.minimumPayment + extra);
    extra = Math.max(0, extra - Math.max(0, pay - d.minimumPayment));
    pay = round2(pay);
    if (pay > 0) {
      post(s, 'cash', 'debt_payment', -pay, `${d.name} payment`, lean);
      post(s, `debt:${d.id}`, 'debt_payment', -pay, `${d.name} payment`, lean);
      debtPaid += pay;
    }
    if (d.balance <= 0.005) {
      d.balance = 0;
      notes.push({ kind: 'positive', summary: `Paid off ${d.name}!`, building: 'bank' });
      timeline.push({ type: 'milestone', description: `Paid off ${d.name}` });
    }
  }
  s.debts = s.debts.filter((d) => d.balance > 0 || d.kind !== 'overdraft');
  const fundedBills = coverShortfall(s, 'bills and debt payments', lean);
  if (fundedBills.length) notes.push({ kind: 'negative', summary: `Cash ran short for bills; covered $${round2(fundedBills.reduce((a, f) => a + f.amount, 0)).toLocaleString()} from ${fundedBills.map((f) => f.source).join(' + ')}`, building: 'bank' });

  // ── 4. Contributions (subject to cash above buffer) ─────────────────────────
  let available = Math.max(0, s.cash - s.policy.minCashBuffer);
  const saveAmt = round2(Math.min(s.policy.savingsContributionPerMonth, available));
  if (saveAmt > 0) {
    post(s, 'cash', 'savings_contribution', -saveAmt, 'Savings contribution', lean);
    post(s, 'savings', 'savings_contribution', saveAmt, 'Savings contribution', lean);
    available = round2(available - saveAmt);
  }
  const investAmt = round2(Math.min(s.policy.investmentContributionPerMonth, available));
  if (investAmt > 0) {
    post(s, 'cash', 'investment_contribution', -investAmt, 'Investment contribution', lean);
    const shares = allocateAmount(investAmt, s.policy.targetAllocation);
    for (const c of ASSET_CLASSES) {
      if (shares[c] > 0) post(s, c, 'investment_contribution', shares[c], `Bought ${c}`, lean);
    }
  }
  const trimmed = s.policy.savingsContributionPerMonth + s.policy.investmentContributionPerMonth - saveAmt - investAmt;
  if (trimmed > 0.5 && (s.policy.savingsContributionPerMonth + s.policy.investmentContributionPerMonth) > 0) {
    notes.push({ kind: 'info', summary: `Contributions trimmed by $${round2(trimmed).toLocaleString()} to keep your cash buffer`, building: 'bank' });
  }

  // ── 5. Returns ──────────────────────────────────────────────────────────────
  const sInt = round2(s.savings * monthlyRate(s.assumptions.savingsApy));
  if (sInt > 0) post(s, 'savings', 'savings_interest', sInt, 'Savings interest', lean);
  const zS = rng.market.normal();
  const z2 = rng.market.normal();
  const z3 = rng.market.normal();
  const { stockEtf, stockBond } = s.assumptions.correlation;
  const z = { stock: zS, etf: stockEtf * zS + Math.sqrt(1 - stockEtf ** 2) * z2, bond: stockBond * zS + Math.sqrt(1 - stockBond ** 2) * z3 };
  let totalReturn = 0;
  for (const c of ASSET_CLASSES) {
    const a = s.assumptions.assets[c];
    const sig = a.annualVolatility / Math.sqrt(12);
    const mu = Math.log(1 + a.expectedAnnualReturn) / 12 - (sig * sig) / 2; // lognormal: returns bounded > -100%
    const r = Math.exp(mu + sig * z[c]) - 1;
    s.marketState.lastMonthlyReturns[c] = r;
    s.marketState.index[c] = s.marketState.index[c] * (1 + r);
    const gain = round2(s.investments[c] * r);
    if (gain !== 0) post(s, c, 'investment_return', gain, `${a.label} ${r >= 0 ? 'gain' : 'loss'} ${(r * 100).toFixed(1)}%`, lean);
    totalReturn += gain;
  }

  // ── 6. Shocks ───────────────────────────────────────────────────────────────
  const shockEvents = rollShocks(s, rng.shocks, lean);
  for (const ev of shockEvents) {
    s.activeEvents.push(ev);
    const sh = ev.shock!;
    notes.push({ kind: 'negative', summary: `${ev.title}: $${sh.grossCost.toLocaleString()} (you paid $${sh.outOfPocket.toLocaleString()})`, details: ev.body, building: ev.buildingTarget });
    timeline.push({ type: 'shock', description: `${ev.title}: cost $${sh.grossCost.toLocaleString()}, insurer paid $${sh.insurerPaid.toLocaleString()}, out of pocket $${sh.outOfPocket.toLocaleString()}`, eventId: ev.id });
  }
  if (rollEmployment(s, rng.employment)) {
    const ev: GameEvent = {
      id: makeId('EVJ', s, 0), type: 'A', title: 'Job loss', source: 'engine', buildingTarget: 'office', createdAtMonth: m, expiresAtMonth: m + 2,
      body: `Your employer cut your position, so illustrative unemployment benefits replace part of your pay for about ${s.employment.monthsUnemployedRemaining} months unless you take another offer.`,
      options: [{ id: 'ack', label: 'Understood', description: 'Acknowledge', effect: { template: 'none' } }],
      shock: { kind: 'job_loss', grossCost: 0, insurerPaid: 0, outOfPocket: 0, planId: null, fundedFrom: [] },
    };
    s.activeEvents.push(ev);
    s.realizedShocks.push({ monthIndex: m, shock: ev.shock! });
    notes.push({ kind: 'negative', summary: 'You lost your job', details: ev.body, building: 'office' });
    timeline.push({ type: 'shock', description: `Job loss; ${s.employment.monthsUnemployedRemaining} months of reduced income`, eventId: ev.id });
  }

  // ── 7. Alerts / checkpoint ──────────────────────────────────────────────────
  s.activeEvents = s.activeEvents.filter((e) => e.expiresAtMonth === undefined || e.expiresAtMonth >= m + 1);
  const nwAfter = netWorthOf(s);
  s.netWorthHistory.push(nwAfter);
  if (nwBefore < 0 && nwAfter >= 0) timeline.push({ type: 'milestone', description: 'Net worth crossed above zero' });
  const essentials = h.housingMonthly + h.essentialsMonthly;
  const prevCovered = essentials > 0 ? (input.cash + input.savings) / essentials : Infinity;
  const nowCovered = essentials > 0 ? (s.cash + s.savings) / essentials : Infinity;
  if (prevCovered < 3 && nowCovered >= 3) {
    timeline.push({ type: 'milestone', description: 'Emergency fund reached 3 months of housing + essentials' });
    notes.push({ kind: 'positive', summary: 'Emergency fund: 3 months of essentials covered', building: 'bank' });
  }
  if (!lean) {
    const net = round2(grossPay - withheld - (h.housingMonthly + h.essentialsMonthly + h.discretionaryMonthly) - premiums - debtPaid);
    notes.unshift({
      kind: 'info',
      summary: `Pay $${Math.round(grossPay).toLocaleString()} − withholding $${Math.round(withheld).toLocaleString()} − costs $${Math.round(h.housingMonthly + h.essentialsMonthly + h.discretionaryMonthly + premiums + debtPaid).toLocaleString()} = ${net < 0 ? '−' : ''}$${Math.abs(Math.round(net)).toLocaleString()} kept; investments ${totalReturn >= 0 ? '+' : '−'}$${Math.abs(Math.round(totalReturn)).toLocaleString()}`,
    });
    notes.forEach((n, i) => s.notifications.push({ id: makeId('N', s, s.notifications.length + i), monthIndex: m, kind: n.kind, summary: n.summary, details: n.details, relatedBuilding: n.building, read: false }));
    timeline.forEach((t, i) => s.timeline.push({ id: makeId('T', s, s.timeline.length + i), monthIndex: m, type: t.type, description: t.description, eventId: t.eventId, netWorthAfter: nwAfter }));
  }
  s.monthIndex = m + 1;
  if (s.monthIndex >= s.durationMonths) {
    s.status = 'finished';
    if (!lean) s.timeline.push({ id: makeId('T', s, s.timeline.length), monthIndex: s.monthIndex, type: 'milestone', description: 'Horizon reached — run finished', netWorthAfter: nwAfter });
  }
  return s;
}
