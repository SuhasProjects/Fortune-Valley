import { useEffect, useId, useState } from 'react';
import type { Asset, PanelProps } from './contracts';
import { EventDecision, Frame, History, money, percent, Stat, useCommand } from './shared';
import { parseAmount, validWeights } from './validation';
export const assetNames: Record<Asset, string> = { stock: 'Single-stock basket', bond: 'Bonds', etf: 'Diversified equity ETF' };
const assets: Asset[] = ['stock', 'bond', 'etf'];
const displayWeight = (value: number) => String(Number((value * 100).toFixed(6)));
export function MarketPanel(props: PanelProps) {
  const { model, onCommand } = props; const id = useId(); const task = useCommand(onCommand);
  const [weights, setWeights] = useState(() => assets.map(asset => displayWeight(model.allocation[asset])));
  const [amount, setAmount] = useState(String(model.investmentContribution.value));
  useEffect(() => setWeights(assets.map(asset => displayWeight(model.allocation[asset]))), [model.allocation.stock, model.allocation.bond, model.allocation.etf]);
  useEffect(() => setAmount(String(model.investmentContribution.value)), [model.investmentContribution.value]);
  const allocationValid = validWeights(weights); const parsed = parseAmount(amount, model.investmentContribution);
  const total = weights.reduce((sum, weight) => sum + Number(weight), 0);
  return <Frame title="Market & investments" subtitle="Give future contributions a plan. Returns are uncertain, even with diversification.">
    <dl className="ft-stats">{assets.map(asset => <Stat key={asset} label={assetNames[asset]} value={money(model.positions[asset])} />)}</dl>
    <form className="ft-card" onSubmit={e => { e.preventDefault(); if (model.editable && !task.pending && allocationValid && !parsed.error) void task.send({ kind: 'save_investments', monthlyAmount: parsed.value!, allocation: { stock: Number(weights[0]) / 100, bond: Number(weights[1]) / 100, etf: Number(weights[2]) / 100 } }); }}>
      <h3>Monthly investment policy</h3><p id={`${id}-help`}>Choose percentages totaling 100%. Save to apply your allocation and monthly contribution together. Contributions use available cash after required expenses.</p>
      <fieldset disabled={!model.editable || task.pending} aria-describedby={`${id}-help ${id}-total`}><legend>Allocation of future contributions</legend><div className="ft-weight-grid">{assets.map((asset, index) => <label key={asset} htmlFor={`${id}-${asset}`}>{assetNames[asset]} (%)<input id={`${id}-${asset}`} type="number" min="0" max="100" step="any" value={weights[index]} aria-invalid={!allocationValid} onChange={e => setWeights(weights.map((weight, i) => i === index ? e.target.value : weight))} /></label>)}</div>
      <p id={`${id}-total`} className={allocationValid ? 'ft-muted' : 'ft-error'} aria-live="polite">Total: {Number.isFinite(total) ? `${Number(total.toFixed(6))}%` : '—'}. {!allocationValid && 'Allocation must total 100%.'}</p>
      <label htmlFor={`${id}-amount`}>Monthly contribution (USD)</label><input id={`${id}-amount`} type="number" value={amount} min={model.investmentContribution.min} max={model.investmentContribution.max} step={model.investmentContribution.step} onChange={e => setAmount(e.target.value)} aria-invalid={!!parsed.error} aria-describedby={`${id}-amount-error`} />
      <p id={`${id}-amount-error`} className="ft-error">{parsed.error}</p><button disabled={!allocationValid || !!parsed.error}>Save investment policy</button></fieldset>{task.feedback}
    </form>
    <details className="ft-card"><summary>Illustrative market assumptions</summary><p>A diversified equity ETF may hold stocks and can fall in value. These annual assumptions are simulation inputs, not guaranteed yields or personal forecasts.</p>{!model.marketAssumptions.length ? <p>Per-asset annual return and volatility assumptions are not supplied in this prototype.</p> : <div className="ft-table-wrap"><table><caption>Annual return and volatility assumptions supplied by the engine</caption><thead><tr><th scope="col">Asset</th><th scope="col">Return</th><th scope="col">Volatility</th></tr></thead><tbody>{model.marketAssumptions.map(row => <tr key={row.asset}><th scope="row">{assetNames[row.asset]}</th><td>{percent(row.annualReturn)}</td><td>{percent(row.annualVolatility)}</td></tr>)}</tbody></table></div>}</details>
    <EventDecision {...props} building="market" /><History rows={model.history.market} />
  </Frame>;
}
