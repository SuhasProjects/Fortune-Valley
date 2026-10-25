/**
 * Allocation choices must visibly matter: set_allocation rebalances existing holdings, the GBM parameters
 * give a real spread, and the what-if "Invest differently" hypothetical moves the Monte Carlo bands.
 */
import { describe, expect, it } from 'vitest';
import { archetypeConfig } from '@/config/archetypes';
import { DEFAULT_ASSUMPTIONS } from '@/config/defaults';
import { advanceMonth, applyAction, createGame, listDecisions, netWorthOf, quantile, runMonteCarlo, runWhatIf } from '@/engine';
import { runPaths } from '@/engine/monteCarlo';
import type { Allocation, ArchetypeId, PolicyLogEntry } from '@/types/domain';

const at0 = (allocation: Allocation): PolicyLogEntry[] => [{ monthIndex: 0, action: { type: 'set_allocation', allocation } }];

function bands(allocation: Allocation, paths = 1000, months = 36) {
  const config = archetypeConfig('professional', 4242, { durationMonths: months });
  const ends = runPaths(config, at0(allocation), config.seed, paths, months).map((o) => o.ending).sort((a, b) => a - b);
  return { start: netWorthOf(createGame(config)), p10: quantile(ends, 0.1), p50: quantile(ends, 0.5), p90: quantile(ends, 0.9) };
}

describe('asset assumptions', () => {
  it('uses moderately stretched teaching figures with the arithmetic mean as the GBM drift', () => {
    const a = DEFAULT_ASSUMPTIONS.assets;
    expect(a.stock).toMatchObject({ expectedAnnualReturn: 0.13, annualVolatility: 0.4 });
    expect(a.etf).toMatchObject({ expectedAnnualReturn: 0.1, annualVolatility: 0.18 });
    expect(a.bond).toMatchObject({ expectedAnnualReturn: 0.045, annualVolatility: 0.06 });
    expect(DEFAULT_ASSUMPTIONS.correlation).toEqual({ stockEtf: 0.75, stockBond: 0.1 });
    // Mean of the monthly lognormal step over many draws ≈ (1+r)^(1/12) − 1 (within sampling error).
    const config = archetypeConfig('professional', 99, { durationMonths: 12 });
    let sum = 0; let n = 0;
    for (let seed = 1; seed <= 300; seed++) {
      let s = createGame({ ...config, seed });
      for (let m = 0; m < 12; m++) { s = advanceMonth(s, { lean: true, inPlace: true }); sum += s.marketState.lastMonthlyReturns.etf; n += 1; }
    }
    expect(sum / n).toBeGreaterThan(0.1 / 12 - 0.004);
    expect(sum / n).toBeLessThan(0.1 / 12 + 0.004);
  });
});

describe('set_allocation rebalances existing holdings', () => {
  it('moves the Professional\'s $40k to the target at once, net worth unchanged, with Rebalanced ledger lines', () => {
    const s0 = createGame(archetypeConfig('professional', 1));
    const before = netWorthOf(s0);
    const r = applyAction(s0, { type: 'set_allocation', allocation: { stock: 0, bond: 1, etf: 0 } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.investments).toEqual({ stock: 0, bond: 40000, etf: 0 });
    expect(netWorthOf(r.state)).toBe(before);
    const lines = r.state.ledger.filter((l) => l.category === 'rebalance');
    expect(lines.map((l) => l.description)).toEqual([
      'Rebalanced: sold $15,000 of Tech stock basket',
      'Rebalanced: bought $35,000 of Bond fund',
      'Rebalanced: sold $20,000 of S&P 500 index ETF',
    ]);
    const mixed = applyAction(r.state, { type: 'set_allocation', allocation: { stock: 0.25, bond: 0.25, etf: 0.5 } });
    expect(mixed.ok && mixed.state.investments).toEqual({ stock: 10000, bond: 10000, etf: 20000 });
    expect(mixed.ok && netWorthOf(mixed.state)).toBe(before);
  });
  it('is a no-op on holdings when nothing is invested', () => {
    const s0 = createGame(archetypeConfig('young_family', 1));
    s0.investments = { stock: 0, bond: 0, etf: 0 };
    const r = applyAction(s0, { type: 'set_allocation', allocation: { stock: 1, bond: 0, etf: 0 } });
    expect(r.ok && r.state.ledger.some((l) => l.category === 'rebalance')).toBe(false);
  });
});

describe('Monte Carlo spread for an investor (Professional, 36 months, 1000 paths)', () => {
  it('all-ETF: band several thousand dollars wide, median above start', () => {
    const b = bands({ stock: 0, bond: 0, etf: 1 });
    expect(b.p50).toBeGreaterThan(b.start + 10_000);
    expect(b.p90 - b.p10).toBeGreaterThan(20_000);
    expect(b.p10).toBeLessThan(b.p50);
  });
  it('all-bonds vs all-ETF vs all-stock: bonds give the narrowest band, stock the widest', () => {
    const bonds = bands({ stock: 0, bond: 1, etf: 0 });
    const etf = bands({ stock: 0, bond: 0, etf: 1 });
    const stock = bands({ stock: 1, bond: 0, etf: 0 });
    expect(bonds.p90 - bonds.p10).toBeLessThan((etf.p90 - etf.p10) * 0.75);
    expect(etf.p90 - etf.p10).toBeLessThan((stock.p90 - stock.p10) * 0.75);
    expect(etf.p90).toBeGreaterThan(bonds.p90 + 10_000);
    expect(stock.p10).toBeLessThan(bonds.p10 - 5_000);
  });
});

function whatIfAllocations(id: ArchetypeId) {
  const config = archetypeConfig(id, 4242);
  let s = createGame(config);
  s = applyAction(s, { type: 'resume' }).state;
  for (let m = 0; m < config.durationMonths; m++) s = advanceMonth(s);
  const mc = runMonteCarlo(config, s.policyLog, s, { paths: 300 });
  const decision = listDecisions(config, s.policyLog).find((d) => d.label.includes('Invest differently'));
  expect(decision).toBeDefined();
  expect(decision!.alternatives.map((a) => a.id)).toEqual(['all-stock', 'all-etf', '60-40', 'all-bonds']);
  const base = { config, policyLog: s.policyLog, finishMonteCarlo: mc, startNetWorth: s.netWorthHistory[0]!, observedNetWorth: mc.observedNetWorth, decisionId: decision!.id };
  return { played: s, stock: runWhatIf({ ...base, alternativeId: 'all-stock' }), etf: runWhatIf({ ...base, alternativeId: 'all-etf' }), bonds: runWhatIf({ ...base, alternativeId: 'all-bonds' }) };
}

describe('what-if "Invest differently"', () => {
  it('Professional: all-bonds vs all-ETF give clearly different 10th/90th bands (bonds narrower)', () => {
    const { bonds, etf, stock } = whatIfAllocations('professional');
    expect(bonds.changed.spread).toBeLessThan(etf.changed.spread * 0.75);
    expect(bonds.changed.spread).toBeLessThan(bonds.original.spread);
    expect(etf.changed.p90).toBeGreaterThan(bonds.changed.p90 + 5_000);
    expect(Math.abs(etf.changed.median - bonds.changed.median)).toBeGreaterThan(1_000);
    expect(stock.changed.spread).toBeGreaterThan(bonds.changed.spread * 2);
  });
  it('College Student (default $150/mo + $5k ETF): all-stock vs all-bonds band width ratio ~1.5, medians visibly apart, tiles in sensible dollars', () => {
    const { played, stock, bonds } = whatIfAllocations('college_student');
    // Budget stays solvent for a student who keeps their job: no "cash ran short" notes outside unemployment.
    const config = archetypeConfig('college_student', 4242);
    for (let seed = 1; seed <= 8; seed++) {
      let s = createGame({ ...config, seed });
      let lostJob = false;
      for (let m = 0; m < 36; m++) { s = advanceMonth(s, { lean: true, inPlace: true }); if (s.employment.status !== 'employed') lostJob = true; }
      if (!lostJob) expect(s.shortfallMonths).toEqual([]);
    }
    expect(played.shortfallMonths.length).toBeLessThan(4);
    const ratio = stock.changed.spread / bonds.changed.spread;
    expect(ratio).toBeGreaterThan(1.3);
    expect(ratio).toBeLessThan(2.5);
    expect(Math.abs(stock.changed.median - bonds.changed.median)).toBeGreaterThan(300);
    expect(Math.abs(stock.changed.median - bonds.changed.median)).toBeLessThan(5_000);
    // Summary tiles (Typical / Your run / Spread) are dollar deltas of a few hundred to a few thousand.
    for (const r of [stock, bonds]) {
      expect(Math.abs(r.delta.spread)).toBeGreaterThan(500);
      expect(Math.abs(r.delta.spread)).toBeLessThan(15_000);
      expect(Math.abs(r.delta.median)).toBeLessThan(5_000);
      expect(Math.abs(r.delta.yourEvents)).toBeLessThan(10_000);
    }
    expect(stock.delta.spread).toBeGreaterThan(0);
    expect(bonds.delta.spread).toBeLessThan(0);
  });
});

describe('"from the start" hypotheticals beat the player\'s own later changes of the same setting', () => {
  it('invest-differently still moves the bands when the player set an allocation at month 0', async () => {
    const { applyAction, runMonteCarlo, runWhatIf, listDecisions, netWorthOf, createGame, advanceMonth } = await import('@/engine');
    const { archetypeConfig } = await import('@/config/archetypes');
    const config = archetypeConfig('professional', 4242);
    let s = createGame(config);
    const start = netWorthOf(s);
    const r0 = applyAction(s, { type: 'set_allocation', allocation: { stock: 0, bond: 1, etf: 0 } });
    if (!r0.ok) throw new Error('allocation rejected');
    s = r0.state;
    for (let i = 0; i < 36; i++) s = advanceMonth(s);
    const mc = runMonteCarlo(config, s.policyLog, s, { paths: 200 });
    const alloc = listDecisions(config, s.policyLog).find((d) => d.id === 'hyp:allocation');
    expect(alloc).toBeDefined();
    const r = runWhatIf({ config, policyLog: s.policyLog, finishMonteCarlo: mc, startNetWorth: start, observedNetWorth: netWorthOf(s), decisionId: 'hyp:allocation', alternativeId: 'all-stock' });
    expect(Math.abs(r.delta.spread)).toBeGreaterThan(5000);
    expect(r.changed.p90 - r.changed.p10).toBeGreaterThan(1.5 * (r.original.p90 - r.original.p10));
  });
});
