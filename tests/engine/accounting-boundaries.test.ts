import { describe, expect, it } from 'vitest';
import { archetypeConfig } from '@/config/archetypes';
import { advanceMonth, applyAction, createGame, netWorthOf } from '@/engine';
import { coverShortfall } from '@/engine/accounting';

function deterministicConfig() {
  const config = archetypeConfig('professional', 12, { durationMonths: 6 });
  config.initialState.investments = { stock: 0, bond: 0, etf: 0 };
  config.assumptions.shocks = [];
  config.assumptions.employment.jobLossMonthlyIncidence = 0;
  for (const asset of Object.values(config.assumptions.assets)) {
    asset.expectedAnnualReturn = 0;
    asset.annualVolatility = 0;
  }
  return config;
}

describe('cent-level accounting boundaries', () => {
  it('does not create a cent when a one-cent contribution is split evenly', () => {
    let state = createGame(deterministicConfig());
    state = applyAction(state, { type: 'set_allocation', allocation: { stock: .5, bond: .5, etf: 0 } }).state;
    state = applyAction(state, { type: 'set_contributions', savingsContributionPerMonth: 0, investmentContributionPerMonth: .01 }).state;
    const next = advanceMonth(state);
    const debited = -next.ledger.filter(e => e.account === 'cash' && e.category === 'investment_contribution').reduce((n, e) => n + e.amountSigned, 0);
    const credited = next.ledger.filter(e => e.account !== 'cash' && e.category === 'investment_contribution').reduce((n, e) => n + e.amountSigned, 0);
    expect(debited).toBe(.01);
    expect(credited).toBeCloseTo(debited, 10);
    expect(next.investments.etf).toBeGreaterThanOrEqual(0);
  });

  it('liquidates exactly one cent without selling too much or borrowing unnecessarily', () => {
    const state = createGame(deterministicConfig());
    state.cash = -.01;
    state.savings = 0;
    state.investments = { stock: .01, bond: .01, etf: 0 };
    state.policy.emergencyFundingOrder = ['investments', 'borrow'];
    const before = netWorthOf(state);
    coverShortfall(state, 'test expense');
    expect(state.cash).toBe(0);
    expect(state.investments.stock + state.investments.bond).toBeCloseTo(.01, 10);
    expect(netWorthOf(state)).toBe(before);
    expect(state.debts.some(d => d.kind === 'overdraft')).toBe(false);
  });

  it('accepts tolerance-level weights without creating or dropping contribution cents', () => {
    let state = createGame(deterministicConfig());
    state = applyAction(state, { type: 'set_allocation', allocation: { stock: .5004, bond: .5004, etf: 0 } }).state;
    state = applyAction(state, { type: 'set_contributions', savingsContributionPerMonth: 0, investmentContributionPerMonth: 1000 }).state;
    const next = advanceMonth(state);
    expect(next.investments.stock + next.investments.bond + next.investments.etf).toBeCloseTo(1000, 10);
  });
});

describe('state ownership', () => {
  it('isolates active assumptions from later configuration edits', () => {
    const config = deterministicConfig();
    const state = createGame(config);
    config.assumptions.assets.stock.expectedAnnualReturn = .9;
    expect(state.assumptions.assets.stock.expectedAnnualReturn).toBe(0);
  });

  it('snapshots policy actions rather than retaining caller-owned objects', () => {
    const action = { type: 'set_allocation' as const, allocation: { stock: .2, bond: .3, etf: .5 } };
    const result = applyAction(createGame(deterministicConfig()), action);
    action.allocation.stock = .9;
    expect(result.state.policyLog[0]!.action).toEqual({ type: 'set_allocation', allocation: { stock: .2, bond: .3, etf: .5 } });
  });
});

describe('simulation input boundaries', () => {
  it('rejects invalid path counts and horizons before running any paths', async () => {
    const { runMonteCarlo, compareStrategies } = await import('@/engine');
    const config = deterministicConfig(), state = createGame(config);
    for (const paths of [0, -1, 1.5, NaN, Infinity, 10001]) {
      expect(() => runMonteCarlo(config, [], state, { paths })).toThrow();
      expect(() => compareStrategies(config, [], [], { a: 'A', b: 'B' }, { paths, months: 6 })).toThrow();
    }
    for (const months of [0, -1, 1.5, NaN, Infinity, 241]) {
      expect(() => runMonteCarlo(config, [], state, { paths: 1, months })).toThrow();
      expect(() => compareStrategies(config, [], [], { a: 'A', b: 'B' }, { paths: 1, months })).toThrow();
    }
  });
});
