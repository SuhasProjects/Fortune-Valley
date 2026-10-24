import { useEffect, useId, useState } from 'react';
import type { Coverage, PanelProps } from './contracts';
import { EventDecision, Frame, History, money, useCommand } from './shared';
const kinds: Coverage[] = ['health', 'auto', 'home', 'renters'];
const names: Record<Coverage, string> = { health: 'Health', auto: 'Auto', home: 'Home', renters: 'Renters' };
function CoverageChooser({ kind, model, onCommand }: PanelProps & { kind: Coverage }) {
  const selected = model.insurance.selected[kind] || '';
  const [draft, setDraft] = useState(selected); const id = useId(); const task = useCommand(onCommand);
  useEffect(() => setDraft(selected), [selected]);
  const plans = model.insurance.plans.filter(plan => plan.kind === kind);
  const active = plans.find(plan => plan.id === selected); const candidate = plans.find(plan => plan.id === draft);
  if (!plans.length) return <section className="ft-card"><h3>{names[kind]}</h3><p>No plan choices supplied for this scenario.</p></section>;
  return <form className="ft-card" onSubmit={e => { e.preventDefault(); if (model.editable && !task.pending && candidate?.available && draft !== selected) void task.send({ kind: 'choose_insurance', coverage: kind, planId: draft }); }}>
    <h3>{names[kind]} protection</h3><p>Active: <strong>{active ? active.name : 'No selected plan'}</strong>{active && ` · ${money(active.premiumMonthly)} / month`}</p>
    <label htmlFor={id}>Future {names[kind].toLowerCase()} plan</label><select id={id} value={draft} onChange={e => setDraft(e.target.value)} disabled={!model.editable || task.pending}><option value="" disabled>Select a plan</option>{plans.map(plan => <option key={plan.id} value={plan.id} disabled={!plan.available}>{plan.name} · {money(plan.premiumMonthly)} / month{!plan.available ? ' (unavailable)' : ''}</option>)}</select>
    {candidate && <dl className="ft-stats"><div><dt>Premium / month</dt><dd>{money(candidate.premiumMonthly)}</dd></div><div><dt>Deductible</dt><dd>{money(candidate.deductible)}</dd></div><div><dt>Coverage limit</dt><dd>{money(candidate.coverageLimit)}</dd></div></dl>}
    {candidate && <p>{candidate.assumptions}</p>}
    <details><summary>Compare {names[kind].toLowerCase()} plans</summary><div className="ft-table-wrap"><table><caption>{names[kind]} coverage choices</caption><thead><tr><th scope="col">Plan</th><th scope="col">Monthly premium</th><th scope="col">Deductible</th><th scope="col">Limit</th></tr></thead><tbody>{plans.map(plan => <tr key={plan.id}><th scope="row">{plan.name}{!plan.available && ' (unavailable)'}</th><td>{money(plan.premiumMonthly)}</td><td>{money(plan.deductible)}</td><td>{money(plan.coverageLimit)}</td></tr>)}</tbody></table></div></details>
    <button disabled={!model.editable || task.pending || !candidate?.available || draft === selected}>Save {names[kind].toLowerCase()} plan</button>{task.feedback}
  </form>;
}
export function InsurancePanel(props: PanelProps) {
  return <Frame title="Hospital / Insurance" subtitle="Choose how much financial protection to carry against covered costs.">
    <p className="ft-card">Coverage affects out-of-pocket costs, not the chance of an accident. Changes apply to future premiums and claims; past premiums are not refunded. Limits and exclusions below are simplified simulation assumptions.</p>
    {props.model.insurance.readOnlyPlans?.map(plan => <section className="ft-card" key={plan.id}><h3>{plan.name} · current protection</h3><dl className="ft-stats"><div><dt>Premium / month</dt><dd>{money(plan.premiumMonthly)}</dd></div><div><dt>Deductible</dt><dd>{money(plan.deductible)}</dd></div></dl><p>{plan.coverageDescription}</p></section>)}
    {kinds.map(kind => <CoverageChooser key={kind} kind={kind} {...props} />)}
    <EventDecision {...props} building="insurance" /><History title="Recent claims (signed cash impact)" rows={props.model.insurance.claims} /><History rows={props.model.history.insurance} />
  </Frame>;
}
