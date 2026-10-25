import { Button } from '../../../ui';
import { useEffect, useId, useState } from 'react';
import { carBand, hasCar, premiumFor, settleClaim } from '../../../engine';
import type { InsurancePlan } from '../../../types/domain';
import { PanelShell } from '../PanelShell';
import { PolicyPreview } from '../PolicyPreview';
import type { PanelProps } from '../panelTypes';
import { editable, LedgerHistory, money, percent, useAction } from './shared';

const NO_AUTO = 'none';
/** Illustrative repair bill for the auto cards (the engine's auto shock has a $1,200 median and a $20k cap). */
const AUTO_EXAMPLE = 6000;

export function InsurancePanel({ state, dispatch }: PanelProps) {
  const health = state.assumptions.insurancePlans.filter(plan => plan.line === 'health').sort((a, b) => a.monthlyPremium - b.monthlyPremium);
  const low = health[0]; const high = low && health.find(plan => plan.monthlyPremium > low.monthlyPremium && plan.deductible < low.deductible);
  const choices = low && high ? [low, high] : [];
  const current = health.find(plan => plan.id === state.insurance.health);
  const [draftId, setDraftId] = useState(state.insurance.health ?? '');
  useEffect(() => setDraftId(state.insurance.health ?? ''), [state.insurance.health]);
  const candidate = choices.find(plan => plan.id === draftId); const task = useAction(dispatch); const id = useId();
  const disabled = !editable(state) || task.pending;

  // Auto cover: only lives with a car (Your Home → Car) see it; the engine skips car shocks and never bills auto premiums for the rest.
  const car = hasCar(state);
  const band = carBand(state);
  const autoPremium = (plan: InsurancePlan | null) => plan ? premiumFor(plan, band) : 0;
  const autoPlans = state.assumptions.insurancePlans.filter(plan => plan.line === 'auto').sort((a, b) => a.monthlyPremium - b.monthlyPremium);
  const autoCurrent = autoPlans.find(plan => plan.id === state.insurance.auto) ?? null;
  const [autoDraft, setAutoDraft] = useState(state.insurance.auto ?? NO_AUTO);
  useEffect(() => setAutoDraft(state.insurance.auto ?? NO_AUTO), [state.insurance.auto]);
  const autoCandidate = autoDraft === NO_AUTO ? null : autoPlans.find(plan => plan.id === autoDraft) ?? null;
  const autoValid = autoDraft === NO_AUTO || autoCandidate !== null;
  const autoChanged = autoValid && (autoCandidate?.id ?? null) !== (state.insurance.auto ?? null);
  const autoTask = useAction(dispatch); const autoId = useId();
  const autoDisabled = !editable(state) || autoTask.pending;

  const overrides = { insurance: { health: candidate?.id ?? state.insurance.health, ...(car && autoValid ? { auto: autoCandidate?.id ?? null } : {}) } };
  const premiumAfter = (candidate?.monthlyPremium ?? current?.monthlyPremium ?? 0) + (car ? (autoValid ? autoPremium(autoCandidate) : autoPremium(autoCurrent)) : 0);
  const strayAuto = !car && state.insurance.auto !== null; // older save or config: a plan on file with no car (never billed)
  const autoCards: { key: string; plan: InsurancePlan | null; title: string; name: string; covers: string }[] = car ? [
    ...autoPlans.map(plan => ({
      key: plan.id, plan,
      title: plan.coverageCap === 0 ? 'Liability only' : 'Full coverage',
      name: plan.name,
      covers: plan.coverageCap === 0 ? 'Covers damage to others, nothing on your own car.' : `Pays your repairs after a ${money(plan.deductible)} deductible${plan.coverageCap === null ? '' : `, up to ${money(plan.coverageCap)}`}.`,
    })),
    { key: NO_AUTO, plan: null, title: 'No cover', name: 'Go without', covers: 'You pay every repair bill yourself.' },
  ] : [];

  return <PanelShell title="Insurance" status={<>
    <p>{current?.name ?? 'No health coverage'}</p>
    {current && <dl><div><dt>Per month</dt><dd>{money(current.monthlyPremium)}</dd></div><div><dt>Deductible</dt><dd>{money(current.deductible)}</dd></div></dl>}
    {car ? <p>Auto · {autoCurrent ? `${autoCurrent.name} · ${money(autoPremium(autoCurrent))} / month` : 'No auto coverage'}</p> : <p>No car on file; add one at Your Home.</p>}
  </>} decision={choices.length ? <>
    <form onSubmit={event => { event.preventDefault(); if (!disabled && candidate) void task.send({ type: 'set_insurance', line: 'health', planId: candidate.id }); }}>
      <fieldset disabled={disabled}><legend>Health coverage</legend><div className="ft-plan-cards" role="group" aria-label="Illustrative health choices for a $5,000 medical bill">{choices.map((plan, index) => <label className="ft-plan-card" data-selected={draftId === plan.id} key={plan.id} htmlFor={`${id}-${plan.id}`}>
        <input type="radio" name={id} id={`${id}-${plan.id}`} aria-label={`${index === 0 ? 'Low premium / high deductible' : 'High premium / low deductible'} ? ${plan.name}`} checked={draftId === plan.id} onChange={() => setDraftId(plan.id)} />
        <strong>{index === 0 ? 'Lower premium' : 'Lower deductible'}</strong><span>{plan.name}</span>
        <dl><div><dt>Per month</dt><dd>{money(plan.monthlyPremium)}</dd></div><div><dt>Deductible</dt><dd>{money(plan.deductible)}</dd></div><div><dt>You pay on a $5k bill</dt><dd>{money(settleClaim(5000, plan).outOfPocket)}</dd></div></dl>
      </label>)}</div></fieldset>
      <Button type="submit" variant="primary" disabled={disabled || !candidate || candidate.id === state.insurance.health}>Save health plan</Button>{task.feedback}
    </form>
    {car && <form className="ft-auto-form" onSubmit={event => { event.preventDefault(); if (!autoDisabled && autoChanged) void autoTask.send({ type: 'set_insurance', line: 'auto', planId: autoCandidate?.id ?? null }); }}>
      <fieldset disabled={autoDisabled}><legend>Auto insurance</legend><div className="ft-plan-cards ft-plan-cards--auto" role="group" aria-label={`Illustrative auto choices for a ${money(AUTO_EXAMPLE)} repair bill`}>{autoCards.map(card => <label className="ft-plan-card" data-selected={autoDraft === card.key} key={card.key} htmlFor={`${autoId}-${card.key}`}>
        <input type="radio" name={autoId} id={`${autoId}-${card.key}`} aria-label={`${card.title} ? ${card.name}`} checked={autoDraft === card.key} onChange={() => setAutoDraft(card.key)} />
        <strong>{card.title}</strong><span>{card.name}</span>
        <dl><div><dt>Per month</dt><dd>{money(autoPremium(card.plan))}</dd></div><div><dt>Deductible</dt><dd>{card.plan ? money(card.plan.deductible) : '—'}</dd></div><div><dt>You pay on a $6k repair</dt><dd>{money(settleClaim(AUTO_EXAMPLE, card.plan).outOfPocket)}</dd></div></dl>
        <small>{card.covers}</small>
      </label>)}</div></fieldset>
      <Button type="submit" variant="primary" disabled={autoDisabled || !autoChanged}>Save auto plan</Button>{autoTask.feedback}
    </form>}
    {strayAuto && <form className="ft-auto-form" onSubmit={event => { event.preventDefault(); if (!autoDisabled) void autoTask.send({ type: 'set_insurance', line: 'auto', planId: null }); }}>
      <p>An auto plan is on file but you have no car, so it is never billed.</p>
      <Button type="submit" disabled={autoDisabled}>Set auto plan to none</Button>{autoTask.feedback}
    </form>}
  </> : <p>No plan choices available.</p>} consequence={<><p>After Save · {candidate || (car && autoValid) ? `${money(-premiumAfter)} / month in premiums` : 'Choose a plan'}</p><PolicyPreview state={state} overrides={overrides} compact /></>} help={<><ul><li>The $5k example is a medical bill{car ? '; the $6k example is a car repair after an accident' : ''}.</li><li>Coverage changes the bill, never accident likelihood.</li>{car && <li>Liability-only cover pays for damage to others, so your own repair bill stays with you.</li>}<li>New cover applies to future claims. No refunds for past premiums.</li></ul><PolicyPreview state={state} overrides={overrides} /></>} details={<><ul>{choices.map(plan => <li key={plan.id}>{plan.name} · {percent(plan.coinsurance)} coinsurance · payout cap {plan.coverageCap === null ? 'none' : money(plan.coverageCap)} · out-of-pocket max {plan.outOfPocketMax === null ? 'none' : money(plan.outOfPocketMax)}</li>)}{car && autoPlans.map(plan => <li key={plan.id}>{plan.name} · deductible {money(plan.deductible)} · payout cap {plan.coverageCap === null ? 'none' : money(plan.coverageCap)}</li>)}</ul>{!car && <p>This life has no car, so car accidents never happen and no auto cover is offered. Add a car at Your Home to unlock it.</p>}<LedgerHistory state={state} categories={['insurance_premium', 'insurance_claim', 'shock_cost']} /></>} />;
}
