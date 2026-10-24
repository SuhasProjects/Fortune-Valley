import { useEffect, useId, useState } from 'react';
import { netWorthOf } from '../../../engine';
import { BOUNDS } from '../../../config/defaults';
import { PanelShell } from '../PanelShell';
import { PolicyPreview } from '../PolicyPreview';
import { PaymentPreview } from '../PaymentPreview';
import type { PanelProps } from '../panelTypes';
import { amountError, editable, LedgerHistory, money, MoneyInput, percent, useAction, useDraft } from './shared';

export function BankPanel({ state, dispatch }: PanelProps) {
  const [savings, setSavings] = useDraft(state.policy.savingsContributionPerMonth);
  const [debtId, setDebtId] = useState(state.debts[0]?.id ?? '');
  const [payment, setPayment] = useState(''); const id = useId(); const task = useAction(dispatch);
  useEffect(() => { if (!state.debts.some(debt => debt.id === debtId)) setDebtId(state.debts[0]?.id ?? ''); }, [state.debts, debtId]);
  const debt = state.debts.find(value => value.id === debtId);
  // Presentation bounds only. The engine still validates the submitted amount.
  const paymentMax = Math.max(0, Math.min(state.cash, debt?.balance ?? 0));
  const savingsError = amountError(savings, 0, BOUNDS.contributionMax);
  const paymentError = amountError(payment, .01, paymentMax);
  const disabled = !editable(state) || task.pending;
  const draftPolicy = { ...state.policy, savingsContributionPerMonth: savingsError ? state.policy.savingsContributionPerMonth : Number(savings) };
  return <PanelShell title="Bank" status={<>
    <dl><div><dt>Cash</dt><dd>{money(state.cash)}</dd></div><div><dt>Savings</dt><dd>{money(state.savings)}</dd></div><div><dt>Net worth</dt><dd>{money(netWorthOf(state))}</dd></div></dl>
    <details><summary>Debts</summary>{state.debts.length ? <ul>{state.debts.map(value => <li key={value.id}><strong>{value.name}</strong> · {money(value.balance)} · {percent(value.apr)} APR · min. {money(value.minimumPayment)} / month</li>)}</ul> : <p>No debts.</p>}</details>
  </>} decision={<>
    <form onSubmit={event => { event.preventDefault(); if (!disabled && !savingsError) void task.send({ type: 'set_contributions', savingsContributionPerMonth: Number(savings), investmentContributionPerMonth: state.policy.investmentContributionPerMonth }); }}>
      <MoneyInput label="Monthly savings contribution" raw={savings} onChange={setSavings} max={BOUNDS.contributionMax} disabled={disabled} />
      <button disabled={disabled || !!savingsError}>Save savings contribution</button>
    </form>
    <details><summary>Extra debt payment</summary>
      {paymentMax <= 0 && <p>No cash or debt available.</p>}
      <form onSubmit={async event => { event.preventDefault(); if (!disabled && debt && !paymentError && paymentMax > 0 && await task.send({ type: 'make_extra_payment', debtId: debt.id, amount: Number(payment) })) setPayment(''); }}>
        <label htmlFor={id}>Debt</label><select id={id} value={debtId} disabled={disabled || !state.debts.length} onChange={event => { setDebtId(event.target.value); setPayment(''); }}>{state.debts.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select>
        <MoneyInput label="One-time debt payment" raw={payment} onChange={setPayment} min={paymentMax > 0 ? .01 : 0} max={paymentMax} disabled={disabled || paymentMax <= 0} />
        <p>{!paymentError ? `${money(-Number(payment))} once` : `Up to ${money(paymentMax)}`}</p>
        {!paymentError && debt && <PaymentPreview state={state} debtId={debt.id} amount={Number(payment)} />}
        <button disabled={disabled || !debt || !!paymentError || paymentMax <= 0}>Pay once</button>
      </form>
    </details>{task.feedback}
  </>} consequence={<><p>Savings after Save · {money(draftPolicy.savingsContributionPerMonth)} / month</p><PolicyPreview state={state} draftPolicy={draftPolicy} invalid={!!savingsError} compact /></>} help={<><ul><li>Savings repeats each month after bills.</li><li>Extra payments use cash and reduce the debt.</li><li>Edits apply when you save.</li></ul><PolicyPreview state={state} draftPolicy={draftPolicy} invalid={!!savingsError} /></>} details={<LedgerHistory state={state} categories={['savings_contribution', 'savings_interest', 'debt_payment', 'debt_interest']} />} />;
}
