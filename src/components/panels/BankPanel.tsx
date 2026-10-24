import type { PanelProps } from './contracts';
import { AmountControl, EventDecision, Frame, History, money, percent, Stat } from './shared';
export function BankPanel(props: PanelProps) {
  const { model, onCommand } = props;
  return <Frame title="Bank & savings" subtitle="Build a buffer, inspect borrowing, and choose what happens each month.">
    <dl className="ft-stats"><Stat label="Available cash" value={money(model.cash)} /><Stat label="Savings" value={money(model.savings)} /><Stat label="Net worth" value={money(model.netWorth)} hint="Assets less outstanding debts" /></dl>
    <AmountControl label="Monthly savings contribution" field={model.savingsContribution} onCommand={onCommand} command={monthlyAmount => ({ kind: 'save_savings', monthlyAmount })} disabled={!model.editable} note="Recurring policy. The engine transfers available cash each month, subject to required bills and debt service." />
    <h3>Your debts</h3>{!model.debts.length && <p className="ft-card">No outstanding debts.</p>}
    {model.debts.map(debt => <section key={debt.id} className="ft-card"><h4>{debt.name}</h4><dl className="ft-stats"><Stat label="Balance" value={money(debt.balance)} /><Stat label="Annual APR" value={percent(debt.apr)} /><Stat label="Minimum due / month" value={money(debt.minimumDue)} /></dl><AmountControl label={`Extra payment toward ${debt.name}`} field={debt.extraPayment} command={amount => ({ kind: 'pay_debt', debtId: debt.id, amount })} onCommand={onCommand} disabled={!model.editable || debt.balance <= 0} note="One-time payment from available cash. The engine verifies affordability and caps repayment at the outstanding balance." action="Pay once" /></section>)}
    <EventDecision {...props} building="bank" /><History rows={model.history.bank} />
  </Frame>;
}
