import { useEffect, useId, useState } from 'react';
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
  const draftPolicy = { ...state.policy, insurancePlanIds: { ...state.policy.insurancePlanIds, health: candidate?.id ?? state.policy.insurancePlanIds.health } };
  return <PanelShell title="Insurance" status={<>
    <p>Current health plan: {current?.name ?? 'No coverage'}.</p>
    {current && <dl><dt>Monthly premium</dt><dd>{money(current.monthlyPremium)} / month</dd><dt>Deductible per claim</dt><dd>{money(current.deductible)}</dd></dl>}
  </>} decision={choices.length ? <form onSubmit={event => { event.preventDefault(); if (!disabled && candidate) void task.send({ type: 'set_insurance', line: 'health', planId: candidate.id }); }}>
    <fieldset disabled={disabled}><legend>One health coverage decision</legend>{choices.map((plan, index) => <div key={plan.id}><input type="radio" name={id} id={`${id}-${plan.id}`} checked={draftId === plan.id} onChange={() => setDraftId(plan.id)} /><label htmlFor={`${id}-${plan.id}`}>{index === 0 ? 'Low premium / high deductible' : 'High premium / low deductible'} · {plan.name}</label></div>)}</fieldset>
    <table><caption>Illustrative health plan comparison</caption><thead><tr><th scope="col">Plan</th><th scope="col">Monthly premium</th><th scope="col">Deductible / claim</th><th scope="col">What it covers</th></tr></thead><tbody>{choices.map(plan => <tr key={plan.id}><th scope="row">{plan.name}</th><td>{money(plan.monthlyPremium)} / month</td><td>{money(plan.deductible)}</td><td>Modeled medical costs. You pay {percent(plan.coinsurance)} coinsurance after the deductible. Payout cap: {plan.coverageCap === null ? 'none' : money(plan.coverageCap)}. Out-of-pocket maximum: {plan.outOfPocketMax === null ? 'none' : money(plan.outOfPocketMax)}. A payout cap can leave additional cost to you.</td></tr>)}</tbody></table>
    <button disabled={disabled || !candidate || candidate.id === state.insurance.health}>Save health plan</button>{task.feedback}
  </form> : <p>TODO: the engine catalog does not contain a low-premium/high-deductible and high-premium/low-deductible health pair.</p>} consequence={<>
    <p>Draft premium: {candidate ? `${money(-candidate.monthlyPremium)} / month` : 'Select a plan'}. Insurance changes cost severity, never accident likelihood. Changes affect future premiums and claims; past premiums are not refunded.</p>
    <PolicyPreview state={state} draftPolicy={draftPolicy} />
  </>} details={<><p>Health coverage is the only editable insurance choice in this reduced scope. Auto and renters choices remain unchanged.</p><LedgerHistory state={state} categories={['insurance_premium', 'insurance_claim', 'shock_cost']} /></>} />;
}
