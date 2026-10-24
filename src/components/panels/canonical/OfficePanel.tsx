import { monthLabel, selectPaySummary } from '../../../engine';
import { PanelShell } from '../PanelShell';
import type { PanelProps } from '../panelTypes';
import { editable, LedgerHistory, money, useAction } from './shared';

export function OfficePanel({ state, dispatch }: PanelProps) {
  const task = useAction(dispatch);
  const pay = selectPaySummary(state);
  const paycheck = [...state.ledger].reverse().find(row => row.account === 'cash' && (row.category === 'salary' || row.category === 'unemployment_benefit'));
  const withholding = paycheck && state.ledger.find(row => row.category === 'tax_withholding' && row.account === 'cash' && row.monthIndex === paycheck.monthIndex);
  const offers = state.activeEvents.filter(event => event.type === 'B' && event.buildingTarget === 'office' && event.options.some(option => option.effect.template === 'offer_job'));
  return <PanelShell title="Office" status={<>
    <p>{state.employment.status} · {state.employment.title}</p>
    <dl><div><dt>Gross / month</dt><dd>{money(pay.grossMonthly)}</dd></div>
      <div><dt>Tax / month</dt><dd>{money(-pay.withholdingMonthly)}</dd></div>
      <div><dt>Take-home / month</dt><dd>{money(pay.takeHomeMonthly)}</dd></div>
    </dl>
  </>} decision={offers.length ? <>{offers.map(event => {
    const accept = event.options.find(option => option.effect.template === 'offer_job');
    const decline = event.options.find(option => option.effect.template === 'none');
    const expired = event.expiresAtMonth !== undefined && state.monthIndex > event.expiresAtMonth;
    return <section key={event.id} aria-label={event.title}><h4>{event.title}</h4>
      {accept?.effect.template === 'offer_job' && <p>{accept.effect.title} · {money(accept.effect.grossAnnualSalary)} / year</p>}
      {expired && <p>Offer expired.</p>}
      {accept && <button disabled={!editable(state) || task.pending || expired} onClick={() => void task.send({ type: 'apply_event_option', eventId: event.id, optionId: accept.id })}>Accept offer</button>}
      {decline && <button disabled={!editable(state) || task.pending || expired} onClick={() => void task.send({ type: 'apply_event_option', eventId: event.id, optionId: decline.id })}>Decline offer</button>}
    </section>;
  })}{task.feedback}</> : <p>No offers right now.</p>} consequence={paycheck ? <p>Last gross pay · {money(paycheck.amountSigned)} · {monthLabel(state.startMonth, paycheck.monthIndex)}</p> : null} help={<><ul><li>Gross pay is before tax.</li><li>Take-home is after withholding, before bills.</li><li>Illustrative tax estimate; includes income and payroll tax.</li></ul>{state.employment.status === 'unemployed' && <p>Benefits appear in payment history.</p>}</>} details={<><dl><div><dt>Gross / year</dt><dd>{money(state.employment.grossAnnualSalary)}</dd></div><div><dt>Income tax / month</dt><dd>{money(pay.incomeTaxMonthly)}</dd></div><div><dt>Payroll tax / month</dt><dd>{money(pay.payrollMonthly)}</dd></div><div><dt>Last posted withholding</dt><dd>{withholding ? money(withholding.amountSigned) : '—'}</dd></div></dl><p>{pay.note}</p><LedgerHistory state={state} categories={['salary', 'unemployment_benefit', 'tax_withholding']} /></>} />;
}
