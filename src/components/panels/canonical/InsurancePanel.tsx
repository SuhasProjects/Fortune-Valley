import { useEffect, useId, useState } from 'react';
import { settleClaim } from '../../../engine';
import { PanelShell } from '../PanelShell';
import { PolicyPreview } from '../PolicyPreview';
import type { PanelProps } from '../panelTypes';
import { editable, LedgerHistory, money, percent, useAction } from './shared';

export function InsurancePanel({ state, dispatch }: PanelProps) {
  const health = state.assumptions.insurancePlans.filter(plan => plan.line === 'health').sort((a, b) => a.monthlyPremium - b.monthlyPremium);
  const low = health[0]; const high = low && health.find(plan => plan.monthlyPremium > low.monthlyPremium && plan.deductible < low.deductible);
  const choices = low && high ? [low, high] : [];
  const current = health.find(plan => plan.id === state.insurance.health);
  const [draftId, setDraftId] = useState(state.insurance.health ?? '');
  useEffect(() => setDraftId(state.insurance.health ?? ''), [state.insurance.health]);
  const candidate = choices.find(plan => plan.id === draftId); const task = useAction(dispatch); const id = useId();
  const disabled = !editable(state) || task.pending;
  const overrides = { insurance: { health: candidate?.id ?? state.insurance.health } };
  return <PanelShell title="Insurance" status={<>
    <p>{current?.name ?? 'No health coverage'}</p>
    {current && <dl><div><dt>Per month</dt><dd>{money(current.monthlyPremium)}</dd></div><div><dt>Deductible</dt><dd>{money(current.deductible)}</dd></div></dl>}
  </>} decision={choices.length ? <form onSubmit={event => { event.preventDefault(); if (!disabled && candidate) void task.send({ type: 'set_insurance', line: 'health', planId: candidate.id }); }}>
    <fieldset disabled={disabled}><legend>Health coverage</legend><div className="ft-table-scroll"><table aria-label="Illustrative health choices for a $5,000 medical bill"><thead><tr><th scope="col">Choose</th><th scope="col">Per month</th><th scope="col">Deductible</th><th scope="col">You pay on $5k</th></tr></thead><tbody>{choices.map((plan, index) => <tr key={plan.id}><th scope="row"><label htmlFor={`${id}-${plan.id}`}><input type="radio" name={id} id={`${id}-${plan.id}`} aria-label={`${index === 0 ? 'Low premium / high deductible' : 'High premium / low deductible'} · ${plan.name}`} checked={draftId === plan.id} onChange={() => setDraftId(plan.id)} />{index === 0 ? 'Lower premium' : 'Lower deductible'}</label></th><td>{money(plan.monthlyPremium)}</td><td>{money(plan.deductible)}</td><td>{money(settleClaim(5000, plan).outOfPocket)}</td></tr>)}</tbody></table></div></fieldset>
    <button disabled={disabled || !candidate || candidate.id === state.insurance.health}>Save health plan</button>{task.feedback}
  </form> : <p>No plan choices available.</p>} consequence={<><p>After Save · {candidate ? `${money(-candidate.monthlyPremium)} / month` : 'Choose a plan'}</p><PolicyPreview state={state} overrides={overrides} compact /></>} help={<><ul><li>The $5k example is a medical bill.</li><li>Coverage changes the bill, never accident likelihood.</li><li>New cover applies to future claims. No refunds for past premiums.</li></ul><PolicyPreview state={state} overrides={overrides} /></>} details={<><ul>{choices.map(plan => <li key={plan.id}>{plan.name} · {percent(plan.coinsurance)} coinsurance · payout cap {plan.coverageCap === null ? 'none' : money(plan.coverageCap)} · out-of-pocket max {plan.outOfPocketMax === null ? 'none' : money(plan.outOfPocketMax)}</li>)}</ul><LedgerHistory state={state} categories={['insurance_premium', 'insurance_claim', 'shock_cost']} /></>} />;
}
