import type { GameState, Policy } from '../../types/domain';
import { previewHorizon } from '../../engine';

const money = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

/**
 * 12-month what-if supplied by the engine (Agent 1): `previewHorizon` replays the
 * next 12 months twice under the game's own seed streams — once with the current
 * policy, once with the draft — so the two differ only by the draft. Deterministic,
 * pure, no forecast of real-world outcomes.
 */
export function PolicyPreview({ state, draftPolicy }: { state: GameState; draftPolicy: Policy }) {
  const p = state.policy;
  const changed = draftPolicy.savingsContributionPerMonth !== p.savingsContributionPerMonth
    || draftPolicy.investmentContributionPerMonth !== p.investmentContributionPerMonth
    || draftPolicy.extraDebtPaymentPerMonth !== p.extraDebtPaymentPerMonth
    || draftPolicy.minCashBuffer !== p.minCashBuffer
    || (['stock', 'bond', 'etf'] as const).some((k) => draftPolicy.targetAllocation[k] !== p.targetAllocation[k]);
  if (!changed) {
    return <aside aria-label="12-month policy preview" role="status">Change a value above to preview the next 12 months with that policy versus your current one (same simulated luck).</aside>;
  }
  const h = previewHorizon(state, { policy: draftPolicy }, 12);
  if (h.rejected.length) {
    return <aside aria-label="12-month policy preview" role="status">Preview unavailable: {h.rejected.join('; ')}</aside>;
  }
  const b = h.baseline[h.baseline.length - 1]!;
  const d = h.withChange[h.withChange.length - 1]!;
  const delta = (x: number) => `${x >= 0 ? '+' : '−'}${money(Math.abs(x))}`;
  const runway = (m: number | null) => (m === null ? 'no emergency borrowing' : `emergency borrowing in month ${m}`);
  return (
    <aside aria-label="12-month policy preview" role="status">
      <p>After 12 months with the draft policy, versus keeping the current one (same simulated luck):</p>
      <dl>
        <dt>Cash</dt><dd>{money(d.cash)} ({delta(d.cash - b.cash)})</dd>
        <dt>Savings</dt><dd>{money(d.savings)} ({delta(d.savings - b.savings)})</dd>
        <dt>Investments</dt><dd>{money(d.investments)} ({delta(d.investments - b.investments)})</dd>
        <dt>Debt</dt><dd>{money(d.debt)} ({delta(d.debt - b.debt)})</dd>
        <dt>Net worth</dt><dd>{money(d.netWorth)} ({delta(d.netWorth - b.netWorth)})</dd>
        <dt>Runway</dt><dd>Draft: {runway(h.monthsUntilShortfall.withChange)}; current: {runway(h.monthsUntilShortfall.baseline)}</dd>
      </dl>
      <small>Illustrative engine replay with demo assumptions, not a forecast. Shocks and returns are identical in both paths.</small>
    </aside>
  );
}
