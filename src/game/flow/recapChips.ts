import type { GameState, LedgerCategory, LedgerEntry } from '../../types/domain'

/** One chip on the month recap banner: a signed dollar delta and its short group label. */
export interface RecapChip { group: RecapGroup; label: string; amount: number }
export type RecapGroup = 'job' | 'investments' | 'home' | 'insurance' | 'essentials' | 'spending' | 'debt' | 'car' | 'shock' | 'life' | 'event'

export const RECAP_MAX_CHIPS = 8

/** Display order of the groups (the first eight non-zero groups are shown). */
const ORDER: RecapGroup[] = ['job', 'investments', 'home', 'insurance', 'essentials', 'spending', 'debt', 'car', 'shock', 'life', 'event']

/**
 * Which cash-flow group a ledger line belongs to. Lines that only move money between the player's own
 * accounts (contributions, emergency funding, transfers, borrowing proceeds) and the debt-side copy of a
 * payment are not shown: the chips read as "where did this month's money go", not as double-entry rows.
 */
export function recapGroup(entry: LedgerEntry): RecapGroup | null {
  const c: LedgerCategory = entry.category
  switch (c) {
    case 'salary': case 'unemployment_benefit': case 'tax_withholding': return 'job'
    case 'investment_return': case 'savings_interest': return 'investments'
    case 'housing': return 'home'
    case 'insurance_premium': case 'insurance_claim': return 'insurance'
    case 'essentials': return 'essentials'
    case 'discretionary': return 'spending'
    case 'debt_payment': return entry.account === 'cash' ? 'debt' : null
    case 'car_costs': return 'car'
    case 'shock_cost': return 'shock'
    case 'life_event': return 'life'
    case 'event': return entry.account === 'cash' ? 'event' : null
    default: return null
  }
}

const labelFor = (group: RecapGroup, amount: number): string => {
  switch (group) {
    case 'life': return amount > 0 ? 'gift' : 'life event'
    case 'event': return 'event'
    default: return group
  }
}

/** Signed per-group totals for the month that just finished (`monthIndex - 1`), largest groups first by the fixed order. */
export function recapChips(game: GameState, monthIndex = game.monthIndex - 1): RecapChip[] {
  const totals = new Map<RecapGroup, number>()
  for (const entry of game.ledger) {
    if (entry.monthIndex !== monthIndex) continue
    const group = recapGroup(entry)
    if (!group) continue
    totals.set(group, (totals.get(group) ?? 0) + entry.amountSigned)
  }
  return ORDER.flatMap(group => {
    const amount = Math.round(totals.get(group) ?? 0)
    return amount === 0 ? [] : [{ group, label: labelFor(group, amount), amount }]
  }).slice(0, RECAP_MAX_CHIPS)
}

/** Net-worth change over the month that just finished, from the engine's history (null before the first month). */
export function recapNetWorthDelta(game: GameState): number | null {
  const h = game.netWorthHistory
  if (h.length < 2) return null
  return Math.round(h[h.length - 1]! - h[h.length - 2]!)
}
