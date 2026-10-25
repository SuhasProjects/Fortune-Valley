/**
 * Allocation choices must visibly matter: set_allocation rebalances existing holdings, the GBM parameters
 * give a real spread, and the what-if "Invest differently" hypothetical moves the Monte Carlo bands.
 */
import { describe, expect, it } from 'vitest';
import { archetypeConfig } from '@/config/archetypes';
import { DEFAULT_ASSUMPTIONS } from '@/config/defaults';
import { advanceMonth, applyAction, createGame, listDecisions, netWorthOf, quantile, runMonteCarlo, runWhatIf } from '@/engine';
import { runPaths } from '@/engine/monteCarlo';
import type { Allocation, PolicyLogEntry } from '@/types/domain';

const at0 = (allocation: Allocation): PolicyLogEntry[] => [{ monthIndex: 0, action: { type: 'set_allocation', allocation } }];

function bands(allocation: Allocation, paths = 1000, months = 36) {
  const config = archetypeConfig('professional', 4242, { durationMonths: months });
  const ends = runPaths(config, at0(allocation), config.seed, paths, months).map((o) => o.ending).sort((a, b) => a - b);
  return { start: netWorthOf(createGame(config)), p10: quantile(ends, 0.1), p50: quantile(ends, 0.5), p90: quantile(ends, 0.9) };
}

describe('asset assumptions', () => {
  it('uses rounded long-run nominal figures with the arithmetic mean as the GBM drift', () => {
    const a = DEFAULT_ASSUMPTIONS.assets;
    expect(a.stock).toMatchObject({ expectedAnnualReturn: 0.12, annualVolatility: 0.35 });
    expect(a.etf).toMatchObject({ expectedAnnualReturn: 0.1, annualVolatility: 0.17 });
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
    const s0 = createGame(archetypeConfig('college_student', 1));
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

describe('what-if "Invest differently" for a holder of investments', () => {
  it('all-bonds vs all-ETF give clearly different 10th/90th bands (bonds narrower)', () => {
    const config = archetypeConfig('professional', 4242);
    let s = createGame(config);
    s = applyAction(s, { type: 'resume' }).state;
    for (let m = 0; m < config.durationMonths; m++) s = advanceMonth(s);
    const mc = runMonteCarlo(config, s.policyLog, s, { paths: 300 });
    const decision = listDecisions(config, s.policyLog).find((d) => d.label.includes('Invest differently'));
    expect(decision).toBeDefined();
    const base = { config, policyLog: s.policyLog, finishMonteCarlo: mc, startNetWorth: s.netWorthHistory[0]!, observedNetWorth: mc.observedNetWorth, decisionId: decision!.id };
    const bonds = runWhatIf({ ...base, alternativeId: 'all-bonds' });
    const etf = runWhatIf({ ...base, alternativeId: 'all-etf' });
    expect(bonds.changed.spread).toBeLessThan(etf.changed.spread * 0.75);
    expect(bonds.changed.spread).toBeLessThan(bonds.original.spread);
    expect(etf.changed.p90).toBeGreaterThan(bonds.changed.p90 + 5_000);
    expect(Math.abs(etf.changed.median - bonds.changed.median)).toBeGreaterThan(1_000);
  });
});
