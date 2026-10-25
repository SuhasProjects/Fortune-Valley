import { describe, expect, it } from 'vitest';
import { advanceMonth, applyAction, createGame } from '@/engine';
import { scenarios } from '@/data/scenarios';

const OD = 'Paid off Overdraft / emergency credit line';
const overdraftBalance = (s: ReturnType<typeof createGame>) => s.debts.find((d) => d.kind === 'overdraft')?.balance ?? 0;

describe('overdraft payoff milestone', () => {
  it('fires only when no overdraft remains at month end, and once per genuine payoff (tight-cash student)', () => {
    const config = scenarios.find((c) => c.title === 'College Student') ?? scenarios[0]!;
    let s = applyAction(createGame(config), { type: 'resume' }).state;
    s = applyAction(s, { type: 'set_extra_debt_payment', amount: 1500 }).state;
    let borrowedSince = true; // the first payoff needs a prior balance, which coverShortfall creates in-month
    let celebrations = 0, monthsEndingInOverdraft = 0;
    for (let m = 0; m < 20; m++) {
      const before = overdraftBalance(s);
      s = advanceMonth(s);
      const after = overdraftBalance(s);
      if (after > 0) monthsEndingInOverdraft++;
      const paidOff = s.timeline.filter((t) => t.monthIndex === m && t.description === OD).length;
      const toasts = s.notifications.filter((n) => n.monthIndex === m && n.summary === `${OD}!`).length;
      expect(paidOff, `month ${m} milestones`).toBeLessThanOrEqual(1);
      expect(toasts, `month ${m} toasts`).toBe(paidOff);
      if (paidOff) {
        expect(after, `month ${m}: celebrated a payoff while still overdrawn`).toBe(0);
        expect(borrowedSince || before > 0, `month ${m}: celebrated again without a new balance`).toBe(true);
        celebrations++; borrowedSince = false;
      }
      if (after > 0) borrowedSince = true;
    }
    // The tight-cash run is overdrawn at most month ends, so the old once-a-month celebration would have fired many times.
    expect(monthsEndingInOverdraft).toBeGreaterThan(5);
    expect(celebrations).toBeLessThanOrEqual(2);
  });
  it('still celebrates a real overdraft payoff', () => {
    const config = scenarios.find((c) => c.title === 'College Student') ?? scenarios[0]!;
    let s = applyAction(createGame(config), { type: 'resume' }).state;
    s = applyAction(s, { type: 'set_extra_debt_payment', amount: 1500 }).state;
    for (let m = 0; m < 6; m++) s = advanceMonth(s);
    expect(overdraftBalance(s)).toBeGreaterThan(0);
    s.cash += 50_000; // a windfall: the overdraft is repaid in step 3 (minimum + extra) and nothing is re-borrowed
    const m = s.monthIndex;
    s = advanceMonth(s);
    expect(overdraftBalance(s)).toBe(0);
    expect(s.timeline.filter((t) => t.monthIndex === m && t.description === OD)).toHaveLength(1);
    expect(s.notifications.filter((n) => n.monthIndex === m && n.summary === `${OD}!`)).toHaveLength(1);
  });
});
