import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BuildingPanel, type Building, type PanelCommand, type PanelModel, type CommandResult } from '../index';
import { archetypes, fixtureFor } from './fixtures';
import './preview.css';
const buildings: Building[] = ['bank', 'market', 'office', 'home', 'insurance'];
function Preview() {
  const [building, setBuilding] = useState<Building>('bank'); const [archetype, setArchetype] = useState(1);
  const [model, setModel] = useState<PanelModel>(() => fixtureFor(1)); const [fail, setFail] = useState(false);
  const [commands, setCommands] = useState<PanelCommand[]>([]);
  function onCommand(command: PanelCommand): CommandResult {
    setCommands(previous => [...previous, command]);
    if (fail) return { ok: false, error: 'Preview rejection: the engine declined this change. Your saved policy is unchanged.' };
    // UI persistence demonstration only. Do not simulate transactions or employment.
    if (command.kind === 'pay_debt') return { ok: false, error: 'This fixture has no financial engine. No money moved; wire this command to make_extra_payment.' };
    if (command.kind === 'transfer') return { ok: false, error: 'This fixture has no financial engine. No money moved; use the integrated town to transfer balances.' };
    if (command.kind === 'choose_event') return { ok: false, error: 'Event choice captured. A live engine is required to validate and resolve this offer.' };
    setModel(previous => {
      const next = structuredClone(previous);
      if (command.kind === 'save_savings') next.savingsContribution.value = command.monthlyAmount;
      if (command.kind === 'save_investments') { next.investmentContribution.value = command.monthlyAmount; next.allocation = command.allocation; }
      if (command.kind === 'save_budget') next.discretionaryBudget.value = command.monthlyAmount;
      if (command.kind === 'save_extra_debt_payment' && next.bankTools) next.bankTools.extraDebtPayment.value = command.monthlyAmount;
      if (command.kind === 'save_cash_buffer' && next.bankTools) next.bankTools.minCashBuffer.value = command.amount;
      if (command.kind === 'choose_insurance') next.insurance.selected[command.coverage] = command.planId ?? undefined;
      return next;
    });
    return { ok: true, message: 'Saved to the UI fixture only. No financial simulation is running.' };
  }
  return <main><div className="preview-banner"><strong>FINANCIAL TOWN / PANEL WORKSHOP</strong><p>Offline UI fixtures · no engine, live AI, or simulated month progression</p></div><div className="preview-controls"><label>Starting life <select value={archetype} onChange={e => { const index = Number(e.target.value); setArchetype(index); setModel(fixtureFor(index)); setCommands([]); }}>{archetypes.map((name, i) => <option key={name} value={i}>{name}</option>)}</select></label><label><input type="checkbox" checked={fail} onChange={e => setFail(e.target.checked)} /> Reject commands</label><label><input type="checkbox" checked={!model.editable} onChange={e => setModel({ ...model, editable: !e.target.checked })} /> Read-only</label></div><nav aria-label="Building preview">{buildings.map(value => <button key={value} aria-current={building === value ? 'page' : undefined} onClick={() => setBuilding(value)}>{value}</button>)}</nav><BuildingPanel key={archetype} building={building} model={model} onCommand={onCommand} onNavigate={setBuilding} /><details className="preview-log"><summary>Integration command log</summary><pre>{JSON.stringify(commands, null, 2)}</pre></details></main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
