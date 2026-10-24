import { monthLabel } from '../../../engine';
import { PanelShell } from '../PanelShell';
import type { PanelProps } from '../panelTypes';
import { editable, LedgerHistory, money, useAction } from './shared';

export function OfficePanel({ state, dispatch }: PanelProps) {
  const task = useAction(dispatch);
  const paycheck = [...state.ledger].reverse().find(row => row.account === 'cash' && (row.category === 'salary' || row.category === 'unemployment_benefit'));
  const withholding = paycheck && state.ledger.find(row => row.category === 'tax_withholding' && row.account === 'cash' && row.monthIndex === paycheck.monthIndex);
  const offers = state.activeEvents.filter(event => event.type === 'B' && event.buildingTarget === 'office' && event.options.some(option => option.effect.template === 'offer_job'));
  return <PanelShell title="Office" status={<>
    <p>Job status: {state.employment.status} · {state.employment.title}</p>
    <dl><dt>Gross salary / year</dt><dd>{money(state.employment.grossAnnualSalary)}</dd>
      <dt>Last recorded gross paycheck / benefit</dt><dd>{paycheck ? `${money(paycheck.amountSigned)} · ${monthLabel(state.startMonth, paycheck.monthIndex)}` : 'No paycheck recorded yet.'}</dd>
      <dt>Last recorded withholding</dt><dd>{withholding ? money(withholding.amountSigned) : 'No withholding recorded for the last paycheck.'}</dd>
      <dt>Take-home — illustrative tax estimate</dt><dd>Unavailable: TODO — awaiting the engine's complete monthly pay summary.</dd>
    </dl>
    <p>Gross pay is before withholding. Take-home is after withholding and before household bills. No tax calculation is performed in this panel.</p>
  </>} decision={offers.length ? <>{offers.map(event => {
    const accept = event.options.find(option => option.effect.template === 'offer_job');
    const decline = event.options.find(option => option.effect.template === 'none');
    const expired = event.expiresAtMonth !== undefined && state.monthIndex > event.expiresAtMonth;
    return <section key={event.id} aria-label={event.title}><h4>{event.title}</h4><p>{event.body}</p>
      {accept && <p>{accept.description}</p>}
      {expired && <p>This offer has expired.</p>}
      {accept && <button disabled={!editable(state) || task.pending || expired} onClick={() => void task.send({ type: 'apply_event_option', eventId: event.id, optionId: accept.id })}>Accept offer</button>}
      {decline ? <button disabled={!editable(state) || task.pending || expired} onClick={() => void task.send({ type: 'apply_event_option', eventId: event.id, optionId: decline.id })}>Decline offer</button> : <p>TODO: this engine event has no decline option.</p>}
    </section>;
  })}{task.feedback}</> : <p>Read-only: no job offer is awaiting a decision.</p>} consequence={<p>Salary changes only when the engine accepts a job-offer option. Monthly gross/take-home estimates are unavailable until the engine supplies the missing summary; no projected numbers are invented.</p>} details={<><p>{state.taxProfile.note}</p><LedgerHistory state={state} categories={['salary', 'unemployment_benefit', 'tax_withholding']} /></>} />;
}
