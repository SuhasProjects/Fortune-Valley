import { describe, expect, it } from 'vitest';
import { archetypeConfig } from '@/config/archetypes';
import { advanceMonth, applyAction, changedPolicyLog, createGame, listDecisions, runMonteCarlo, runWhatIf } from '@/engine';
import { replayPath } from '@/engine/monteCarlo';
import type { GameConfig, GameEvent, GameState, PolicyLogEntry, WhatIfInput } from '@/types/domain';
import { playRandom } from './helpers/randomPlay';

const PATHS = 40;

function finishInput(config: GameConfig, state: GameState, policyLog = state.policyLog): WhatIfInput {
  const mc = runMonteCarlo(config, policyLog, state, { paths: PATHS });
  return { config, policyLog, finishMonteCarlo: mc, startNetWorth: state.netWorthHistory[0]!, observedNetWorth: mc.observedNetWorth, decisionId: 'all', alternativeId: 'defaults' };
}

const badLabel = /undefined|NaN|\[object|null/;

function assertAllPairsReplay(input: WhatIfInput) {
  const decisions = listDecisions(input.config, input.policyLog);
  for (const d of decisions) {
    expect(d.label).not.toMatch(badLabel);
    expect(d.alternatives.length).toBeGreaterThan(0);
    for (const alt of d.alternatives) {
      expect(alt.label).not.toMatch(badLabel);
      const changed = changedPolicyLog(input.config, input.policyLog, d.id, alt.id);
      expect(changed.decisionLabel).not.toMatch(badLabel);
      expect(changed.alternativeLabel).not.toMatch(badLabel);
      expect(() => replayPath(input.config, changed.log, input.config.seed, input.finishMonteCarlo.months)).not.toThrow();
      const r = runWhatIf({ ...input, decisionId: d.id, alternativeId: alt.id });
      for (const v of [r.changed.p10, r.changed.median, r.changed.p90, r.changed.yourEvents, r.delta.yourEvents, r.delta.median]) expect(Number.isFinite(v)).toBe(true);
      expect(r.changed.yourEvents).toBeCloseTo(r.original.yourEvents + r.delta.yourEvents, 2);
    }
  }
  return decisions;
}

describe('what-if API edge cases', () => {
  it('a decision made on month 0 before any advance is listed and replayable', () => {
    const config = archetypeConfig('entry_worker', 3, { durationMonths: 8 });
    let s = createGame(config);
    s = applyAction(s, { type: 'set_contributions', savingsContributionPerMonth: 400, investmentContributionPerMonth: 0 }).state;
    s = applyAction(s, { type: 'set_budget', discretionaryMonthly: 100 }).state;
    for (let m = 0; m < 8; m++) s = advanceMonth(s);
    const input = finishInput(config, s);
    const decisions = assertAllPairsReplay(input);
    expect(decisions.filter((d) => d.monthIndex === 0 && !d.id.startsWith('hyp:'))).toHaveLength(2);
    const undo = runWhatIf({ ...input, decisionId: '0', alternativeId: 'undo' });
    expect(undo.yourEventsComparable).toBe(true);
    expect(undo.decisionLabel).toContain('Month 0');
  });

  it('two decisions in the same month: the second sees the first in its "before" state', () => {
    const config = archetypeConfig('professional', 4, { durationMonths: 8 });
    let s = createGame(config);
    s = advanceMonth(s);
    s = applyAction(s, { type: 'set_contributions', savingsContributionPerMonth: 100, investmentContributionPerMonth: 100 }).state;
    s = applyAction(s, { type: 'set_contributions', savingsContributionPerMonth: 900, investmentContributionPerMonth: 100 }).state;
    for (let m = 1; m < 8; m++) s = advanceMonth(s);
    const input = finishInput(config, s);
    const decisions = assertAllPairsReplay(input);
    const second = decisions.find((d) => d.logIndex === 1)!;
    expect(second.label).toBe('Month 1 · Save $900/month');
    expect(second.alternatives[0]!.label).toContain('Keep saving $100/month');
    const first = decisions.find((d) => d.logIndex === 0)!;
    expect(first.alternatives[0]!.label).toContain('Keep saving $500/month');
    // Undoing the first keeps the second: the log still has one entry at month 1.
    expect(changedPolicyLog(config, s.policyLog, '0', 'undo').log).toEqual([s.policyLog[1]]);
  });

  it('a decision logged later than the finish horizon does not break listing or replay', () => {
    const config = archetypeConfig('young_family', 6, { durationMonths: 6 });
    let s = createGame(config);
    for (let m = 0; m < 6; m++) s = advanceMonth(s);
    const late: PolicyLogEntry = { monthIndex: 12, action: { type: 'set_budget', discretionaryMonthly: 50 } };
    const log = [...s.policyLog, late];
    const input = finishInput(config, s, log);
    expect(input.finishMonteCarlo.months).toBe(6);
    const decisions = assertAllPairsReplay(input);
    expect(decisions.some((d) => d.monthIndex === 12)).toBe(true);
    const r = runWhatIf({ ...input, decisionId: String(log.length - 1), alternativeId: 'undo' });
    expect(r.delta.median).toBe(0);
    expect(r.delta.yourEvents).toBe(0);
  });

  it('legacy policyLog entries without label/alternatives still list, label cleanly and replay', () => {
    const { config, state } = playRandom('young_family', { seed: 12, months: 12 });
    const legacy = state.policyLog.map(({ label: _l, alternatives: _a, ...rest }) => rest);
    expect(legacy.some((e) => e.action.type === 'apply_event_option' && e.resolvedEffect && e.resolvedEffect.template !== 'none')).toBe(true);
    const input = finishInput(config, state, legacy);
    const decisions = assertAllPairsReplay(input);
    const eventDecisions = decisions.filter((d) => d.logIndex !== null && legacy[d.logIndex]!.action.type === 'apply_event_option');
    expect(eventDecisions.length).toBeGreaterThan(0);
    for (const d of eventDecisions) {
      expect(d.label).toMatch(/Event choice: /);
      expect(d.alternatives.map((a) => a.id)).toEqual(['undo']);
    }
    // Entries whose resolved effect is 'none' or missing are not decisions.
    for (const d of decisions) if (d.logIndex !== null) expect(legacy[d.logIndex]!.resolvedEffect?.template ?? 'x').not.toBe('none');
  });

  it('random play: every (decision, alternative) pair yields a replayable log and clean labels', () => {
    for (const [archetype, seed] of [['college_student', 1], ['entry_worker', 2], ['professional', 3], ['young_family', 4]] as const) {
      const { config, state } = playRandom(archetype, { seed, months: 10 });
      const input = finishInput(config, state);
      const decisions = assertAllPairsReplay(input);
      expect(decisions[0]?.id).toBe('all');
      const ids = decisions.map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const d of decisions) expect(new Set(d.alternatives.map((a) => a.id)).size).toBe(d.alternatives.length);
    }
  }, 20_000); // four random plays plus every what-if replay: ~5 s alone, longer under the full suite

  it('changedPolicyLog never mutates the given log and rejects bad ids', () => {
    const { config, state } = playRandom('entry_worker', { seed: 7, months: 8 });
    const before = JSON.stringify(state.policyLog);
    for (const d of listDecisions(config, state.policyLog)) for (const a of d.alternatives) changedPolicyLog(config, state.policyLog, d.id, a.id);
    expect(JSON.stringify(state.policyLog)).toBe(before);
    for (const [d, a] of [['-1', 'undo'], ['1.5', 'undo'], ['abc', 'undo'], ['all', 'undo'], ['0', 'nope'], [String(state.policyLog.length), 'undo']]) {
      expect(() => changedPolicyLog(config, state.policyLog, d!, a!)).toThrow();
    }
  });

  it('what-if with an empty log lists only hypotheticals and "all/defaults" is a no-op', () => {
    const config = archetypeConfig('college_student', 2, { durationMonths: 6 });
    let s = createGame(config);
    for (let m = 0; m < 6; m++) s = advanceMonth(s);
    const input = finishInput(config, s);
    expect(listDecisions(config, []).every((d) => d.id.startsWith('hyp:'))).toBe(true);
    const r = runWhatIf(input);
    expect(r.delta).toEqual({ p10: 0, median: 0, p90: 0, yourEvents: 0, spread: 0 });
    expect(r.yourEventsComparable).toBe(true);
  });
});

describe('offers are not nagged twice', () => {
  it('enqueue_event records offered templates, the summary exposes them, and the offline generator never repeats an insurance offer', async () => {
    const { fallbackOpportunity } = await import('@/services/aiFallback');
    const { summarizeForAi } = await import('@/engine');
    const config = archetypeConfig('entry_worker', 5, { durationMonths: 12 });
    let s = createGame(config);
    s = advanceMonth(s);
    const planId = s.assumptions.insurancePlans.find((p) => p.line === 'health' && p.id !== s.insurance.health)!.id;
    const ev: GameEvent = { id: 'EVB_t_1', type: 'B', createdAtMonth: s.monthIndex, buildingTarget: 'hospital', source: 'fallback', title: 'Open enrollment', body: 'Switch plans?', options: [
      { id: 'a', label: 'Switch', description: 'd', effect: { template: 'change_insurance' as const, line: 'health' as const, planId } },
      { id: 'b', label: 'Keep', description: 'd', effect: { template: 'none' as const } },
    ] };
    const r = applyAction(s, { type: 'enqueue_event', event: ev });
    expect(r.ok).toBe(true);
    s = r.state;
    expect(s.offeredTemplates).toEqual(['change_insurance']);
    s = applyAction(s, { type: 'apply_event_option', eventId: ev.id, optionId: 'b' }).state;
    const summary = { ...summarizeForAi(s, ['insurance'], 'entry_worker'), recentShocks: ['medical' as const] };
    expect(summary.seenOffers).toEqual(['change_insurance']);
    for (let m = 0; m < 12; m++) {
      const p = fallbackOpportunity({ ...summary, monthIndex: m, insurance: { ...summary.insurance, health: null } });
      if (p) expect(p.options.every((o) => o.effect.template !== 'change_insurance')).toBe(true);
    }
  });
});
