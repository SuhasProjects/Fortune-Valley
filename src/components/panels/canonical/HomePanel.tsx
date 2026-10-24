import { useId } from 'react';
import { BOUNDS } from '../../../config/defaults';
import { PanelShell } from '../PanelShell';
import { PolicyPreview } from '../PolicyPreview';
import type { PanelProps } from '../panelTypes';
import { amountError, editable, LedgerHistory, money, useAction, useDraft } from './shared';

export function HomePanel({ state, dispatch }: PanelProps) {
  const [budget, setBudget] = useDraft(state.household.discretionaryMonthly); const id = useId(); const task = useAction(dispatch);
  const error = amountError(budget, 0, BOUNDS.monthlySpendMax);
  const disabled = !editable(state) || task.pending;
  return <PanelShell title="Home" status={<dl>
    <div><dt>Housing / month</dt><dd>{money(state.household.housingMonthly)}</dd></div>
    <div><dt>Essentials / month</dt><dd>{money(state.household.essentialsMonthly)}</dd></div>
    <div><dt>Budget / month</dt><dd>{money(state.household.discretionaryMonthly)}</dd></div>
  </dl>} decision={<form onSubmit={event => { event.preventDefault(); if (!disabled && !error) void task.send({ type: 'set_budget', discretionaryMonthly: Number(budget) }); }}>
    <label htmlFor={id}>Monthly spending</label>
    <input className="ft-budget" id={id} aria-label="Monthly discretionary budget (USD)" type="range" min={0} max={BOUNDS.monthlySpendMax} step={.01} value={budget} disabled={disabled} onChange={event => setBudget(event.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-help` : undefined} />
    <output htmlFor={id}>{error ? 'Invalid amount' : `${money(Number(budget))} / month`}</output>
    {error && <p id={`${id}-help`}>{error}</p>}
    <button disabled={disabled || !!error}>Save budget</button>{task.feedback}
  </form>} consequence={<p>After Save · {error ? 'Check amount' : `${money(-Number(budget))} / month`}</p>} help={<>
    <p>This changes flexible spending. Housing and essentials stay the same.</p>
    {/* TODO(Agent 1): Policy has no budget field. Never invent one for a preview. */}
    <PolicyPreview state={state} draftPolicy={state.policy} />
  </>} details={<LedgerHistory state={state} categories={['housing', 'essentials', 'discretionary']} />} />;
}
