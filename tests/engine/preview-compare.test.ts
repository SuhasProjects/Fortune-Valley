import { describe, expect, it } from 'vitest';
import { archetypeConfig } from '@/config/archetypes';
import { advanceMonth, applyAction, compareWithBaseline, createGame, hasPolicyDecisions, histogram, previewHorizon, previewMonth, selectPaySummary } from '@/engine';
import { allowRequest } from '../../api/_lib/rateLimit';
import { handleAiRequest } from '../../api/_lib/handler';

describe('previewMonth', () => {
  it('is pure, uses the same luck, and reports the delta of a change', () => {
    let s = createGame(archetypeConfig('entry_worker', 5));
    s = advanceMonth(s);
    const before = JSON.stringify(s);
    const p = previewMonth(s, { household: { discretionaryMonthly: 50 } });
    expect(JSON.stringify(s)).toBe(before);
    expect(p.rejected).toEqual([]);
    expect(p.delta.netWorth).toBeCloseTo(s.household.discretionaryMonthly - 50, 0);
    expect(p.withChange.investments).toBeCloseTo(p.baseline.investments, 1); // same returns, same contributions
  });
  it('works on paused games and over a 12-month horizon', () => {
    let s = createGame(archetypeConfig('young_family', 9));
    s = advanceMonth(s);
    s = applyAction(s, { type: 'pause' }).state;
    const one = previewMonth(s, { household: { discretionaryMonthly: 0 } });
    expect(one.baseline.netWorth).not.toBe(one.withChange.netWorth);
    const h = previewHorizon(s, { household: { discretionaryMonthly: 0 } }, 12);
    expect(h.baseline).toHaveLength(12);
    expect(h.withChange[11]!.netWorth - h.baseline[11]!.netWorth).toBeGreaterThan(12 * 400 * 0.9);
    expect(h.rejected).toEqual([]);
  });
  it('pay summary matches the engine withholding', () => {
    const s = createGame(archetypeConfig('entry_worker', 1));
    const p = selectPaySummary(s);
    expect(p.grossMonthly).toBeCloseTo(58000 / 12, 1);
    expect(p.takeHomeMonthly).toBeCloseTo(p.grossMonthly - p.withholdingMonthly, 2);
    expect(p.note).toMatch(/Illustrative/);
    const u = { ...s, employment: { ...s.employment, status: 'unemployed' as const } };
    expect(selectPaySummary(u).takeHomeMonthly).toBe(0);
  });
  it('reports rejected overrides instead of throwing', () => {
    const s = createGame(archetypeConfig('professional', 1));
    const p = previewMonth(s, { policy: { targetAllocation: { stock: 1, bond: 1, etf: 1 } } });
    expect(p.rejected[0]).toMatch(/sum to 1/);
    expect(p.delta.netWorth).toBe(0);
  });
});

describe('baseline comparison & histogram', () => {
  it('skips comparison when no decisions were made, and pairs seeds when they were', () => {
    const cfg = archetypeConfig('young_family', 3, { durationMonths: 12 });
    expect(hasPolicyDecisions([])).toBe(false);
    expect(compareWithBaseline(cfg, [], 12, { paths: 50 })).toBeUndefined();
    let s = createGame(cfg);
    s = applyAction(s, { type: 'set_insurance', line: 'health', planId: null }).state;
    s = applyAction(s, { type: 'set_budget', discretionaryMonthly: 100 }).state;
    const cmp = compareWithBaseline(cfg, s.policyLog, 12, { paths: 100 })!;
    expect(cmp.labelB).toMatch(/Default/);
    expect(cmp.a.endingNetWorths).toHaveLength(100);
    expect(cmp.probabilityAOutperformsB).toBeGreaterThan(0);
    expect(cmp.pairedMedianDifference).not.toBeNaN();
  });
  it('histogram bins cover every sample', () => {
    const h = histogram([-5, -1, 0, 2, 2.5, 9, 10], 5);
    expect(h).toHaveLength(5);
    expect(h.reduce((a, b) => a + b.count, 0)).toBe(7);
    expect(h[0]!.start).toBe(-5);
    expect(h[4]!.end).toBe(10);
  });
});

describe('gateway guards', () => {
  it('rate limits per client and rejects oversized bodies', async () => {
    let allowed = 0;
    for (let i = 0; i < 45; i++) if (allowRequest('c1', 1_000_000 + i).ok) allowed += 1;
    expect(allowed).toBe(40);
    expect(allowRequest('c1', 1_000_000 + 5 * 60_000 + 1).ok).toBe(true);
    const big = await handleAiRequest('x'.repeat(250_000), { AI_API_KEY: 'k' });
    expect(big.status).toBe(413);
    const limited = await (async () => { let r; for (let i = 0; i < 41; i++) r = await handleAiRequest('{}', {}, undefined, { clientKey: 'c2' }); return r!; })();
    expect(limited.body).toMatchObject({ code: 'rate_limited' });
  });
});
