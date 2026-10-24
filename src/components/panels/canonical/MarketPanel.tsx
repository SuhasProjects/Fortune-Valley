import { useEffect, useId, useState } from 'react';
import { ASSET_CLASSES, type Allocation, type AssetClass } from '../../../types/domain';
import { BOUNDS } from '../../../config/defaults';
import { PanelShell } from '../PanelShell';
import { PolicyPreview } from '../PolicyPreview';
import type { PanelProps } from '../panelTypes';
import { amountError, editable, LedgerHistory, money, MoneyInput, percent, useAction, useDraft } from './shared';

const labels: Record<AssetClass, string> = { stock: 'Single-stock basket', bond: 'Bonds', etf: 'Diversified equity ETF' };
const shortLabels: Record<AssetClass, string> = { stock: 'Stocks', bond: 'Bonds', etf: 'Equity ETF' };
const displayWeights = (allocation: Allocation) => Object.fromEntries(ASSET_CLASSES.map(asset => [asset, String(Number((allocation[asset] * 100).toFixed(6)))])) as Record<AssetClass, string>;

export function MarketPanel({ state, dispatch }: PanelProps) {
  const [weights, setWeights] = useState(() => displayWeights(state.policy.targetAllocation));
  const [contribution, setContribution] = useDraft(state.policy.investmentContributionPerMonth);
  const task = useAction(dispatch); const id = useId();
  useEffect(() => setWeights(displayWeights(state.policy.targetAllocation)), [state.policy.targetAllocation.stock, state.policy.targetAllocation.bond, state.policy.targetAllocation.etf]);
  // Presentation percentage validation only; no investment projection math.
  const total = ASSET_CLASSES.reduce((sum, asset) => sum + Number(weights[asset]), 0);
  const valid = ASSET_CLASSES.every(asset => weights[asset].trim() !== '' && Number.isFinite(Number(weights[asset])) && Number(weights[asset]) >= 0 && Number(weights[asset]) <= 100) && Math.abs(total - 100) < .000001;
  const allocation: Allocation = valid ? { stock: Number(weights.stock) / 100, bond: Number(weights.bond) / 100, etf: Number(weights.etf) / 100 } : state.policy.targetAllocation;
  const contributionError = amountError(contribution, 0, BOUNDS.contributionMax);
  const disabled = !editable(state) || task.pending;
  const draftPolicy = { ...state.policy, targetAllocation: allocation, investmentContributionPerMonth: contributionError ? state.policy.investmentContributionPerMonth : Number(contribution) };
  return <PanelShell title="Market" status={<dl>{ASSET_CLASSES.map(asset => <div key={asset}><dt>{shortLabels[asset]}</dt><dd>{money(state.investments[asset])}</dd></div>)}</dl>} decision={<>
    <form onSubmit={event => { event.preventDefault(); if (!disabled && valid) void task.send({ type: 'set_allocation', allocation }); }}>
      <fieldset disabled={disabled}><legend>Where new investments go</legend>
        <div className="ft-allocation">{ASSET_CLASSES.map(asset => <div key={asset}><label htmlFor={`${id}-${asset}`}>{shortLabels[asset]} (%)</label><input id={`${id}-${asset}`} aria-label={`${labels[asset]} (%)`} type="number" min={0} max={100} step="any" value={weights[asset]} onChange={event => setWeights({ ...weights, [asset]: event.target.value })} aria-invalid={!valid} aria-describedby={`${id}-total`} /></div>)}</div>
        <p id={`${id}-total`} aria-live="polite">{Number.isFinite(total) ? `${Number(total.toFixed(6))}%` : 'Invalid total'}{!valid && ' · Must total 100%.'}</p>
        <button disabled={disabled || !valid}>Save allocation</button>
      </fieldset>
    </form>
    <details><summary>Monthly investing</summary><form onSubmit={event => { event.preventDefault(); if (!disabled && !contributionError) void task.send({ type: 'set_contributions', savingsContributionPerMonth: state.policy.savingsContributionPerMonth, investmentContributionPerMonth: Number(contribution) }); }}>
      <MoneyInput label="Monthly investment contribution" raw={contribution} onChange={setContribution} max={BOUNDS.contributionMax} disabled={disabled} />
      <button disabled={disabled || !!contributionError}>Save investment contribution</button>
    </form></details>{task.feedback}
  </>} consequence={<><p>Investing after Save · {money(draftPolicy.investmentContributionPerMonth)} / month</p><PolicyPreview state={state} draftPolicy={draftPolicy} invalid={!valid || !!contributionError} compact /></>} help={<><ul><li>Percentages apply to new investments.</li><li>Existing holdings stay as they are.</li><li>An equity ETF spreads holdings, but can still fall.</li></ul><PolicyPreview state={state} draftPolicy={draftPolicy} invalid={!valid || !!contributionError} /></>} details={<>
    <div className="ft-table-scroll"><table><caption>Illustrative annual assumptions</caption><thead><tr><th scope="col">Asset</th><th scope="col">Return</th><th scope="col">Volatility</th><th scope="col">Last month</th></tr></thead><tbody>{ASSET_CLASSES.map(asset => <tr key={asset}><th scope="row">{shortLabels[asset]}</th><td>{percent(state.assumptions.assets[asset].expectedAnnualReturn)}</td><td>{percent(state.assumptions.assets[asset].annualVolatility)}</td><td>{percent(state.marketState.lastMonthlyReturns[asset])}</td></tr>)}</tbody></table></div>
    <LedgerHistory state={state} categories={['investment_contribution', 'investment_return']} />
  </>} />;
}
