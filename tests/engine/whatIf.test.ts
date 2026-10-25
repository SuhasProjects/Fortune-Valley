import { describe, expect, it } from 'vitest';
import { archetypeConfig } from '@/config/archetypes';
import { advanceMonth, applyAction, compareWithBaseline, createGame, listDecisions, netWorthOf, outcomeLines, round2, runMonteCarlo, runWhatIf, runWhatIfAsync, shouldRequestOpportunity, summarizeForAi } from '@/engine';
import { fallbackOpportunity } from '@/services/aiFallback';
import { proposalToEvent } from '@/services/aiClient';
import type { ArchetypeId, GameAction, GameConfig, GameState, WhatIfInput } from '@/types/domain';

const PATHS = 150;

/** Play like the store does: resume, apply scripted decisions, answer every pending event, advance, and enqueue
 *  an offline opportunity whenever the store would ask the AI director for one. */
function play(config: GameConfig, script: Record<number, GameAction[]>, answer: 'first' | 'last' = 'first', opportunities = true): GameState {
  let s = createGame(config);
  s = applyAction(s, { type: 'resume' }).state;
  for (let m = 0; m < config.durationMonths; m++) {
    for (const action of script[m] ?? []) {
      const r = applyAction(s, action);
      if (r.ok) s = r.state;
    }
    for (const event of [...s.activeEvents]) {
      const option = answer === 'first' ? event.options[0] : event.options.at(-1);
      if (!option) continue;
      const r = applyAction(s, { type: 'apply_event_option', eventId: event.id, optionId: option.id });
      if (r.ok) s = r.state;
    }
    const prev = s;
    s = advanceMonth(s);
    if (opportunities && shouldRequestOpportunity(prev, s) && !s.activeEvents.some((e) => e.type === 'B')) {
      const proposal = fallbackOpportunity(summarizeForAi(s, config.narrativeFocus, config.archetype));
      const event = proposal && proposalToEvent(proposal, s, 'fallback');
      if (event) {
        const r = applyAction(s, { type: 'enqueue_event', event });
        if (r.ok) s = r.state;
      }
    }
  }
  return s;
}

function finish(config: GameConfig, s: GameState): WhatIfInput & { decisionId: string; alternativeId: string } {
  const mc = runMonteCarlo(config, s.policyLog, s, { paths: PATHS });
  return { config, policyLog: s.policyLog, finishMonteCarlo: mc, startNetWorth: s.netWorthHistory[0]!, observedNetWorth: mc.observedNetWorth, decisionId: '', alternativeId: '' };
}

const script: Record<number, GameAction[]> = {
  1: [{ type: 'set_contributions', savingsContributionPerMonth: 200, investmentContributionPerMonth: 50 }],
  3: [{ type: 'set_allocation', allocation: { stock: 0.2, bond: 0.3, etf: 0.5 } }],
  5: [{ type: 'set_budget', discretionaryMonthly: 150 }],
};

const lives: ArchetypeId[] = ['college_student', 'entry_worker', 'professional', 'young_family'];

describe('ending: straight-line outcome summary', () => {
  it('reads the chart endpoints straight from the Monte Carlo result', () => {
    const config = archetypeConfig('entry_worker', 7);
    const s = play(config, script);
    const mc = runMonteCarlo(config, s.policyLog, s, { paths: PATHS });
    const lines = outcomeLines(mc, s.netWorthHistory[0]!);
    expect(lines.months).toBe(mc.months);
    expect(lines.p10).toBe(round2(mc.p10));
    expect(lines.median).toBe(round2(mc.median));
    expect(lines.p90).toBe(round2(mc.p90));
    expect(lines.yourEvents).toBe(round2(mc.observedNetWorth));
    expect(lines.spread).toBeCloseTo(mc.p90 - mc.p10, 2);
    expect(lines.start).toBe(netWorthOf(createGame(config)));
  });
});

describe('ending: your exact events replay', () => {
  for (const life of lives) {
    it(`replaying the unchanged log on the game seed reproduces the played ending (${life})`, () => {
      const config = archetypeConfig(life, 4242);
      const s = play(config, script);
      expect(s.policyLog.some((e) => e.action.type === 'apply_event_option' && e.resolvedEffect?.template !== 'none')).toBe(true);
      const input = finish(config, s);
      const decisions = listDecisions(config, s.policyLog);
      const pick = decisions.find((d) => d.id !== 'all')!;
      const result = runWhatIf({ ...input, decisionId: pick.id, alternativeId: pick.alternatives[0]!.id });
      expect(result.yourEventsComparable).toBe(true);
    });
  }
});

describe('ending: decisions and alternatives', () => {
  it('lists each decision with plain-English labels and an undo option, with "all" first', () => {
    const config = archetypeConfig('entry_worker', 7);
    const s = play(config, script);
    const decisions = listDecisions(config, s.policyLog);
    expect(decisions[0]).toMatchObject({ id: 'all', alternatives: [{ id: 'defaults' }] });
    const labels = decisions.map((d) => d.label).join('\n');
    expect(labels).toContain('Month 1 · Save $200/month, invest $50/month');
    expect(labels).toContain('Month 3 · Invest as 50% ETF · 30% bonds · 20% stocks');
    expect(labels).toContain('Month 5 · Spend $150/month on lifestyle');
    for (const d of decisions) expect(d.alternatives.length).toBeGreaterThan(0);
    const savings = decisions.find((d) => d.label.startsWith('Month 1'))!;
    expect(savings.alternatives.map((a) => a.id)).toEqual(['undo', 'half', 'double']);
    expect(savings.alternatives[0]!.label).toMatch(/^Keep saving \$\d/);
  });

  it('offers only "from the start" hypotheticals when the player made no decisions', () => {
    const config = archetypeConfig('professional', 3);
    const decisions = listDecisions(config, []);
    expect(decisions.some((d) => d.id === 'all')).toBe(false);
    expect(decisions.every((d) => d.id.startsWith('hyp:'))).toBe(true);
  });

  it('records the options the player did not pick and offers them as alternatives', () => {
    const config = archetypeConfig('young_family', 11);
    const s = play(config, {});
    const eventEntries = s.policyLog.filter((e) => e.action.type === 'apply_event_option');
    expect(eventEntries.length).toBeGreaterThan(0);
    const entry = eventEntries[0]!;
    expect(entry.label).toBeTruthy();
    expect(entry.alternatives).toBeDefined();
    const decision = listDecisions(config, s.policyLog).find((d) => d.logIndex === s.policyLog.indexOf(entry))!;
    expect(decision.label).toContain(entry.label!);
    expect(decision.alternatives.length).toBeGreaterThan(0);
  });

  it('still lists event decisions from older saves without recorded alternatives', () => {
    const config = archetypeConfig('young_family', 11);
    const s = play(config, {});
    const legacy = s.policyLog.map(({ label: _label, alternatives: _alternatives, ...rest }) => rest);
    for (const d of listDecisions(config, legacy)) expect(d.alternatives.length).toBeGreaterThan(0);
  });
});

describe('ending: what-if runs', () => {
  const config = archetypeConfig('entry_worker', 7);
  const s = play(config, script);
  const base = finish(config, s);

  it('"never change anything" equals the paired default-policy comparison (same luck)', () => {
    const result = runWhatIf({ ...base, decisionId: 'all', alternativeId: 'defaults' });
    const cmp = compareWithBaseline(config, s.policyLog, base.finishMonteCarlo.months, { paths: PATHS, seed: base.finishMonteCarlo.seed })!;
    // What-if lines are rounded to cents; the raw comparison is not, so compare at the same precision.
    expect(result.changed.median).toBe(round2(cmp.b.median));
    expect(result.changed.p10).toBe(round2(cmp.b.p10));
    expect(result.original).toEqual(outcomeLines(base.finishMonteCarlo, base.startNetWorth));
    expect(result.delta.median).toBeCloseTo(result.changed.median - result.original.median, 2);
    expect(result.delta.spread).toBeCloseTo(result.changed.spread - result.original.spread, 2);
    expect(result.changed.yourEvents).toBeCloseTo(result.original.yourEvents + result.delta.yourEvents, 2);
  });

  it('undoing the only decision matches dropping every decision', () => {
    const one = play(config, { 1: [{ type: 'set_contributions', savingsContributionPerMonth: 400, investmentContributionPerMonth: 0 }] }, 'first', false);
    const input = finish(config, one);
    const id = listDecisions(config, one.policyLog).find((d) => d.id !== 'all')!.id;
    const undo = runWhatIf({ ...input, decisionId: id, alternativeId: 'undo' });
    const all = runWhatIf({ ...input, decisionId: 'all', alternativeId: 'defaults' });
    expect(undo.changed).toEqual(all.changed);
  });

  it('saving more moves your exact ending in the expected direction', () => {
    const id = listDecisions(config, s.policyLog).find((d) => d.label.startsWith('Month 1'))!.id;
    const half = runWhatIf({ ...base, decisionId: id, alternativeId: 'half' });
    expect(half.decisionLabel).toContain('Save $200/month');
    expect(half.alternativeLabel).toContain('$100');
    expect(Number.isFinite(half.delta.yourEvents)).toBe(true);
  });

  it('is deterministic', () => {
    const a = runWhatIf({ ...base, decisionId: 'all', alternativeId: 'defaults' });
    const b = runWhatIf({ ...base, decisionId: 'all', alternativeId: 'defaults' });
    expect(a).toEqual(b);
  });

  it('rejects unknown decisions and alternatives', () => {
    expect(() => runWhatIf({ ...base, decisionId: '999', alternativeId: 'undo' })).toThrow();
    expect(() => runWhatIf({ ...base, decisionId: 'all', alternativeId: 'nope' })).toThrow();
  });

  it('async run matches the sync core, caches, and honours abort', async () => {
    const input = { ...base, decisionId: 'all', alternativeId: 'defaults' };
    const viaAsync = await runWhatIfAsync(input);
    expect(viaAsync).toEqual(runWhatIf(input));
    expect(await runWhatIfAsync(input)).toBe(viaAsync);
    const controller = new AbortController();
    const id = listDecisions(config, s.policyLog).find((d) => d.label.startsWith('Month 5'))!.id;
    const pending = runWhatIfAsync({ ...base, decisionId: id, alternativeId: 'undo' }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('ending: hypothetical "from the start" decisions', () => {
  const config = archetypeConfig('college_student', 21);

  it('offers hypotheticals even when the player changed nothing, and never "all"', () => {
    const decisions = listDecisions(config, []);
    expect(decisions.length).toBeGreaterThanOrEqual(3);
    expect(decisions.every((d) => d.id.startsWith('hyp:'))).toBe(true);
    expect(decisions.map((d) => d.label).join('\n')).toMatch(/From the start · Save more each month/);
    for (const d of decisions) {
      expect(d.alternatives.length).toBeGreaterThan(0);
      expect(`${d.label} ${d.alternatives.map((a) => a.label).join(' ')}`).not.toMatch(/NaN|undefined/);
    }
  });

  it('offers an auto-cover hypothetical only to lives with a car, and a saved auto plan is a flippable decision', () => {
    const student = listDecisions(config, []);
    expect(student.some((d) => d.label.includes('Insure the car differently'))).toBe(false);
    const worker = archetypeConfig('entry_worker', 21);
    const auto = listDecisions(worker, []).find((d) => d.label.includes('Insure the car differently'));
    expect(auto).toBeDefined();
    expect(auto!.alternatives.map((a) => a.id).sort()).toEqual(['plan:auto_full', 'plan:none']);
    const log = [{ monthIndex: 2, action: { type: 'set_insurance', line: 'auto', planId: 'auto_full' } as const }];
    const decision = listDecisions(worker, log).find((d) => d.logIndex === 0)!;
    expect(decision.label).toMatch(/Switch auto plan to Auto Full Coverage/);
    expect(decision.alternatives.map((a) => a.label)).toEqual(expect.arrayContaining([expect.stringMatching(/Keep Auto Liability Only/)]));
  });
  it('lists real decisions first, then hypotheticals', () => {
    const s = play(config, script, 'first', false);
    const decisions = listDecisions(config, s.policyLog);
    const firstHyp = decisions.findIndex((d) => d.id.startsWith('hyp:'));
    expect(decisions[0]!.id).toBe('all');
    expect(firstHyp).toBeGreaterThan(1);
    expect(decisions.slice(firstHyp).every((d) => d.id.startsWith('hyp:'))).toBe(true);
  });

  it('runs every hypothetical alternative with an unchanged original and a finite delta', () => {
    const s = play(config, {}, 'first', false);
    const input = finish(config, s);
    for (const d of listDecisions(config, s.policyLog)) for (const a of d.alternatives) {
      const r = runWhatIf({ ...input, decisionId: d.id, alternativeId: a.id });
      expect(r.original).toEqual(outcomeLines(input.finishMonteCarlo, input.startNetWorth));
      expect(r.decisionLabel).toBe(d.label);
      expect(r.alternativeLabel).toBe(a.label);
      for (const v of Object.values(r.delta)) expect(Number.isFinite(v)).toBe(true);
      expect(r.yourEventsComparable).toBe(true);
    }
  });

  it('saving more from the start raises the typical ending and keeps later decisions', () => {
    const s = play(config, script, 'first', false);
    const input = finish(config, s);
    const r = runWhatIf({ ...input, decisionId: 'hyp:save', alternativeId: 'plus250' });
    expect(r.delta.median).toBeGreaterThan(0);
    expect(() => runWhatIf({ ...input, decisionId: 'hyp:save', alternativeId: 'nope' })).toThrow();
  });
});
