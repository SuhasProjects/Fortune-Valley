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
    <dt>Rent / housing</dt><dd>{money(state.household.housingMonthly)} / month</dd>
    <dt>Essentials</dt><dd>{money(state.household.essentialsMonthly)} / month</dd>
    <dt>Saved discretionary budget</dt><dd>{money(state.household.discretionaryMonthly)} / month</dd>
  </dl>} decision={<form onSubmit={event => { event.preventDefault(); if (!disabled && !error) void task.send({ type: 'set_budget', discretionaryMonthly: Number(budget) }); }}>
    {/* TODO(shared-ui-kit): replace this native semantic scaffold with the owner's Slider. */}
    <label htmlFor={id}>Monthly discretionary budget (USD)</label>
    <input id={id} type="range" min={0} max={BOUNDS.monthlySpendMax} step={.01} value={budget} disabled={disabled} onChange={event => setBudget(event.target.value)} aria-invalid={!!error} aria-describedby={`${id}-help`} />
    <output htmlFor={id}>{error ? 'Invalid amount' : `${money(Number(budget))} / month`}</output>
    <p id={`${id}-help`}>{error || `Engine range: ${money(0)} to ${money(BOUNDS.monthlySpendMax)} per month.`}</p>
    <button disabled={disabled || !!error}>Save budget</button>{task.feedback}
  </form>} consequence={<>
    <p>Draft discretionary spending: {error ? 'Fix the amount' : `${money(-Number(budget))} / month`}. This is recurring spending, separate from rent and essentials. Changes apply only after Save.</p>
    {/* TODO(Agent 1): Policy has no budget field. Never invent one for a preview. */}
    <PolicyPreview state={state} draftPolicy={state.policy} />
  </>} details={<LedgerHistory state={state} categories={['housing', 'essentials', 'discretionary']} />} />;
}
