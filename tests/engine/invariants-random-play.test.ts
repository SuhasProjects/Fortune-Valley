import { describe, expect, it } from 'vitest';
import { advanceMonth, createGame, netWorthOf, round2, validateAllocation } from '@/engine';
import { archetypeConfig } from '@/config/archetypes';
import type { AccountRef, GameState } from '@/types/domain';
import { ARCHETYPE_IDS, firstNonFinite, playRandom } from './helpers/randomPlay';

const SEEDS = 20;
const MONTHS = 24;

/** Incremental ledger reconciliation: initial balance + Σ postings per account must equal the live balance. */
class Reconciler {
  private sums = new Map<AccountRef, number>();
  private seen = 0;
  constructor(private readonly initial: GameState) {}
  check(s: GameState, label: string) {
    for (; this.seen < s.ledger.length; this.seen++) {
      const e = s.ledger[this.seen]!;
      this.sums.set(e.account, (this.sums.get(e.account) ?? 0) + e.amountSigned);
    }
    const expectBalance = (account: AccountRef, start: number, actual: number) => {
      const total = round2(start + (this.sums.get(account) ?? 0));
      if (Math.abs(total - actual) > 0.005) throw new Error(`${label}: ledger for ${account} sums to ${total} but balance is ${actual}`);
    };
    expectBalance('cash', this.initial.cash, s.cash);
    expectBalance('savings', this.initial.savings, s.savings);
    for (const c of ['stock', 'bond', 'etf'] as const) expectBalance(c, this.initial.investments[c], s.investments[c]);
    const debtIds = new Set<string>([...this.initial.debts.map((d) => d.id), ...s.debts.map((d) => d.id), ...[...this.sums.keys()].filter((a) => a.startsWith('debt:')).map((a) => a.slice(5))]);
    for (const id of debtIds) {
      const start = this.initial.debts.find((d) => d.id === id)?.balance ?? 0;
      const actual = s.debts.find((d) => d.id === id)?.balance ?? 0;
      expectBalance(`debt:${id}`, start, actual);
    }
  }
}

function assertStateInvariants(s: GameState, label: string) {
  const nonFinite = firstNonFinite(s);
  if (nonFinite) throw new Error(`${label}: non-finite number at ${nonFinite}`);
  const inv = s.investments.stock + s.investments.bond + s.investments.etf;
  const debt = s.debts.reduce((a, d) => a + d.balance, 0);
  expect(netWorthOf(s), `${label}: net worth identity`).toBeCloseTo(s.cash + s.savings + inv - debt, 2);
  expect(s.netWorthHistory.length, `${label}: netWorthHistory length`).toBe(s.monthIndex + 1);
  expect(s.netWorthHistory[s.monthIndex], `${label}: history tail`).toBeCloseTo(netWorthOf(s), 2);
  for (const d of s.debts) expect(d.balance, `${label}: debt ${d.id} negative`).toBeGreaterThanOrEqual(0);
  expect(s.cash, `${label}: cash negative`).toBeGreaterThanOrEqual(0);
  expect(s.savings, `${label}: savings negative`).toBeGreaterThanOrEqual(0);
  for (const c of ['stock', 'bond', 'etf'] as const) expect(s.investments[c], `${label}: ${c} negative`).toBeGreaterThanOrEqual(0);
  expect(validateAllocation(s.policy.targetAllocation).ok, `${label}: allocation`).toBe(true);
  expect(new Set(s.debts.map((d) => d.id)).size, `${label}: duplicate debt ids`).toBe(s.debts.length);
}

describe('accounting invariants under random valid play', () => {
  for (const archetype of ARCHETYPE_IDS) {
    it(`${archetype}: ${SEEDS} seeds × ${MONTHS} months keep every invariant`, () => {
      let months = 0;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const initial = createGame(archetypeConfig(archetype, seed, { durationMonths: MONTHS }));
        const rec = new Reconciler(initial);
        const { state } = playRandom(archetype, {
          seed,
          months: MONTHS,
          checkPurity: seed <= 5,
          onMonth: (prev, next) => {
            const label = `${archetype} seed ${seed} month ${prev.monthIndex}`;
            expect(next, `${label}: advanceMonth returned its input`).not.toBe(prev);
            expect(next.monthIndex).toBe(prev.monthIndex + 1);
            rec.check(next, label);
            assertStateInvariants(next, label);
            months++;
          },
        });
        expect(state.status).toBe('finished');
        expect(state.monthIndex).toBe(MONTHS);
        // Serialization round-trips the final state.
        expect(structuredClone(state)).toEqual(state);
        expect(JSON.parse(JSON.stringify(state))).toEqual(state);
      }
      expect(months).toBe(SEEDS * MONTHS);
    });
  }

  it('the harness exercises every player action, event answers and loans', () => {
    const types = new Set<string>();
    let loans = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { state, steps } = playRandom('entry_worker', { seed, months: MONTHS });
      for (const st of steps) types.add(st.action.type);
      loans += state.debts.filter((d) => d.id.startsWith('loan_')).length;
    }
    for (const t of ['set_contributions', 'set_budget', 'set_allocation', 'set_insurance', 'set_extra_debt_payment', 'set_min_cash_buffer', 'make_extra_payment', 'transfer', 'enqueue_event', 'set_housing', 'apply_event_option', 'dismiss_event']) expect(types, t).toContain(t);
    expect(loans).toBeGreaterThan(0);
  });

  it('advanceMonth never mutates its input unless inPlace', () => {
    for (const archetype of ARCHETYPE_IDS) {
      const { state: mid } = playRandom(archetype, { seed: 3, months: 12 });
      const s = { ...structuredClone(mid), status: 'playing' as const, durationMonths: 24 };
      const before = structuredClone(s);
      const next = advanceMonth(s);
      expect(s).toEqual(before);
      expect(next.monthIndex).toBe(s.monthIndex + 1);
      const same = advanceMonth(s, { inPlace: true });
      expect(same).toBe(s);
      expect(s.monthIndex).toBe(before.monthIndex + 1);
      expect(JSON.stringify(same)).toBe(JSON.stringify(next));
    }
  });

  it('a sequence of random actions within one month preserves the net worth identity and ledger reconciliation', () => {
    for (const archetype of ARCHETYPE_IDS) {
      const initial = createGame(archetypeConfig(archetype, 5, { durationMonths: 6 }));
      const rec = new Reconciler(initial);
      playRandom(archetype, {
        seed: 5,
        months: 6,
        onAction: (_before, action, after) => { rec.check(after, `${archetype} after ${action.type}`); assertStateInvariants(after, `${archetype} after ${action.type}`); },
      });
    }
  });
});
