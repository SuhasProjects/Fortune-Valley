import { describe, expect, it } from 'vitest';
import { netWorthOf, pathSeed, runMonteCarlo } from '@/engine';
import { ARCHETYPE_IDS, playRandom, replaySteps } from './helpers/randomPlay';

describe('determinism', () => {
  it('same config + same actions → byte-identical state JSON', () => {
    for (const archetype of ARCHETYPE_IDS) {
      for (const seed of [1, 2, 3]) {
        const a = playRandom(archetype, { seed, months: 18 });
        const b = playRandom(archetype, { seed, months: 18 });
        expect(JSON.stringify(b.state)).toBe(JSON.stringify(a.state));
        expect(JSON.stringify(b.steps)).toBe(JSON.stringify(a.steps));
        // Replaying the recorded steps (not the generator) reproduces the same state.
        expect(JSON.stringify(replaySteps(a.config, a.steps))).toBe(JSON.stringify(a.state));
      }
    }
  });

  it('lean replay ends at the same balances as the full run', () => {
    for (const archetype of ARCHETYPE_IDS) {
      for (const seed of [4, 5, 6]) {
        const { config, state, steps } = playRandom(archetype, { seed, months: 24 });
        const lean = replaySteps(config, steps, { lean: true });
        // lean skips advanceMonth bookkeeping; player actions still post (so the ledger has no engine categories).
        expect(lean.ledger.some((e) => e.category === 'salary' || e.category === 'housing' || e.category === 'investment_return')).toBe(false);
        expect(lean.notifications.every((n) => n.kind === 'decision')).toBe(true); // only enqueue_event notices, none from advanceMonth
        expect(netWorthOf(lean)).toBe(netWorthOf(state));
        expect([lean.cash, lean.savings, lean.investments, lean.debts]).toEqual([state.cash, state.savings, state.investments, state.debts]);
        expect(lean.netWorthHistory).toEqual(state.netWorthHistory);
        expect(lean.realizedShocks).toEqual(state.realizedShocks);
        expect(lean.shortfallMonths).toEqual(state.shortfallMonths);
        expect(lean.employment).toEqual(state.employment);
        const inPlace = replaySteps(config, steps, { lean: true, inPlace: true });
        expect(netWorthOf(inPlace)).toBe(netWorthOf(state));
      }
    }
  });

  it('runMonteCarlo: same seed → identical result; different seed → different endings', () => {
    const { config, state } = playRandom('young_family', { seed: 9, months: 12 });
    const a = runMonteCarlo(config, state.policyLog, state, { paths: 120 });
    const b = runMonteCarlo(config, state.policyLog, state, { paths: 120 });
    const { elapsedMs: _a, ...ra } = a;
    const { elapsedMs: _b, ...rb } = b;
    expect(rb).toEqual(ra);
    expect(JSON.stringify(rb)).toBe(JSON.stringify(ra));
    const c = runMonteCarlo(config, state.policyLog, state, { paths: 120, seed: config.seed + 1 });
    expect(c.endingNetWorths).not.toEqual(a.endingNetWorths);
    expect(c.seed).toBe(config.seed + 1);
    // Explicit seed equal to the default is the same run.
    const d = runMonteCarlo(config, state.policyLog, state, { paths: 120, seed: config.seed });
    expect(d.endingNetWorths).toEqual(a.endingNetWorths);
  });

  it('every path in a Monte Carlo run ends with a finite number', () => {
    const { config, state } = playRandom('college_student', { seed: 2, months: 12 });
    const r = runMonteCarlo(config, state.policyLog, state, { paths: 300 });
    expect(r.endingNetWorths).toHaveLength(300);
    expect(r.endingNetWorths.every(Number.isFinite)).toBe(true);
    expect(r.bands.every((b) => Number.isFinite(b.p10) && Number.isFinite(b.median) && Number.isFinite(b.p90) && b.p10 <= b.median && b.median <= b.p90)).toBe(true);
    expect(r.percentileOfObserved).toBeGreaterThanOrEqual(0);
    expect(r.percentileOfObserved).toBeLessThanOrEqual(1);
  });

  it('pathSeed has no collisions over 10k indices and differs between base seeds', () => {
    for (const base of [0, 1, 42, 123456789, -7, 2 ** 31, Number.MAX_SAFE_INTEGER]) {
      const seen = new Set<number>();
      for (let i = 0; i < 10_000; i++) {
        const s = pathSeed(base, i);
        expect(Number.isInteger(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
        seen.add(s);
      }
      expect(seen.size, `collision for base seed ${base}`).toBe(10_000);
    }
    expect(pathSeed(1, 0)).not.toBe(pathSeed(2, 0));
    expect(pathSeed(1, 0)).toBe(pathSeed(1, 0));
  });
});
