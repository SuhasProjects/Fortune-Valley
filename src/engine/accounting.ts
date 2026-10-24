/**
 * Pure accounting helpers. Owner: Agent 1.
 * Every balance change goes through `post` so the ledger reconciles with balances.
 */
import type { AccountRef, Allocation, FundingSource, GameState, LedgerCategory, LedgerEntry } from '@/types/domain';
import { ASSET_CLASSES } from '@/types/domain';

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export function netWorthOf(s: Pick<GameState, 'cash' | 'savings' | 'investments' | 'debts'>): number {
  const inv = s.investments.stock + s.investments.bond + s.investments.etf;
  const debt = s.debts.reduce((a, d) => a + d.balance, 0);
  return round2(s.cash + s.savings + inv - debt);
}

export const investmentsTotal = (inv: Allocation): number => round2(inv.stock + inv.bond + inv.etf);
export const debtTotal = (s: Pick<GameState, 'debts'>): number => round2(s.debts.reduce((a, d) => a + d.balance, 0));

export function monthLabel(startMonth: string, monthIndex: number): string {
  const [y, m] = startMonth.split('-').map(Number) as [number, number];
  const total = (y ?? 2026) * 12 + ((m ?? 1) - 1) + monthIndex;
  const yy = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${yy}-${String(mm).padStart(2, '0')}`;
}

let idCounter = 0;
/** Deterministic ids: seed/month-scoped so two identical runs produce identical ids. */
export function makeId(prefix: string, state: Pick<GameState, 'seed' | 'monthIndex'>, n: number): string {
  return `${prefix}_${state.seed.toString(36)}_${state.monthIndex}_${n}`;
}
/** Non-deterministic id for UI-originated objects (events enqueued by AI, etc.). */
export function uiId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/**
 * Posts a signed amount to an account and records the ledger entry.
 * Mutates the (already cloned) working state. Returns the entry.
 */
export function post(
  s: GameState,
  account: AccountRef,
  category: LedgerCategory,
  amountSigned: number,
  description: string,
  lean = false,
): LedgerEntry | null {
  const amt = round2(amountSigned);
  if (amt === 0) return null;
  if (account === 'cash') s.cash = round2(s.cash + amt);
  else if (account === 'savings') s.savings = round2(s.savings + amt);
  else if (account === 'stock' || account === 'bond' || account === 'etf') s.investments[account] = round2(s.investments[account] + amt);
  else {
    const id = account.slice(5);
    const d = s.debts.find((x) => x.id === id);
    if (!d) throw new Error(`post: unknown debt ${id}`);
    // For debts, positive amountSigned increases what you owe (interest, borrowing); negative = payment.
    d.balance = round2(d.balance + amt);
  }
  const entry: LedgerEntry = {
    id: makeId('L', s, s.ledger.length),
    monthIndex: s.monthIndex,
    category,
    account,
    amountSigned: amt,
    description,
  };
  if (!lean) s.ledger.push(entry);
  return entry;
}

/**
 * Enforce "never silently create money": if cash < 0, draw from the policy's
 * emergency funding order, and finally borrow via an overdraft debt.
 * Returns the funding record. Documented in docs/ARCHITECTURE.md §Funding order.
 */
export function coverShortfall(s: GameState, reason: string, lean = false): { source: 'cash' | FundingSource; amount: number }[] {
  const funded: { source: 'cash' | FundingSource; amount: number }[] = [];
  if (s.cash >= 0) return funded;
  const order: FundingSource[] = [...s.policy.emergencyFundingOrder];
  if (!order.includes('borrow')) order.push('borrow');

  for (const src of order) {
    if (s.cash >= 0) break;
    const need = round2(-s.cash);
    if (src === 'savings' && s.savings > 0) {
      const take = Math.min(need, s.savings);
      post(s, 'savings', 'emergency_funding', -take, `Covered ${reason} from savings`, lean);
      post(s, 'cash', 'emergency_funding', take, `Covered ${reason} from savings`, lean);
      funded.push({ source: 'savings', amount: take });
    } else if (src === 'investments') {
      const total = investmentsTotal(s.investments);
      if (total <= 0) continue;
      const take = Math.min(need, total);
      // Pro-rata liquidation across classes.
      let moved = 0;
      for (const c of ASSET_CLASSES) {
        const share = round2((s.investments[c] / total) * take);
        if (share > 0) {
          post(s, c, 'emergency_funding', -share, `Sold ${c} to cover ${reason}`, lean);
          moved = round2(moved + share);
        }
      }
      if (moved > 0) {
        post(s, 'cash', 'emergency_funding', moved, `Sold investments to cover ${reason}`, lean);
        funded.push({ source: 'investments', amount: moved });
      }
    } else if (src === 'borrow') {
      const take = need;
      let od = s.debts.find((d) => d.kind === 'overdraft');
      if (!od) {
        od = { id: 'overdraft', name: 'Overdraft / emergency credit line', kind: 'overdraft', balance: 0, apr: s.assumptions.overdraftApr, minimumPayment: 0 };
        s.debts.push(od);
      }
      post(s, `debt:${od.id}`, 'overdraft', take, `Borrowed to cover ${reason}`, lean);
      post(s, 'cash', 'overdraft', take, `Borrowed to cover ${reason}`, lean);
      // Minimum payment: 3% of balance or $25, recomputed each month in advanceMonth.
      od.minimumPayment = round2(Math.max(25, od.balance * 0.03));
      funded.push({ source: 'borrow', amount: take });
      if (!s.shortfallMonths.includes(s.monthIndex)) s.shortfallMonths.push(s.monthIndex);
    }
  }
  return funded;
}

/** Annual → monthly compounding rate. */
export const monthlyRate = (annual: number): number => Math.pow(1 + annual, 1 / 12) - 1;
