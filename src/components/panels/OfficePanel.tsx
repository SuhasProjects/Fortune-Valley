import type { PanelProps } from './contracts';
import { EventDecision, Frame, History, money, optionalMoney, Stat } from './shared';
export function OfficePanel(props: PanelProps) {
  const { model } = props; const pay = model.employment;
  return <Frame title="Office & income" subtitle="See how gross salary becomes spending money, and review work opportunities.">
    <p className="ft-card">Employment status: <strong>{pay.status}</strong></p><dl className="ft-stats"><Stat label="Gross salary / year" value={money(pay.grossAnnual)} /><Stat label="Gross pay / month" value={optionalMoney(pay.grossMonthly)} /><Stat label="Estimated withholding / month" value={optionalMoney(pay.withholdingMonthly)} /><Stat label="Estimated take-home / month" value={optionalMoney(pay.takeHomeMonthly)} /></dl>
    {pay.monthlyContext && <p className="ft-card">{pay.monthlyContext}</p>}
    <p className="ft-card">Illustrative tax estimate supplied by the simulation engine. Withholding is a simplified assumption; it is not a tax filing calculation. Take-home pay is before household spending.</p>
    <History title="Last recorded paycheck" rows={pay.lastPaycheck ? [pay.lastPaycheck] : []} /><EventDecision {...props} building="office" /><History rows={model.history.office} />
  </Frame>;
}
