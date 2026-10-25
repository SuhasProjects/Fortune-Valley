import { Button, Field, Slider } from '../../../ui';
import { useEffect, useId, useState } from 'react';
import { ASSET_CLASSES, type Allocation, type AssetClass } from '../../../types/domain';
import { BOUNDS } from '../../../config/defaults';
import { selectPaySummary, validateAllocation } from '../../../engine';
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
  const candidate: Allocation = { stock: Number(weights.stock) / 100, bond: Number(weights.bond) / 100, etf: Number(weights.etf) / 100 };
  const checked = validateAllocation(candidate);
  const inlineError = ASSET_CLASSES.some(asset => !weights[asset].trim()) ? 'Enter all three percentages.' : Math.abs(total - 100) >= .000001 ? 'Allocation must total 100%.' : !checked.ok ? checked.message : undefined;
  const valid = !inlineError;
  const allocation: Allocation = valid ? candidate : state.policy.targetAllocation;
  const contributionError = amountError(contribution, 0, BOUNDS.contributionMax);
  const disabled = !editable(state) || task.pending;
  const sliderMax = Math.min(BOUNDS.contributionMax, Math.max(1000, Math.ceil(selectPaySummary(state).grossMonthly), state.policy.investmentContributionPerMonth));
  const draftPolicy = { ...state.policy, targetAllocation: allocation, investmentContributionPerMonth: contributionError ? state.policy.investmentContributionPerMonth : Number(contribution) };
  return <PanelShell title="Market" status={<dl>{ASSET_CLASSES.map(asset => <div key={asset}><dt>{shortLabels[asset]}</dt><dd>{money(state.investments[asset])}</dd></div>)}</dl>} decision={<>
    <form onSubmit={event => { event.preventDefault(); if (!disabled && valid) void task.send({ type: 'set_allocation', allocation }); }}>
      <fieldset disabled={disabled}><legend>Where new investments go</legend>
        <div className="ft-allocation">{ASSET_CLASSES.map(asset => <div key={asset} role="group" aria-label={`${shortLabels[asset]} allocation`}><span className={`ft-asset-chip ft-asset-chip--${asset}`} aria-hidden="true"/><Field label={`${shortLabels[asset]} (%)`} id={`${id}-${asset}`} aria-label={`${labels[asset]} (%)`} type="number" min={0} max={100} step="any" value={weights[asset]} onChange={event => setWeights({ ...weights, [asset]: event.target.value })} aria-invalid={!valid} aria-describedby={`${id}-total`} />
          <div><small>Last month · {percent(state.marketState.lastMonthlyReturns[asset])}</small></div>
          <div><small>Annual assumption · {percent(state.assumptions.assets[asset].expectedAnnualReturn)} · volatility {percent(state.assumptions.assets[asset].annualVolatility)}</small></div>
        </div>)}</div>
        <div className="ft-allocation-bar" aria-hidden="true">{ASSET_CLASSES.map(asset => <span key={asset} className={`ft-asset-chip--${asset}`} style={{ width: `${Math.max(0, Math.min(100, Number(weights[asset]) || 0))}%` }}/>)}</div><p id={`${id}-total`} aria-live="polite">{Number.isFinite(total) ? `${Number(total.toFixed(6))}%` : 'Invalid total'}{inlineError && ` · ${inlineError}`}</p>
        <Button type="submit" variant="primary" disabled={disabled || !valid}>Save allocation</Button>
      </fieldset>
    </form>
    <details><summary>Monthly investing</summary><form onSubmit={event => { event.preventDefault(); if (!disabled && !contributionError) void task.send({ type: 'set_contributions', savingsContributionPerMonth: state.policy.savingsContributionPerMonth, investmentContributionPerMonth: Number(contribution) }); }}>
      <MoneyInput label="Monthly investment contribution" raw={contribution} onChange={setContribution} max={BOUNDS.contributionMax} disabled={disabled} />
      <Slider label="Monthly investment contribution slider" labelHidden scale="log" min={0} max={sliderMax} value={Number.isFinite(Number(contribution)) ? Number(contribution) : 0} disabled={disabled} format={value => `${money(value)} / month`} onChange={value => setContribution(String(value))} />
      <Button type="submit" variant="primary" disabled={disabled || !!contributionError}>Save investment contribution</Button>
    </form></details>{task.feedback}
  </>} consequence={<><p>Investing after Save · {money(draftPolicy.investmentContributionPerMonth)} / month</p><PolicyPreview state={state} draftPolicy={draftPolicy} invalid={!valid || !!contributionError} compact /></>} help={<><ul><li>Percentages apply to new investments.</li><li>Existing holdings stay as they are.</li><li>An equity ETF spreads holdings, but can still fall.</li></ul><PolicyPreview state={state} draftPolicy={draftPolicy} invalid={!valid || !!contributionError} /></>} details={<>
    <div className="ft-table-scroll"><table><caption>Illustrative annual assumptions</caption><thead><tr><th scope="col">Asset</th><th scope="col">Return</th><th scope="col">Volatility</th><th scope="col">Last month</th></tr></thead><tbody>{ASSET_CLASSES.map(asset => <tr key={asset}><th scope="row">{shortLabels[asset]}</th><td>{percent(state.assumptions.assets[asset].expectedAnnualReturn)}</td><td>{percent(state.assumptions.assets[asset].annualVolatility)}</td><td>{percent(state.marketState.lastMonthlyReturns[asset])}</td></tr>)}</tbody></table></div>
    <LedgerHistory state={state} categories={['investment_contribution', 'investment_return']} />
  </>} />;
}
