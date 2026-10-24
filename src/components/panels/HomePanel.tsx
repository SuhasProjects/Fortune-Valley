import type { PanelProps } from './contracts';
import { AmountControl, EventDecision, Frame, History, money, Stat } from './shared';
export function HomePanel(props: PanelProps) {
  const { model, onCommand, onNavigate } = props;
  const protections = model.insurance.plans.filter(plan => (plan.kind === 'home' || plan.kind === 'renters') && plan.canonicalPlanId !== null && model.insurance.selected[plan.kind] === plan.id);
  return <Frame title="Home & household" subtitle="Give everyday spending a monthly limit that fits your life.">
    <p>{model.housing.description}</p><dl className="ft-stats"><Stat label="Housing / month" value={money(model.housing.rentMonthly)} /><Stat label="Essentials / month" value={money(model.housing.essentialsMonthly)} /><Stat label="Discretionary budget / month" value={money(model.discretionaryBudget.value)} /></dl>
    <AmountControl label="Monthly discretionary budget" field={model.discretionaryBudget} command={monthlyAmount => ({ kind: 'save_budget', monthlyAmount })} onCommand={onCommand} disabled={!model.editable} note="Recurring spending limit, separate from housing and essentials. The engine validates this policy against the scenario’s rules." />
    <details className="ft-card"><summary>Recurring cash flows</summary>{model.housing.recurring.length ? <dl className="ft-flows">{model.housing.recurring.map(row => <div key={row.id}><dt>{row.label}</dt><dd>{money(row.amount)} / month</dd></div>)}</dl> : <p>No additional recurring flows.</p>}</details>
    <section className="ft-card"><h3>Household protection</h3>{protections.length ? protections.map(plan => <p key={plan.id}>{plan.name} · {money(plan.premiumMonthly)} / month</p>) : <p>No home or renters protection selected.</p>}{onNavigate ? <button type="button" onClick={() => onNavigate('insurance')}>Review insurance</button> : <p className="ft-muted">Open Hospital / Insurance in town to review coverage.</p>}</section>
    <EventDecision {...props} building="home" /><History rows={model.history.home} />
  </Frame>;
}
