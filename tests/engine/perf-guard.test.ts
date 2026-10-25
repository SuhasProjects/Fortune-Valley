import { describe, expect, it } from 'vitest';
import { archetypeConfig } from '@/config/archetypes';
import { advanceMonth, applyAction, createGame, runMonteCarlo, runWhatIf } from '@/engine';
import type { ArchetypeId, GameState } from '@/types/domain';

// Generous local bounds (task: MC 1,000 × 24 under 1.5 s, what-if under 1 s); skipped on CI runners.
// Uses a realistic log (a handful of decisions); a 40-entry random log with monthly loans runs ~1.4 s in isolation.
const onCi = !!process.env.CI;
const time = (fn: () => void) => { const t0 = performance.now(); fn(); return performance.now() - t0; };

function playScripted(archetype: ArchetypeId, seed: number) {
  const config = archetypeConfig(archetype, seed, { durationMonths: 24 });
  let s: GameState = createGame(config);
  for (let m = 0; m < 24; m++) {
    if (m === 1) s = applyAction(s, { type: 'set_contributions', savingsContributionPerMonth: 300, investmentContributionPerMonth: 200 }).state;
    if (m === 3) s = applyAction(s, { type: 'set_allocation', allocation: { stock: 0.1, bond: 0.3, etf: 0.6 } }).state;
    if (m === 6) s = applyAction(s, { type: 'set_budget', discretionaryMonthly: 200 }).state;
    if (m === 9) s = applyAction(s, { type: 'set_insurance', line: 'renters', planId: 'renters_basic' }).state;
    s = advanceMonth(s);
  }
  return { config, state: s };
}

describe.skipIf(onCi)('performance guard', () => {
  it('runMonteCarlo: 1,000 paths × 24 months under 1.5 s', () => {
    const { config, state } = playScripted('young_family', 1);
    runMonteCarlo(config, state.policyLog, state, { paths: 50 }); // warm-up (JIT)
    const ms = time(() => {
      const r = runMonteCarlo(config, state.policyLog, state, { paths: 1000 });
      expect(r.pathsCompleted).toBe(1000);
      expect(r.months).toBe(24);
    });
    expect(ms).toBeLessThan(1500);
  });

  it('runWhatIf on a 1,000-path finish run under 1 s', () => {
    const { config, state } = playScripted('entry_worker', 2);
    const mc = runMonteCarlo(config, state.policyLog, state, { paths: 1000 }); // also warms the JIT
    const input = { config, policyLog: state.policyLog, finishMonteCarlo: mc, startNetWorth: state.netWorthHistory[0]!, observedNetWorth: mc.observedNetWorth, decisionId: '1', alternativeId: 'undo' };
    const ms = time(() => { runWhatIf(input); });
    expect(ms).toBeLessThan(1000);
  });

  it('a full 24-month game with ledger and notifications under 100 ms', () => {
    let s = createGame(archetypeConfig('professional', 3, { durationMonths: 24 }));
    const ms = time(() => { for (let m = 0; m < 24; m++) s = advanceMonth(s); });
    expect(s.status).toBe('finished');
    expect(ms).toBeLessThan(100);
  });
});
