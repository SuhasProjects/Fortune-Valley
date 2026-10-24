import { describe, expect, it } from 'vitest';
import { advanceMonth, applyAction, netWorthOf, parseSave, serializeSave, SAVE_SCHEMA_VERSION } from '@/engine';
import type { SaveFile } from '@/engine';
import type { GameState } from '@/types/domain';
import { ARCHETYPE_IDS, playRandom } from './helpers/randomPlay';

type Mutator = (save: SaveFile) => void;
type Json = Record<string, unknown>;
const asJson = (v: unknown) => v as Json;

const base = (() => {
  const { config, state } = playRandom('young_family', { seed: 21, months: 24 });
  return { config, state, raw: serializeSave(config, state) };
})();

const mutate = (fn: Mutator): string => {
  const save = JSON.parse(base.raw) as SaveFile;
  fn(save);
  return JSON.stringify(save);
};

/** An accepted save must be a state the engine can actually run. */
function assertUsable(raw: string, label: string) {
  const r = parseSave(raw);
  expect(r.ok, `${label}: ${r.ok ? '' : r.error}`).toBe(true);
  if (!r.ok) return;
  const s = { ...r.save.state, status: 'playing' as const, durationMonths: r.save.state.monthIndex + 2 };
  expect(() => advanceMonth(s), `${label}: advanceMonth after load`).not.toThrow();
  expect(applyAction(s, { type: 'set_budget', discretionaryMonthly: 10 }).ok, `${label}: action after load`).toBe(true);
}

describe('parseSave fuzzing', () => {
  const garbage: [string, string | null | undefined][] = [
    ['undefined', undefined], ['null', null], ['empty', ''], ['truncated', base.raw.slice(0, 500)], ['open brace', '{'],
    ['json null', 'null'], ['array', '[]'], ['string', '"save"'], ['number', '42'], ['literal undefined', 'undefined'],
    ['version only', '{"schemaVersion":1}'], ['config string', '{"schemaVersion":1,"config":"x","state":"y"}'],
    ['1 MB string', 'x'.repeat(1 << 20)], ['1 MB JSON string', JSON.stringify('x'.repeat(1 << 20))],
    ['1 MB nested', '['.repeat(1 << 16)], ['huge literal cash', base.raw.replace(/"cash":[-\d.e]+/, '"cash":1e999')],
    ['NaN-ish cash', base.raw.replace(/"cash":[-\d.e]+/, '"cash":"NaN"')],
    ['state null', mutate((s) => { asJson(s).state = null; })], ['config null', mutate((s) => { asJson(s).config = null; })],
    ['state array', mutate((s) => { asJson(s).state = []; })], ['debts null entries', mutate((s) => { (s.state.debts as unknown[]) = [null]; })],
    ['ledger not array', mutate((s) => { asJson(s.state).ledger = {}; })],
  ];
  it.each(garbage)('never throws and rejects: %s', (_label, raw) => {
    let r: ReturnType<typeof parseSave> | undefined;
    expect(() => { r = parseSave(raw); }).not.toThrow();
    expect(r!.ok).toBe(false);
    if (!r!.ok) expect(typeof r!.error).toBe('string');
  });

  const wrong: [string, Mutator][] = [
    ['schema version 0', (s) => { asJson(s).schemaVersion = 0; }],
    ['schema version 2', (s) => { asJson(s).schemaVersion = 2; }],
    ['schema version string', (s) => { asJson(s).schemaVersion = '1'; }],
    ['state schema 2', (s) => { asJson(s.state).schemaVersion = 2; }],
    ['seed mismatch', (s) => { s.state.seed = s.config.seed + 1; }],
    ['scenario mismatch', (s) => { s.state.scenarioId = 'other'; }],
    ['negative month', (s) => { s.state.monthIndex = -1; }],
    ['fractional month', (s) => { s.state.monthIndex = 1.5; }],
    ['month beyond duration', (s) => { s.state.monthIndex = s.config.durationMonths + 1; }],
    ['bad status', (s) => { asJson(s.state).status = 'running'; }],
    ['cash string', (s) => { asJson(s.state).cash = '100'; }],
    ['savings null', (s) => { asJson(s.state).savings = null; }],
    ['investments missing', (s) => { delete asJson(s.state).investments; }],
    ['debt balance string', (s) => { (asJson(s.state.debts[0]) as Json).balance = 'x'; }],
    ['debt balance negative', (s) => { s.state.debts[0]!.balance = -1; s.state.netWorthHistory[s.state.monthIndex] = netWorthOf(s.state); }],
    ['debt id missing', (s) => { delete (asJson(s.state.debts[0]) as Json).id; }],
    ['history too short', (s) => { s.state.netWorthHistory.pop(); }],
    ['history with NaN marker', (s) => { (s.state.netWorthHistory as unknown[])[0] = null; }],
    ['history does not reconcile', (s) => { s.state.cash += 1000; }],
    ['config duration out of bounds', (s) => { s.config.durationMonths = 10_000; }],
    ['config huge salary', (s) => { s.config.initialState.employment.grossAnnualSalary = 1e12; }],
    ['config negative cash', (s) => { s.config.initialState.cash = -5; }],
    ['config bad allocation', (s) => { s.config.initialState.policy.targetAllocation = { stock: 1, bond: 1, etf: 1 }; }],
    ['config assumptions missing', (s) => { delete asJson(s.config).assumptions; }],
    ...(['ledger', 'policyLog', 'timeline', 'notifications', 'activeEvents', 'netWorthHistory', 'debts', 'shortfallMonths', 'realizedShocks'] as const)
      .map((k): [string, Mutator] => [`missing ${k}`, (s) => { delete asJson(s.state)[k]; }]),
    ...(['marketState', 'policy', 'household', 'employment', 'assumptions', 'insurance', 'taxProfile'] as const)
      .map((k): [string, Mutator] => [`missing ${k}`, (s) => { delete asJson(s.state)[k]; }]),
    ['state allocation invalid', (s) => { s.state.policy.targetAllocation = { stock: 2, bond: 0, etf: 0 }; }],
    ['state assumptions broken', (s) => { asJson(s.state.assumptions).insurancePlans = null; }],
    ['state duration NaN', (s) => { asJson(s.state).durationMonths = 'soon'; }],
    ['state duration negative', (s) => { s.state.durationMonths = -3; }],
  ];
  it.each(wrong)('rejects %s without throwing', (_label, fn) => {
    const raw = mutate(fn);
    let r: ReturnType<typeof parseSave> | undefined;
    expect(() => { r = parseSave(raw); }).not.toThrow();
    expect(r!.ok, r!.ok ? 'accepted an invalid save' : r!.error).toBe(false);
  });

  it('tolerates extra keys and prototype-pollution keys without polluting Object.prototype', () => {
    const polluted = mutate((s) => { asJson(s).extra = { deep: [1, 2, 3] }; })
      .replace('{"schemaVersion":1,', '{"schemaVersion":1,"__proto__":{"polluted":true},')
      .replace('"state":{', '"state":{"__proto__":{"polluted":true},');
    expect(polluted).toContain('__proto__');
    assertUsable(polluted, 'prototype keys');
    expect(({} as Json).polluted).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('accepts the unmodified save and every status', () => {
    for (const status of ['setup', 'playing', 'paused', 'finished'] as const) assertUsable(mutate((s) => { s.state.status = status; }), status);
  });
});

describe('serializeSave → parseSave round trip', () => {
  for (const archetype of ARCHETYPE_IDS) {
    it(`round-trips a played ${archetype} game including policyLog alternatives`, () => {
      const { config, state } = playRandom(archetype, { seed: 31, months: 18 });
      const r = parseSave(serializeSave(config, state));
      expect(r.ok, r.ok ? '' : r.error).toBe(true);
      if (!r.ok) return;
      expect(r.save.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
      expect(r.save.state).toEqual(state);
      expect(r.save.config).toEqual(config);
      expect(JSON.stringify(r.save.state)).toBe(JSON.stringify(state));
      const withAlternatives = state.policyLog.filter((e) => e.alternatives && e.alternatives.length > 0);
      expect(withAlternatives.length).toBeGreaterThan(0);
      expect(r.save.state.policyLog.filter((e) => e.alternatives && e.alternatives.length > 0)).toEqual(withAlternatives);
      expect(r.save.state.policyLog.filter((e) => e.label)).toEqual(state.policyLog.filter((e) => e.label));
      expect(new Date(r.save.savedAt).getTime()).not.toBeNaN();
      // A loaded save keeps playing identically to the original object.
      const a = advanceMonth({ ...state, status: 'playing', durationMonths: 24 });
      const b = advanceMonth({ ...r.save.state, status: 'playing', durationMonths: 24 });
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    });
  }

  it('round-trips a mid-month save (actions applied, month not advanced)', () => {
    const { config, state } = playRandom('professional', { seed: 8, months: 10 });
    let s: GameState = { ...state, status: 'playing', durationMonths: 12 };
    s = applyAction(s, { type: 'transfer', from: 'cash', to: 'savings', amount: 1 }).state;
    s = applyAction(s, { type: 'set_contributions', savingsContributionPerMonth: 10, investmentContributionPerMonth: 10 }).state;
    const r = parseSave(serializeSave(config, s));
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
    if (r.ok) expect(r.save.state).toEqual(s);
  });
});
