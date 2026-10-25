/**
 * Life events: small uninsured costs and gifts on their own RNG stream. Incidence ≈ 0.45/month,
 * signs paired so a run nets within ±$100, replay-deterministic, present in Monte Carlo paths
 * without moving the median, and never mistaken for a decision.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS, DEFAULT_LIFE_EVENTS } from '@/config/defaults';
import { advanceMonth, createGame, listDecisions, runMonteCarlo } from '@/engine';
import { lifeEventNet, rollLifeEvent } from '@/engine/events';
import { monthRng } from '@/engine/rng';
import { scenarios } from '@/data/scenarios';
import { fallbackRecap } from '@/services/aiFallback';
import { LIFE_COST_TABLE, LIFE_GIFT_TABLE, lifeRows, pickFlavour } from '@/services/flavourTable';
import { MAX_RECAP_LIFE_EVENTS, summarizeTimeline } from '@/services/summarizeTimeline';
import type { GameConfig, GameState } from '@/types/domain';

const base = (): GameConfig => structuredClone(scenarios[1]!);
const withSeed = (seed: number, months = 24): GameConfig => ({ ...base(), seed, durationMonths: months });
const play = (config: GameConfig): GameState => {
  let s = createGame(config);
  while (s.status !== 'finished') s = advanceMonth(s);
  return s;
};

describe('life events: engine', () => {
  it('insured shocks are more frequent than before (play and Monte Carlo share this config)', () => {
    const by = Object.fromEntries(DEFAULT_ASSUMPTIONS.shocks.map((s) => [s.kind, s]));
    expect(by.medical!.monthlyIncidence).toBe(0.04);
    expect(by.auto!.monthlyIncidence).toBe(0.035);
    expect(by.home!.monthlyIncidence).toBe(0.015);
    expect(DEFAULT_ASSUMPTIONS.employment.jobLossMonthlyIncidence).toBe(0.009);
    expect(by.medical!.costMedian).toBe(2500);
    expect(by.auto!.costMedian).toBe(1200);
    expect(by.home!.costMedian).toBe(1500);
    expect(DEFAULT_ASSUMPTIONS.lifeEvents).toEqual(DEFAULT_LIFE_EVENTS);
  });

  it('incidence over 2,000 seeded months is about 0.45 and amounts stay in range', () => {
    let hits = 0;
    let min = Infinity;
    let max = 0;
    const s = createGame(withSeed(7));
    for (let i = 0; i < 2000; i++) {
      const before = s.lifeEvents.length;
      const ev = rollLifeEvent(s, monthRng(1234, i, 'life'), true);
      if (ev) {
        hits += 1;
        expect(s.lifeEvents.length).toBe(before + 1);
        min = Math.min(min, Math.abs(ev.amountSigned));
        max = Math.max(max, Math.abs(ev.amountSigned));
        expect(Math.abs(lifeEventNet(s))).toBeLessThanOrEqual(DEFAULT_LIFE_EVENTS.netCap);
      }
    }
    const incidence = hits / 2000;
    expect(incidence).toBeGreaterThan(0.4);
    expect(incidence).toBeLessThan(0.5);
    expect(min).toBeGreaterThanOrEqual(DEFAULT_LIFE_EVENTS.amountMin);
    expect(max).toBeLessThanOrEqual(DEFAULT_LIFE_EVENTS.amountMax);
  });

  it('nets to within ±$100 over 200 seeded 24-month runs, with both gifts and costs', () => {
    let gifts = 0;
    let costs = 0;
    let total = 0;
    let events = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = play(withSeed(seed));
      const net = lifeEventNet(s);
      expect(Math.abs(net)).toBeLessThanOrEqual(100);
      total += net;
      events += s.lifeEvents.length;
      for (const e of s.lifeEvents) { if (e.amountSigned > 0) gifts += 1; else costs += 1; }
      const ledgerNet = s.ledger.filter((l) => l.category === 'life_event').reduce((a, l) => a + l.amountSigned, 0);
      expect(ledgerNet).toBeCloseTo(net, 2);
    }
    expect(gifts).toBeGreaterThan(0);
    expect(costs).toBeGreaterThan(0);
    expect(Math.abs(total / 200)).toBeLessThan(40); // expected net ≈ 0
    expect(events / 200 / 24).toBeGreaterThan(0.4);
  });

  it('replays deterministically: same seed → same life events, and the notification/timeline carry them', () => {
    const a = play(withSeed(42));
    const b = play(withSeed(42));
    expect(a.lifeEvents).toEqual(b.lifeEvents);
    expect(a.lifeEvents.length).toBeGreaterThan(0);
    for (const e of a.lifeEvents) {
      const note = a.notifications.find((n) => n.eventId === e.eventId)!;
      expect(note.shockKind).toBe('life');
      expect(note.amountSigned).toBe(e.amountSigned);
      expect(note.kind).toBe(e.amountSigned > 0 ? 'positive' : 'negative');
      const t = a.timeline.find((x) => x.eventId === e.eventId)!;
      expect(t.type).toBe('shock');
      expect(t.description).toMatch(e.amountSigned > 0 ? /^Small gift/ : /^Small cost/);
    }
    expect(a.realizedShocks.some((r) => (r.shock.kind as string) === 'life')).toBe(false);
  });

  it('uses its own stream: the shock stream draws are unchanged with life events disabled', () => {
    const on = play(withSeed(99));
    const offConfig = withSeed(99);
    offConfig.assumptions = { ...offConfig.assumptions, lifeEvents: { ...DEFAULT_LIFE_EVENTS, monthlyIncidence: 0 } };
    const off = play(offConfig);
    expect(off.lifeEvents).toEqual([]);
    expect(on.realizedShocks.map((r) => [r.monthIndex, r.shock.kind, r.shock.grossCost])).toEqual(off.realizedShocks.map((r) => [r.monthIndex, r.shock.kind, r.shock.grossCost]));
    expect(on.marketState.index).toEqual(off.marketState.index);
    // Net worth differs only by the life-event net (cash in, cash out; no insurance, no interest beyond a cent of rounding on contributions).
    const nwOn = on.netWorthHistory[on.monthIndex]!;
    const nwOff = off.netWorthHistory[off.monthIndex]!;
    expect(Math.abs(nwOn - nwOff - lifeEventNet(on))).toBeLessThan(150);
  });

  it('Monte Carlo paths include life events and the median shifts by less than $150 when they are disabled', () => {
    const config = withSeed(5);
    const s = play(config);
    const mc = runMonteCarlo(config, s.policyLog, s, { paths: 300 });
    const offConfig = { ...config, assumptions: { ...config.assumptions, lifeEvents: { ...DEFAULT_LIFE_EVENTS, monthlyIncidence: 0 } } };
    const mcOff = runMonteCarlo(offConfig, s.policyLog, { ...s, assumptions: offConfig.assumptions }, { paths: 300 });
    expect(Math.abs(mc.median - mcOff.median)).toBeLessThan(150);
    expect(mc.pathsCompleted).toBe(300);
    // A lean path still records life events (needed for the net cap).
    const lean = createGame(config);
    let p: GameState = lean;
    for (let m = 0; m < 24; m++) p = advanceMonth(p, { lean: true, inPlace: true });
    expect(p.lifeEvents.length).toBeGreaterThan(0);
    expect(p.ledger.length).toBe(0);
  });

  it('a cost that overdraws cash uses the normal shortfall order; cash can dip', () => {
    const s = createGame(withSeed(3));
    s.cash = 5;
    s.savings = 1000;
    s.policy = { ...s.policy, emergencyFundingOrder: ['savings', 'investments', 'borrow'] };
    // Find a stream that yields a cost.
    for (let i = 0; i < 200; i++) {
      const before = s.lifeEvents.length;
      const ev = rollLifeEvent(s, monthRng(77, i, 'life'), false);
      if (ev && ev.amountSigned < 0) {
        expect(s.lifeEvents.length).toBe(before + 1);
        expect(s.cash).toBeGreaterThanOrEqual(0);
        expect(s.savings).toBeLessThan(1000);
        return;
      }
    }
    throw new Error('no cost drawn');
  });
});

describe('life events: recap, what-if, flavour', () => {
  it('summarizeTimeline includes at most the two largest life events; listDecisions ignores them', () => {
    const s = play(withSeed(42));
    const r = summarizeTimeline(s);
    const lines = r.timeline.filter((l) => /^Small (gift|unplanned cost)/.test(l.event));
    expect(lines.length).toBeLessThanOrEqual(MAX_RECAP_LIFE_EVENTS);
    expect(lines.length).toBe(Math.min(MAX_RECAP_LIFE_EVENTS, s.lifeEvents.length));
    const largest = [...s.lifeEvents].sort((a, b) => Math.abs(b.amountSigned) - Math.abs(a.amountSigned))[0]!;
    expect(lines.some((l) => l.amount === Math.round(largest.amountSigned))).toBe(true);
    const text = fallbackRecap(r);
    expect(text.split(/(?<=\.)\s+/).length).toBe(3);
    expect(text).toMatch(/gift came in|cost went out/);
    // Life events are luck, not decisions: nothing in the what-if list points at a log entry.
    expect(listDecisions(withSeed(42), s.policyLog).filter((d) => d.logIndex !== null)).toEqual([]);
  });

  it('offline table: ≥ 8 cost and ≥ 8 gift scenes, second person, ≤ 32 words, no "!", archetype-aware pick', () => {
    const words = (x: string) => x.trim().split(/\s+/).length;
    expect(LIFE_COST_TABLE.length).toBeGreaterThanOrEqual(8);
    expect(LIFE_GIFT_TABLE.length).toBeGreaterThanOrEqual(8);
    for (const row of [...LIFE_COST_TABLE, ...LIFE_GIFT_TABLE]) {
      expect(row.scene).toContain('{amount}');
      expect(row.scene).not.toContain('!');
      expect(row.headline).not.toContain('!');
      expect(words(row.scene.replace('{amount}', '$120'))).toBeLessThanOrEqual(32);
      expect(row.scene).toMatch(/\b(you|your)\b/i);
      expect(row.scene).toMatch(/\.$/);
      expect(words(row.headline)).toBeLessThanOrEqual(5);
    }
    expect(lifeRows(-50, 'college_student').some((r) => r.fit?.includes('college_student'))).toBe(true);
    expect(lifeRows(-50, 'college_student').some((r) => r.fit?.includes('young_family'))).toBe(false);
    expect(lifeRows(50).every((r) => !r.fit)).toBe(true);
    const gift = pickFlavour({ kind: 'life', amount: 120, monthLabel: '2026-11', archetype: 'young_family', housingKind: 'rent', hasCar: false, employment: 'employed' }, 'N_1');
    expect(gift.scene).toContain('$120');
    expect(LIFE_GIFT_TABLE.some((r) => r.headline === gift.headline)).toBe(true);
    const cost = pickFlavour({ kind: 'life', amount: -45, monthLabel: '2026-11', housingKind: 'rent', hasCar: false, employment: 'employed' }, 'N_1');
    expect(cost.scene).toContain('$45');
    expect(cost.scene).not.toContain('-');
    expect(LIFE_COST_TABLE.some((r) => r.headline === cost.headline)).toBe(true);
    expect(pickFlavour({ kind: 'life', amount: -45, monthLabel: '2026-11', housingKind: 'rent', hasCar: false, employment: 'employed' }, 'N_1')).toEqual(cost);
  });
});
