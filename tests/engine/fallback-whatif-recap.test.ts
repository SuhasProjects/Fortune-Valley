import { describe, expect, it } from 'vitest';
import { fallbackRecap, fallbackWhatIf } from '@/services/aiFallback';
import { describeLogEntry, MAX_RECAP_LINES, summarizeTimeline } from '@/services/summarizeTimeline';
import { fixtureFinishedState, fixtureState } from '@/fixtures';
import { requestSchema as RecapRequestSchema } from '../../api/_lib/kinds/recap';
import { responseSchema as WhatIfResponseSchema } from '../../api/_lib/kinds/whatif';
import { responseSchema as RecapResponseSchema } from '../../api/_lib/kinds/recap';

const fmtWords = (t: string) => t.split(/\s+/).length;
const base = { decisionLabel: 'Save $300/month', alternativeLabel: 'Save half', original: { p10: 0, median: 0, p90: 0, yourEvents: 0 }, changed: { p10: 0, median: 0, p90: 0, yourEvents: 0 }, startNetWorth: 0, months: 24 };
const cmp = (median: number, spread: number) => ({ ...base, delta: { p10: 0, median, p90: 0, yourEvents: 0, spread } });

describe('fallbackWhatIf', () => {
  it('is one sentence of at most 18 words with no digits, for every sign combination', () => {
    const seen = new Set<string>();
    for (const median of [-500, 0, 500]) for (const spread of [-300, 0, 300]) {
      const t = fallbackWhatIf(cmp(median, spread));
      expect(t.split(/\s+/).length).toBeLessThanOrEqual(18);
      expect(t).not.toMatch(/\d/);
      expect(t.endsWith('.')).toBe(true);
      expect(WhatIfResponseSchema.safeParse({ text: t }).success).toBe(true);
      seen.add(t);
    }
    expect(seen.size).toBe(9);
  });
  it('reads direction from the signs', () => {
    expect(fallbackWhatIf(cmp(1000, -200))).toMatch(/grows.*hurt less/);
    expect(fallbackWhatIf(cmp(-1000, 200))).toMatch(/drops.*harder/);
    expect(fallbackWhatIf(cmp(0.2, -0.3))).toMatch(/about the same/);
  });
});

describe('summarizeTimeline', () => {
  it('fits the recap schema, sorts by month, and keeps at most 25 lines', () => {
    const r = summarizeTimeline(fixtureFinishedState);
    expect(RecapRequestSchema.safeParse({ kind: 'recap', recap: r }).success).toBe(true);
    expect(r.timeline.length).toBeLessThanOrEqual(MAX_RECAP_LINES);
    expect(r.timeline.map((l) => l.month)).toEqual([...r.timeline.map((l) => l.month)].sort((a, b) => a - b));
    expect(r.months).toBe(fixtureFinishedState.monthIndex);
    expect(r.startNetWorth).toBe(Math.round(fixtureFinishedState.netWorthHistory[0]!));
  });
  it('includes the player decisions and every realized shock with its out-of-pocket amount', () => {
    const r = summarizeTimeline(fixtureFinishedState);
    expect(r.timeline.some((l) => l.event.startsWith('Set the investment mix'))).toBe(true);
    expect(r.timeline.some((l) => l.event.startsWith('Set savings to $300'))).toBe(true);
    for (const { monthIndex, shock } of fixtureFinishedState.realizedShocks) {
      const line = r.timeline.find((l) => l.month === monthIndex && /^(Job loss|Medical bill|Car repair|Home repair)/.test(l.event));
      if (fixtureFinishedState.realizedShocks.length <= MAX_RECAP_LINES) expect(line).toBeTruthy();
      if (line && shock.kind !== 'job_loss') expect(line.amount).toBe(Math.round(shock.outOfPocket));
    }
    expect(r.timeline.every((l) => /^\d{4}-\d{2}$/.test(l.label))).toBe(true);
  });
  it('describes every action type or returns null for bookkeeping', () => {
    expect(describeLogEntry({ monthIndex: 0, action: { type: 'set_budget', discretionaryMonthly: 350 } })).toEqual({ event: 'Set lifestyle spending to $350 a month', amount: 350 });
    expect(describeLogEntry({ monthIndex: 0, action: { type: 'set_insurance', line: 'health', planId: null } })).toEqual({ event: 'Dropped health insurance' });
    expect(describeLogEntry({ monthIndex: 0, action: { type: 'apply_event_option', eventId: 'e', optionId: 'o' }, label: 'Lease renewal: Stay' })).toEqual({ event: 'Chose "Lease renewal: Stay"' });
    expect(describeLogEntry({ monthIndex: 0, action: { type: 'pause' } })).toBeNull();
  });
});

describe('fallbackRecap', () => {
  it('is three past-tense sentences of at most 60 words with no exclamation marks, from the finished fixture', () => {
    const t = fallbackRecap(summarizeTimeline(fixtureFinishedState));
    expect((t.match(/\.(\s|$)/g) ?? []).length).toBe(3);
    expect(t.split(/\s+/).length).toBeLessThanOrEqual(60);
    expect(t).not.toContain('!');
    expect(t).not.toMatch(/journey|resilient|navigate/i);
    expect(RecapResponseSchema.safeParse({ text: t }).success).toBe(true);
    expect(t).toMatch(/^The run opened at -?\$[\d,]+, and in [A-Z][a-z]+ \d{4} the player set the investment mix\./);
    expect(t).toMatch(/A job loss in May 2026 cut pay to benefits, and a medical bill in November 2026 cost \$6,221 out of pocket; 3 more hard months followed\./);
    expect(t).toMatch(/After \d+ months the run ended at/);
  });
  it('handles a run with no decisions and no shocks', () => {
    const t = fallbackRecap({ months: 12, startNetWorth: 1000, endNetWorth: 1000, timeline: [] });
    expect(t).toContain('default plan left unchanged');
    expect(fmtWords(t)).toBeLessThanOrEqual(60);
    expect(t).toContain('No shock landed in 12 months');
    expect(t).toContain('level with the start');
  });
  it('mentions the mid-game state shocks when present', () => {
    const r = summarizeTimeline(fixtureState);
    const t = fallbackRecap(r);
    expect((t.match(/\.(\s|$)/g) ?? []).length).toBe(3);
    if (r.timeline.some((l) => l.event.startsWith('Job loss'))) expect(t).toMatch(/job loss/i);
  });
});
