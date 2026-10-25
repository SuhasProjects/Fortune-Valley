/**
 * Condense a finished (or running) game into ≤ 25 timeline lines for the `recap` AI kind and its
 * offline fallback: the player's policy changes, every realized shock, and the engine's notable
 * notifications (back to work, debt paid off, cash ran short). Pure; no engine imports beyond labels.
 */
import type { AiRequest, GameAction, GameState, PolicyLogEntry } from '@/types/domain';
import { monthLabel, netWorthOf } from '@/engine/accounting';

export type RecapInput = Extract<AiRequest, { kind: 'recap' }>['recap'];
export type TimelineLine = RecapInput['timeline'][number];
export const MAX_RECAP_LINES = 25;

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;
const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** Short past-tense description of a logged action, or null for bookkeeping actions. */
export function describeLogEntry(entry: PolicyLogEntry): { event: string; amount?: number } | null {
  const a: GameAction = entry.action;
  switch (a.type) {
    case 'set_contributions': return { event: `Set savings to ${usd(a.savingsContributionPerMonth)} and investing to ${usd(a.investmentContributionPerMonth)} a month` };
    case 'set_budget': return { event: `Set lifestyle spending to ${usd(a.discretionaryMonthly)} a month`, amount: a.discretionaryMonthly };
    case 'set_allocation': return { event: `Set the investment mix to ${pct(a.allocation.etf)} ETF, ${pct(a.allocation.bond)} bonds, ${pct(a.allocation.stock)} stocks` };
    case 'set_insurance': return { event: a.planId === null ? `Dropped ${a.line} insurance` : `Set ${a.line} insurance to ${a.planId.replaceAll('_', ' ')}` };
    case 'set_housing': return { event: `Set housing to ${usd(a.housingMonthly)} a month`, amount: a.housingMonthly };
    case 'set_extra_debt_payment': return { event: `Set extra debt payments to ${usd(a.amount)} a month`, amount: a.amount };
    case 'set_min_cash_buffer': return { event: `Set the cash buffer to ${usd(a.amount)}`, amount: a.amount };
    case 'make_extra_payment': return { event: `Set a one-time extra debt payment of ${usd(a.amount)}`, amount: a.amount };
    case 'transfer': return { event: `Set a transfer of ${usd(a.amount)} from ${a.from} to ${a.to}`, amount: a.amount };
    case 'apply_event_option': return { event: `Chose "${entry.label ?? 'an offer'}"` };
    default: return null;
  }
}

const SHOCK_NAMES = { medical: 'Medical bill', auto: 'Car repair', home: 'Home repair', job_loss: 'Job loss' } as const;

/** Build the recap input. Priority when trimming to 25 lines: shocks, then decisions, then notifications. */
export function summarizeTimeline(state: GameState): RecapInput {
  const label = (m: number) => monthLabel(state.startMonth, m);
  const clip = (t: string) => t.slice(0, 160);
  const shocks: TimelineLine[] = state.realizedShocks.map(({ monthIndex, shock }) => shock.kind === 'job_loss'
    ? { month: monthIndex, label: label(monthIndex), event: 'Job loss cut the paycheck to unemployment benefits' }
    : { month: monthIndex, label: label(monthIndex), event: clip(`${SHOCK_NAMES[shock.kind]} of ${usd(shock.grossCost)}, ${shock.insurerPaid > 0 ? `insurer paid ${usd(shock.insurerPaid)}, ` : 'no insurance, '}out of pocket ${usd(shock.outOfPocket)}`), amount: Math.round(shock.outOfPocket) });
  const decisions: TimelineLine[] = state.policyLog.flatMap((entry) => { const d = describeLogEntry(entry); return d ? [{ month: entry.monthIndex, label: label(entry.monthIndex), event: clip(d.event), ...(d.amount !== undefined ? { amount: Math.round(d.amount) } : {}) }] : []; });
  const notable = /^(Back to work|Paid off|Cash ran short|Emergency fund|Annual raise)/;
  const notes: TimelineLine[] = state.notifications.filter((n) => notable.test(n.summary)).map((n) => ({ month: n.monthIndex, label: label(n.monthIndex), event: clip(n.summary.replace(/!$/, '')), ...(n.amountSigned !== undefined ? { amount: Math.round(n.amountSigned) } : {}) }));
  const picked = [...shocks, ...decisions, ...notes].slice(0, MAX_RECAP_LINES).sort((a, b) => a.month - b.month);
  const history = state.netWorthHistory;
  return { months: state.monthIndex, startNetWorth: Math.round(history[0] ?? netWorthOf(state)), endNetWorth: Math.round(history[state.monthIndex] ?? netWorthOf(state)), timeline: picked };
}
