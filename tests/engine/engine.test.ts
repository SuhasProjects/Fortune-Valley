import { describe, expect, it } from 'vitest';
import { archetypeConfig } from '@/config/archetypes';
import { DEFAULT_ASSUMPTIONS } from '@/config/defaults';
import { advanceMonth, annualWithholding, applyAction, createGame, netWorthOf, runMonteCarlo, compareStrategies, settleClaim, round2 } from '@/engine';
import { makeRng, monthRng } from '@/engine/rng';
import type { AccountRef, GameState } from '@/types/domain';

const play = (s: GameState, months: number) => { for (let i = 0; i < months; i++) s = advanceMonth(s); return s; };
const start = (id: Parameters<typeof archetypeConfig>[0] = 'entry_worker', seed = 11, months = 24) => createGame(archetypeConfig(id, seed, { durationMonths: months }));

describe('determinism', () => {
  it('same seed → identical month transitions and ledger', () => {
    const a = play(start(), 24);
    const b = play(start(), 24);
    expect(a).toEqual(b);
    expect(JSON.stringify(a.ledger)).toBe(JSON.stringify(b.ledger));
  });
  it('different seeds → different market paths', () => {
    const a = play(start('professional', 1, 12), 12);
    const b = play(start('professional', 2, 12), 12);
    expect(a.marketState.index).not.toEqual(b.marketState.index);
  });
  it('advanceMonth does not mutate its input', () => {
    const s0 = start();
    const snapshot = JSON.stringify(s0);
    advanceMonth(s0);
    expect(JSON.stringify(s0)).toBe(snapshot);
  });
  it('rng streams are independent and reproducible', () => {
    expect(monthRng(5, 3, 'market').next()).toBe(monthRng(5, 3, 'market').next());
    expect(monthRng(5, 3, 'market').next()).not.toBe(monthRng(5, 3, 'shocks').next());
    const r = makeRng(99); const xs = Array.from({ length: 1000 }, () => r.normal());
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(Math.abs(mean)).toBeLessThan(0.15);
  });
});

describe('accounting reconciliation', () => {
  it('ledger per account reconciles with balance deltas and net worth identity holds', () => {
    const s0 = start('young_family', 3, 36);
    const s1 = play(s0, 36);
    const sum = (acct: AccountRef) => round2(s1.ledger.filter((l) => l.account === acct).reduce((a, l) => a + l.amountSigned, 0));
    expect(round2(s0.cash + sum('cash'))).toBeCloseTo(s1.cash, 1);
    expect(round2(s0.savings + sum('savings'))).toBeCloseTo(s1.savings, 1);
    for (const c of ['stock', 'bond', 'etf'] as const) expect(round2(s0.investments[c] + sum(c))).toBeCloseTo(s1.investments[c], 1);
    for (const d of s1.debts) {
      const d0 = s0.debts.find((x) => x.id === d.id)?.balance ?? 0;
      expect(round2(d0 + sum(`debt:${d.id}`))).toBeCloseTo(d.balance, 1);
    }
    const inv = s1.investments.stock + s1.investments.bond + s1.investments.etf;
    expect(netWorthOf(s1)).toBeCloseTo(s1.cash + s1.savings + inv - s1.debts.reduce((a, d) => a + d.balance, 0), 2);
    expect(s1.netWorthHistory).toHaveLength(37);
    expect(s1.netWorthHistory[36]).toBeCloseTo(netWorthOf(s1), 2);
  });
  it('one month: salary, withholding, rent, premium, debt interest+payment, investment return all appear', () => {
    const s = advanceMonth(start('entry_worker', 1));
    const cats = new Set(s.ledger.map((l) => l.category));
    for (const c of ['salary', 'tax_withholding', 'housing', 'essentials', 'insurance_premium', 'debt_interest', 'debt_payment', 'savings_contribution', 'investment_contribution', 'investment_return', 'savings_interest']) expect(cats.has(c as never), c).toBe(true);
  });
  it('withholding is consistent, progressive and labeled illustrative', () => {
    const s = start('entry_worker');
    const w1 = annualWithholding(s, 52000);
    const w2 = annualWithholding(s, 104000);
    expect(w1.incomeTax).toBeCloseTo(1160 + (37400 - 11600) * 0.12, 0);
    expect(w2.incomeTax / 104000).toBeGreaterThan(w1.incomeTax / 52000);
    expect(w1.payroll).toBeCloseTo(52000 * DEFAULT_ASSUMPTIONS.tax.payrollRate, 2);
    expect(s.taxProfile.note).toMatch(/Illustrative/);
    const gross = s.ledger.length; // unused guard
    expect(gross).toBe(0);
  });
  it('debt accrues interest then pays down; payment never exceeds balance; payoff is recorded', () => {
    let s = start('college_student', 4, 60);
    s = applyAction(s, { type: 'set_extra_debt_payment', amount: 400 }).state;
    const cc0 = s.debts.find((d) => d.id === 'cc_1')!.balance;
    const s1 = advanceMonth(s);
    const interest = s1.ledger.find((l) => l.account === 'debt:cc_1' && l.category === 'debt_interest')!.amountSigned;
    expect(interest).toBeCloseTo(round2(cc0 * 0.249 / 12), 2);
    const pay = -s1.ledger.find((l) => l.account === 'debt:cc_1' && l.category === 'debt_payment')!.amountSigned;
    expect(pay).toBeLessThanOrEqual(cc0 + interest + 0.01);
    let t = s1;
    for (let i = 0; i < 12 && t.debts.some((d) => d.id === 'cc_1' && d.balance > 0); i++) t = advanceMonth(t);
    expect(t.debts.find((d) => d.id === 'cc_1')?.balance ?? 0).toBe(0);
    expect(t.timeline.some((e) => e.description.includes('Paid off Credit card'))).toBe(true);
  });
});

describe('policy & actions', () => {
  it('rejects invalid allocations without mutating state', () => {
    const s = start();
    for (const alloc of [{ stock: 0.5, bond: 0.5, etf: 0.5 }, { stock: -0.1, bond: 0.6, etf: 0.5 }, { stock: 1, bond: 0, etf: 0.01 }]) {
      const r = applyAction(s, { type: 'set_allocation', allocation: alloc });
      expect(r.ok).toBe(false);
      expect(r.state).toBe(s);
    }
    expect(applyAction(s, { type: 'set_allocation', allocation: { stock: 0.3333, bond: 0.3333, etf: 0.3334 } }).ok).toBe(true);
  });
  it('allocation routes contributions and returns to the correct balances', () => {
    let s = start('entry_worker', 8);
    s = applyAction(s, { type: 'set_allocation', allocation: { stock: 0, bond: 0, etf: 1 } }).state;
    s = applyAction(s, { type: 'set_contributions', savingsContributionPerMonth: 0, investmentContributionPerMonth: 200 }).state;
    const s1 = advanceMonth(s);
    expect(s1.investments.stock).toBe(0);
    expect(s1.investments.bond).toBe(0);
    expect(s1.investments.etf).toBeGreaterThan(190);
    const etfReturn = s1.ledger.find((l) => l.account === 'etf' && l.category === 'investment_return');
    expect(etfReturn).toBeTruthy();
    expect(s1.investments.etf).toBeCloseTo(200 + (etfReturn?.amountSigned ?? 0), 1);
  });
  it('insufficient cash → contributions trimmed, then documented funding order; money is never invented', () => {
    let s = start('college_student', 2);
    s = applyAction(s, { type: 'set_contributions', savingsContributionPerMonth: 5000, investmentContributionPerMonth: 5000 }).state;
    s = applyAction(s, { type: 'set_budget', discretionaryMonthly: 3000 }).state;
    const s1 = advanceMonth(s);
    expect(s1.cash).toBeGreaterThanOrEqual(0);
    const contributed = s1.ledger.filter((l) => l.account === 'cash' && (l.category === 'savings_contribution' || l.category === 'investment_contribution')).reduce((a, l) => a - l.amountSigned, 0);
    expect(contributed).toBeLessThan(10000);
    const od = s1.debts.find((d) => d.kind === 'overdraft');
    expect(od).toBeTruthy();
    expect(s1.shortfallMonths).toContain(0);
    expect(netWorthOf(s1)).toBeCloseTo(s1.cash + s1.savings + s1.investments.stock + s1.investments.bond + s1.investments.etf - s1.debts.reduce((a, d) => a + d.balance, 0), 2);
  });
  it('make_extra_payment rejects overpayment and unknown debts', () => {
    const s = start();
    expect(applyAction(s, { type: 'make_extra_payment', debtId: 'nope', amount: 10 }).ok).toBe(false);
    expect(applyAction(s, { type: 'make_extra_payment', debtId: 'auto_1', amount: 1e9 }).ok).toBe(false);
    const r = applyAction(s, { type: 'make_extra_payment', debtId: 'auto_1', amount: 500 });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.state.cash).toBeCloseTo(s.cash - 500, 2); expect(r.state.debts.find((d) => d.id === 'auto_1')!.balance).toBeCloseTo(11000 - 500, 2); expect(r.state.policyLog).toHaveLength(1); }
  });
  it('a policy change persists into later months', () => {
    let s = start('entry_worker', 5);
    s = applyAction(s, { type: 'set_budget', discretionaryMonthly: 100 }).state;
    s = play(s, 5);
    const disc = s.ledger.filter((l) => l.category === 'discretionary');
    expect(disc).toHaveLength(5);
    expect(disc.every((l) => l.amountSigned === -100)).toBe(true);
  });
  it('finished game rejects actions', () => {
    const s = play(start('entry_worker', 5, 6), 6);
    expect(s.status).toBe('finished');
    expect(applyAction(s, { type: 'set_budget', discretionaryMonthly: 1 }).ok).toBe(false);
    expect(advanceMonth(s)).toBe(s);
  });
});

describe('insurance & shocks', () => {
  it('insurance changes payout, never incidence', () => {
    const withIns = start('young_family', 77, 60);
    let noIns = start('young_family', 77, 60);
    for (const line of ['health', 'auto', 'renters'] as const) noIns = applyAction(noIns, { type: 'set_insurance', line, planId: null }).state;
    const a = play(withIns, 60), b = play(noIns, 60);
    const occA = a.realizedShocks.map((r) => `${r.monthIndex}:${r.shock.kind}:${r.shock.grossCost}`);
    const occB = b.realizedShocks.map((r) => `${r.monthIndex}:${r.shock.kind}:${r.shock.grossCost}`);
    expect(occA).toEqual(occB);
    expect(occA.length).toBeGreaterThan(0);
    const oopA = a.realizedShocks.reduce((x, r) => x + r.shock.outOfPocket, 0);
    const oopB = b.realizedShocks.reduce((x, r) => x + r.shock.outOfPocket, 0);
    expect(oopB).toBeGreaterThan(oopA);
    expect(b.realizedShocks.every((r) => r.shock.insurerPaid === 0)).toBe(true);
  });
  it('claim math: deductible, coinsurance, out-of-pocket max, coverage cap', () => {
    const plan = DEFAULT_ASSUMPTIONS.insurancePlans.find((p) => p.id === 'health_basic')!;
    expect(settleClaim(1000, plan)).toEqual({ insurerPaid: 0, outOfPocket: 1000 });
    expect(settleClaim(10000, plan)).toEqual({ insurerPaid: 10000 - (4000 + 6000 * 0.3), outOfPocket: 4000 + 6000 * 0.3 });
    expect(settleClaim(60000, plan).outOfPocket).toBe(8000);
    const auto = DEFAULT_ASSUMPTIONS.insurancePlans.find((p) => p.id === 'auto_full')!;
    expect(settleClaim(30000, auto)).toEqual({ insurerPaid: 25000, outOfPocket: 5000 });
    expect(settleClaim(5000, null)).toEqual({ insurerPaid: 0, outOfPocket: 5000 });
  });
  it('unknown insurance plan / wrong line rejected', () => {
    const s = start();
    expect(applyAction(s, { type: 'set_insurance', line: 'health', planId: 'auto_full' }).ok).toBe(false);
    expect(applyAction(s, { type: 'set_insurance', line: 'health', planId: 'nope' }).ok).toBe(false);
  });
  it('a probabilistic emergency appears in ledger, notifications and timeline', () => {
    const s = play(start('young_family', 77, 60), 60);
    const shockLedger = s.ledger.filter((l) => l.category === 'shock_cost');
    expect(shockLedger.length).toBe(s.realizedShocks.filter((r) => r.shock.kind !== 'job_loss').length);
    expect(s.notifications.some((n) => n.kind === 'negative')).toBe(true);
    expect(s.timeline.some((t) => t.type === 'shock')).toBe(true);
  });
});

describe('Monte Carlo', () => {
  it('same seed + strategy → identical distribution; observed marker equals engine state', () => {
    const cfg = archetypeConfig('entry_worker', 21, { durationMonths: 12 });
    let s = createGame(cfg);
    s = applyAction(s, { type: 'set_allocation', allocation: { stock: 0.5, bond: 0.2, etf: 0.3 } }).state;
    s = play(s, 12);
    const a = runMonteCarlo(cfg, s.policyLog, s, { paths: 200 });
    const b = runMonteCarlo(cfg, s.policyLog, s, { paths: 200 });
    expect(a.endingNetWorths).toEqual(b.endingNetWorths);
    expect(a.observedNetWorth).toBe(netWorthOf(s));
    expect(a.observedHorizonMatches).toBe(true);
    expect(a.percentileOfObserved).toBeGreaterThanOrEqual(0);
    expect(a.p10).toBeLessThanOrEqual(a.median);
    expect(a.median).toBeLessThanOrEqual(a.p90);
    expect(a.bands).toHaveLength(13);
    // The seed path equal to the game's own seed is not forced in; the observed value comes from play, not insertion.
    expect(a.endingNetWorths.filter((x) => x === a.observedNetWorth).length).toBeLessThanOrEqual(1);
  });
  it('changing policy changes the distribution under paired seeds', () => {
    const cfg = archetypeConfig('professional', 9, { durationMonths: 24 });
    const logA = [{ monthIndex: 0, action: { type: 'set_allocation', allocation: { stock: 1, bond: 0, etf: 0 } } as const }];
    const logB = [{ monthIndex: 0, action: { type: 'set_allocation', allocation: { stock: 0, bond: 1, etf: 0 } } as const }];
    const cmp = compareStrategies(cfg, logA, logB, { a: 'all stock', b: 'all bonds' }, { months: 24, paths: 200 });
    expect(cmp.a.p90 - cmp.a.p10).toBeGreaterThan(cmp.b.p90 - cmp.b.p10);
    expect(cmp.probabilityAOutperformsB).toBeGreaterThan(0);
    expect(cmp.probabilityAOutperformsB).toBeLessThan(1);
    expect(cmp.a.endingNetWorths).not.toEqual(cmp.b.endingNetWorths);
  });
  it('1000 paths over 60 months completes quickly', () => {
    const cfg = archetypeConfig('young_family', 2, { durationMonths: 60 });
    const s = play(createGame(cfg), 60);
    const r = runMonteCarlo(cfg, s.policyLog, s, { paths: 1000 });
    expect(r.pathsCompleted).toBe(1000);
    expect(r.elapsedMs).toBeLessThan(5000);
    expect(r.probabilityLiquidityShortfall).toBeGreaterThanOrEqual(0);
  });
});
