import { Inset } from '../../ui';
import { useMemo } from 'react';
import type { GameState, Policy } from '../../types/domain';
import { previewHorizon, type PreviewOverrides } from '../../engine';
import { money } from './canonical/shared';

/** Display the engine's same-luck replay. No simulation/statistics/math in UI. */
export function PolicyPreview({ state, draftPolicy, overrides, invalid = false, compact = false }: {
  state: GameState; draftPolicy?: Policy; overrides?: PreviewOverrides; invalid?: boolean; compact?: boolean;
}) {
  const changes: PreviewOverrides = { ...(draftPolicy ? { policy: draftPolicy } : {}), ...overrides };
  const p = changes.policy;
  const changed = Boolean(p && (
    (p.savingsContributionPerMonth !== undefined && p.savingsContributionPerMonth !== state.policy.savingsContributionPerMonth)
    || (p.investmentContributionPerMonth !== undefined && p.investmentContributionPerMonth !== state.policy.investmentContributionPerMonth)
    || (p.extraDebtPaymentPerMonth !== undefined && p.extraDebtPaymentPerMonth !== state.policy.extraDebtPaymentPerMonth)
    || (p.minCashBuffer !== undefined && p.minCashBuffer !== state.policy.minCashBuffer)
    || (p.targetAllocation && (['stock', 'bond', 'etf'] as const).some(asset => p.targetAllocation![asset] !== state.policy.targetAllocation[asset]))
  )) || Boolean(changes.household && Object.entries(changes.household).some(([key, value]) => state.household[key as keyof typeof state.household] !== value))
    || Boolean(changes.insurance && Object.entries(changes.insurance).some(([line, plan]) => state.insurance[line as keyof typeof state.insurance] !== plan));
  const signature = JSON.stringify(changes);
  const result = useMemo(() => changed && !invalid ? previewHorizon(state, changes, 12) : null, [state, signature, changed, invalid]);
  if (compact && (!changed || invalid)) return null;
  const label = compact ? '12-month policy preview' : '12-month preview details';
  if (invalid || result?.rejected.length) return <aside aria-label={label}><p>{invalid ? 'Check draft values to preview.' : result!.rejected.join('; ')}</p></aside>;
  if (!result) return <aside aria-label={label}><p>Change a value to compare the next 12 months.</p></aside>;
  const baseline = result.baseline.at(-1); const draft = result.withChange.at(-1);
  if (!baseline || !draft) return <aside aria-label={label}>Preview unavailable.</aside>;
  const shortfall = result.monthsUntilShortfall.withChange;
  const borrowing = shortfall === null ? 'No borrowing in 12 months' : `First borrowing: month ${shortfall}`;
  const scale = Math.max(1, ...result.withChange.map(point => Math.abs(point.cash)));
  if (compact) return <aside className="ft-preview" aria-label={label} role="status"><Inset><p>After 12 months · cash <strong>{money(draft.cash)}</strong></p>
    <div className="ft-cash-bars" role="img" aria-label="Illustrative monthly cash across the next 12 months">{result.withChange.map((point, index) => <span key={index} data-negative={point.cash < 0} style={{ height: `calc(${Math.max(1, Math.round(Math.abs(point.cash) / scale * 12))} * var(--px))` }} title={`Month ${index + 1}: ${money(point.cash)}`}/>)}</div>
    <small>{borrowing} · Illustration</small></Inset></aside>;
  return <aside aria-label={label}>
    <div className="ft-table-scroll"><table><caption>12-month illustration</caption><thead><tr><th scope="col">Balance</th><th scope="col">Current</th><th scope="col">Draft</th></tr></thead><tbody>
      <tr><th scope="row">Cash</th><td>{money(baseline.cash)}</td><td>{money(draft.cash)}</td></tr>
      <tr><th scope="row">Savings</th><td>{money(baseline.savings)}</td><td>{money(draft.savings)}</td></tr>
      <tr><th scope="row">Net worth</th><td>{money(baseline.netWorth)}</td><td>{money(draft.netWorth)}</td></tr>
    </tbody></table></div><p>{borrowing}.</p><small>Same simulated luck, illustrative rather than a forecast.</small>
  </aside>;
}
