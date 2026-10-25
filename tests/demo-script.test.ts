// OWNER: Agent 1. The /demo scripted run: events land on their months, the exclusive script silences random rolls,
// the config validates, the what-if "kept the Plus plan" branch beats the switch, and the Sage explains premiums.
import { describe, expect, it } from 'vitest';
import { advanceMonth, createGame, netWorthOf, applyAction, validateConfig, runMonteCarlo, listDecisions, changedPolicyLog, runWhatIf } from '@/engine';
import { replayPath } from '@/engine/monteCarlo';
import { settleClaim } from '@/engine/events';
import { demoConfig, DEMO_SEED } from '@/demo/demoMode';
import { fallbackCoach } from '@/services/coachFallback';
import { summarizeForAi } from '@/engine';
import { INSURANCE_PLANS } from '@/config/defaults';
import type { GameState, PolicyLogEntry } from '@/types/domain';

const playThrough = (months: number, log: PolicyLogEntry[] = []): GameState => {
  let s = createGame(demoConfig());
  for (let m = 0; m < months; m++) {
    for (const e of log) if (e.monthIndex === m) { const r = applyAction(s, e.action); if (r.ok) s = r.state; }
    s = advanceMonth(s);
  }
  return s;
};

describe('demo config', () => {
  it('validates, has no car, ~$50k of debt, a $30k job, $340 rent and starts on Plus Health', () => {
    const c = demoConfig();
    expect(validateConfig(c).ok).toBe(true);
    expect(c.seed).toBe(DEMO_SEED);
    expect(c.durationMonths).toBe(12);
    expect(c.initialState.car?.owned).toBe(false);
    expect(c.initialState.insurance.auto).toBeNull();
    expect(c.initialState.debts.reduce((a, d) => a + d.balance, 0)).toBe(50000);
    expect(c.initialState.employment.grossAnnualSalary).toBe(30000);
    expect(c.initialState.household.housingMonthly).toBe(340);
    expect(c.initialState.insurance.health).toBe('health_plus');
    expect(INSURANCE_PLANS.find((p) => p.id === 'health_plus')?.monthlyPremium).toBe(340);
    expect(c.script?.exclusive).toBe('played');
  });
});

describe('scripted events', () => {
  it('land exactly on their months with the scripted amounts, and nothing random fires', () => {
    const s = playThrough(12);
    const life = s.lifeEvents.map((e) => [e.monthIndex, e.amountSigned, e.templateId]);
    expect(life).toEqual([
      [6, -180, 'scripted:college textbooks'],
      [8, 200, 'scripted:birthday gift from your grandma'],
      [9, -150, 'scripted:parking ticket'],
      [11, 150, 'scripted:credit card cashback'],
    ]);
    expect(s.realizedShocks.map((r) => [r.monthIndex, r.shock.kind, r.shock.grossCost])).toEqual([[5, 'medical', 20000]]);
    expect(s.employment.status).toBe('employed');
    expect(s.employment.grossAnnualSalary).toBe(30000); // no raises in the demo
    // Every notice of the run is one of the five scripted happenings (one bill, four small); nothing random, no raise, no offer.
    const unscripted = s.notifications.filter((n) => !n.shockKind);
    expect(unscripted.map((n) => n.summary)).toEqual([]);
    expect(s.notifications).toHaveLength(5);
    // Each one carries its final wording from the script, so the toast never shows a placeholder or asks the model.
    expect(s.notifications.every((n) => n.flavour?.scene && n.flavour.headline)).toBe(true);
    expect(s.notifications.find((n) => n.shockKind === 'medical')?.flavour?.scene).toMatch(/\$20,000/);
    expect(s.notifications.filter((n) => n.shockKind === 'job_loss')).toHaveLength(0);
    // The hospital claim settled with the Plus plan the run starts on.
    const er = s.realizedShocks[0]!.shock;
    expect(er.planId).toBe('health_plus');
    expect(er.outOfPocket).toBe(settleClaim(20000, INSURANCE_PLANS.find((p) => p.id === 'health_plus')!).outOfPocket);
    // The scripted life events carry their own scene so the toast needs no AI call.
    const grandma = s.notifications.find((n) => n.templateId === 'scripted:birthday gift from your grandma');
    expect(grandma?.flavour?.scene).toMatch(/grandmother/);
    expect(grandma?.summary).toBe('Birthday gift from your grandma: $200');
  });

  it('a run without a script still rolls randomly (the script is opt-in)', () => {
    const plain = { ...demoConfig(), script: undefined };
    let s = createGame(plain);
    for (let m = 0; m < 12; m++) s = advanceMonth(s);
    expect(s.lifeEvents.some((e) => e.templateId?.startsWith('scripted:'))).toBe(false);
  });

  it('simulated futures keep the scripted life events but roll their own hospital luck instead of the scripted bills', () => {
    const c = demoConfig();
    let s = createGame(c);
    for (let m = 0; m < 12; m++) s = advanceMonth(s, { lean: true, inPlace: true });
    expect(s.lifeEvents.map((e) => e.monthIndex)).toEqual([6, 8, 9, 11]);
    expect(s.realizedShocks.some((r) => r.monthIndex === 5 && r.shock.grossCost === 20000)).toBe(false);
    const mc = runMonteCarlo(c, [], playThrough(12), { paths: 8 });
    expect(mc.endingNetWorths).toHaveLength(8);
  });

  it('the reveal tells the lesson: Basic earns more typically but swings about twice as wide, and the played run sits around the 10th–20th percentile', () => {
    const c = demoConfig();
    const played = playThrough(12, [{ monthIndex: 3, action: { type: 'set_insurance', line: 'health', planId: 'health_basic' } }]);
    const basic = runMonteCarlo(c, played.policyLog, played, { paths: 800 });
    const plus = runMonteCarlo(c, [], played, { paths: 800 });
    expect(basic.median).toBeGreaterThan(plus.median);
    expect(basic.median - plus.median).toBeLessThan(3000);
    const widthBasic = basic.p90 - basic.p10, widthPlus = plus.p90 - plus.p10;
    expect(widthBasic / widthPlus, `band ratio ${(widthBasic / widthPlus).toFixed(2)}`).toBeGreaterThan(1.5); // the plans' out-of-pocket caps ($8,000 vs $4,000) bound the ratio near 2× over a year
    expect(basic.percentileOfObserved, 'played run is a bit unlucky').toBeGreaterThan(0.05);
    expect(basic.percentileOfObserved).toBeLessThan(0.3);
  });
});

describe('what-if: switching to the cheap plan early', () => {
  const switchEarly: PolicyLogEntry[] = [{ monthIndex: 3, action: { type: 'set_insurance', line: 'health', planId: 'health_basic' } }];

  it('lists the insurance decision with "keep Plus" as the alternative, and keeping Plus ends richer after the emergency', () => {
    const c = demoConfig();
    const played = playThrough(12, switchEarly);
    const decisions = listDecisions(c, played.policyLog);
    const d = decisions.find((x) => /health plan/i.test(x.label));
    expect(d, 'insurance decision listed').toBeTruthy();
    const keep = d!.alternatives.find((a) => /Plus Health/.test(a.label));
    expect(keep, 'alternative keeps the Plus plan').toBeTruthy();
    const { log } = changedPolicyLog(c, played.policyLog, d!.id, keep!.id);
    expect(log.some((e) => e.action.type === 'set_insurance')).toBe(false); // "keep Plus" = the switch dropped from the log
    // On the player's own two hospital bills, keeping Plus would have ended richer (the simulated futures tell the wider story).
    expect(netWorthOf(playThrough(12))).toBeGreaterThan(netWorthOf(played));
    expect(replayPath(c, played.policyLog, DEMO_SEED, 12).history).toHaveLength(13);
  });
});

describe('what-if replay of the player\'s own game', () => {
  it('keeps the scripted bill: with Basic from month 3, "kept Plus" ends at least $2,000 richer and the what-if says so', () => {
    const c = demoConfig();
    const switched: PolicyLogEntry[] = [{ monthIndex: 3, action: { type: 'set_insurance', line: 'health', planId: 'health_basic' } }];
    const played = playThrough(12, switched);
    const basic = replayPath(c, played.policyLog, DEMO_SEED, 12, { asPlayed: true }).ending;
    const plus = replayPath(c, [], DEMO_SEED, 12, { asPlayed: true }).ending;
    expect(basic).toBeCloseTo(netWorthOf(played), 0);
    expect(plus - basic).toBeGreaterThanOrEqual(2000);
    const mc = runMonteCarlo(c, played.policyLog, played, { paths: 200 });
    const d = listDecisions(c, played.policyLog).find((x) => /health plan/i.test(x.label))!;
    const keep = d.alternatives.find((a) => /Plus Health/.test(a.label))!;
    const r = runWhatIf({ config: c, policyLog: played.policyLog, finishMonteCarlo: mc, startNetWorth: netWorthOf(createGame(c)), observedNetWorth: netWorthOf(played), decisionId: d.id, alternativeId: keep.id });
    expect(r.yourEventsComparable).toBe(true);
    expect(r.delta.yourEvents).toBeGreaterThanOrEqual(2000);
    expect(r.delta.median).toBeLessThan(0); // typical future on Plus is a little lower …
    expect(r.delta.spread).toBeLessThan(0); // … but much narrower
  });
});

describe('the Sage on insurance', () => {
  it('explains premium, deductible and coinsurance with both health plans and the trade-off', () => {
    const s = createGame(demoConfig());
    const text = fallbackCoach(summarizeForAi(s, ['insurance'], 'entry_worker'), 'What is the difference between the health insurance plans?', 'hospital');
    expect(text).toMatch(/premium/i);
    expect(text).toMatch(/deductible/i);
    expect(text).toMatch(/\$180 a month/);
    expect(text).toMatch(/\$340 a month/);
    expect(text).toMatch(/\$160 a month/);
    expect(text.split(/[.!?]\s/).length).toBeLessThanOrEqual(9);
  });
});
