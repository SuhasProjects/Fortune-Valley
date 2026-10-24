import type { PanelProps } from './contracts';
import { AmountControl, EventDecision, Frame, History, money, percent, Stat } from './shared';
export function BankPanel(props: PanelProps) {
  const { model, onCommand } = props;
  return <Frame title="Bank & savings" subtitle="Build a buffer, inspect borrowing, and choose what happens each month.">
    <dl className="ft-stats"><Stat label="Available cash" value={money(model.cash)} /><Stat label="Savings" value={money(model.savings)} /><Stat label="Net worth" value={money(model.netWorth)} hint="Assets less outstanding debts" /></dl>
    <AmountControl label="Monthly savings contribution" field={model.savingsContribution} onCommand={onCommand} command={monthlyAmount => ({ kind: 'save_savings', monthlyAmount })} disabled={!model.editable} note="Recurring policy. The engine transfers available cash each month, subject to required bills and debt service." />
    {model.bankTools && <>
      <details className="ft-card"><summary>Move money once</summary>
        <AmountControl label="Transfer cash to savings" field={model.bankTools.transferToSavings} command={amount => ({ kind: 'transfer', from: 'cash', to: 'savings', amount })} onCommand={onCommand} disabled={!model.editable} oneTime note="One-time transfer between your balances. This is separate from your monthly savings policy." action="Transfer to savings" />
        <AmountControl label="Withdraw savings to cash" field={model.bankTools.transferToCash} command={amount => ({ kind: 'transfer', from: 'savings', to: 'cash', amount })} onCommand={onCommand} disabled={!model.editable} oneTime note="One-time withdrawal to available cash. Your recurring contribution stays unchanged." action="Transfer to cash" />
      </details>
      <details className="ft-card"><summary>Recurring debt payment & cash buffer</summary>
        <AmountControl label="Extra debt payment / month" field={model.bankTools.extraDebtPayment} command={monthlyAmount => ({ kind: 'save_extra_debt_payment', monthlyAmount })} onCommand={onCommand} disabled={!model.editable} action="Save recurring debt payment" note="Recurring payment above the minimums, directed to the highest-APR debts first. Debt service can draw on emergency funding if cash runs short. Set zero to stop future extra payments." />
        <AmountControl label="Cash buffer for contributions" field={model.bankTools.minCashBuffer} command={amount => ({ kind: 'save_cash_buffer', amount })} onCommand={onCommand} disabled={!model.editable} action="Save cash buffer" note="Savings and investment contributions leave this amount in cash when possible. This floor does not prevent bills, debt payments, or emergencies from using cash." />
      </details>
    </>}
    <h3>Your debts</h3>{!model.debts.length && <p className="ft-card">No outstanding debts.</p>}
    {model.debts.map(debt => <section key={debt.id} className="ft-card"><h4>{debt.name}</h4><dl className="ft-stats"><Stat label="Balance" value={money(debt.balance)} /><Stat label="Annual APR" value={percent(debt.apr)} /><Stat label="Minimum due / month" value={money(debt.minimumDue)} /></dl><AmountControl label={`Extra payment toward ${debt.name}`} field={debt.extraPayment} command={amount => ({ kind: 'pay_debt', debtId: debt.id, amount })} onCommand={onCommand} disabled={!model.editable || debt.balance <= 0} oneTime note="One-time payment from available cash. The engine verifies affordability and caps repayment at the outstanding balance." action="Pay once" /></section>)}
    <EventDecision {...props} building="bank" /><History rows={model.history.bank} />
  </Frame>;
}
