import { Button, Slider } from '../../../ui';
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
    <Slider className="ft-budget" id={id} label="Monthly spending" aria-label="Monthly discretionary budget (USD)" min={0} max={BOUNDS.monthlySpendMax} step={.01} value={Number.isFinite(Number(budget)) ? Number(budget) : 0} disabled={disabled} format={() => error ? 'Invalid amount' : `${money(Number(budget))} / month`} onChange={value => setBudget(String(value))} error={error} />
    <Button type="submit" variant="primary" disabled={disabled || !!error}>Save budget</Button>{task.feedback}
  </form>} consequence={<><p>After Save · {error ? 'Check amount' : `${money(-Number(budget))} / month`}</p><PolicyPreview state={state} overrides={{ household: { discretionaryMonthly: Number(budget) } }} invalid={!!error} compact /></>} help={<>
    <p>This changes flexible spending, while housing and essentials stay the same.</p>
    <PolicyPreview state={state} overrides={{ household: { discretionaryMonthly: Number(budget) } }} invalid={!!error} />
  </>} details={<LedgerHistory state={state} categories={['housing', 'essentials', 'discretionary']} />} />;
}
