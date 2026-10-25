import { Button, Slider, Toggle } from '../../../ui';
import { useEffect, useId, useState } from 'react';
import { BOUNDS, CAR_BANDS } from '../../../config/defaults';
import { carRunningCost, hasCar, premiumFor, selectPaySummary } from '../../../engine';
import type { CarState, CarValueBand } from '../../../types/domain';
import { PanelShell } from '../PanelShell';
import { PolicyPreview } from '../PolicyPreview';
import type { PanelProps } from '../panelTypes';
import { amountError, editable, LedgerHistory, money, useAction, useDraft } from './shared';

const CAR_CHOICES: Exclude<CarValueBand, 'none'>[] = ['cheap', 'mid', 'nice'];

export function HomePanel({ state, dispatch }: PanelProps) {
  const [budget, setBudget] = useDraft(state.household.discretionaryMonthly); const id = useId(); const task = useAction(dispatch);
  const error = amountError(budget, 0, BOUNDS.monthlySpendMax);
  // Slider reach: gross monthly income (at least $1k, never below the saved budget); the engine bound still governs typed values.
  const sliderMax = Math.min(BOUNDS.monthlySpendMax, Math.max(1000, Math.ceil(selectPaySummary(state).grossMonthly), state.household.discretionaryMonthly));
  const disabled = !editable(state) || task.pending;

  // Car: owned + value band. Running costs, repair risk and auto cover all follow the band; no resale value is tracked.
  const car = hasCar(state);
  const [carDraft, setCarDraft] = useState<CarState>(state.car);
  useEffect(() => setCarDraft(state.car), [state.car]);
  const carTask = useAction(dispatch); const carId = useId();
  const financed = state.debts.some(debt => debt.kind === 'auto_loan' && debt.balance > 0);
  const carChanged = carDraft.owned !== state.car.owned || carDraft.valueBand !== state.car.valueBand;
  const carDisabled = !editable(state) || carTask.pending;
  const carCost = carDraft.owned ? carRunningCost(carDraft.valueBand) : 0;
  const autoPlan = state.assumptions.insurancePlans.find(plan => plan.id === state.insurance.auto) ?? null;
  const setOwned = (owned: boolean) => setCarDraft(owned ? { owned: true, valueBand: state.car.owned ? state.car.valueBand : 'cheap' } : { owned: false, valueBand: 'none' });
  const carOverrides = { car: carDraft };
  const budgetOverrides = { household: { discretionaryMonthly: Number(budget) } };

  return <PanelShell title="Home" status={<dl>
    <div><dt>Housing / month</dt><dd>{money(state.household.housingMonthly)}</dd></div>
    <div><dt>Essentials / month</dt><dd>{money(state.household.essentialsMonthly)}</dd></div>
    <div><dt>Car / month</dt><dd>{car ? `${money(carRunningCost(state.car.valueBand))} · ${CAR_BANDS[state.car.valueBand].label}` : 'No car'}</dd></div>
    <div><dt>Budget / month</dt><dd>{money(state.household.discretionaryMonthly)}</dd></div>
  </dl>} decision={<>
    <form onSubmit={event => { event.preventDefault(); if (!disabled && !error) void task.send({ type: 'set_budget', discretionaryMonthly: Number(budget) }); }}>
      <Slider className="ft-budget" id={id} label="Monthly spending" aria-label="Monthly discretionary budget (USD)" scale="log" min={0} max={sliderMax} value={Number.isFinite(Number(budget)) ? Number(budget) : 0} disabled={disabled} format={() => error ? 'Invalid amount' : `${money(Number(budget))} / month`} onChange={value => setBudget(String(value))} error={error} />
      <Button type="submit" variant="primary" disabled={disabled || !!error}>Save budget</Button>{task.feedback}
    </form>
    <form className="ft-car-form" onSubmit={event => { event.preventDefault(); if (!carDisabled && carChanged) void carTask.send({ type: 'set_car', owned: carDraft.owned, valueBand: carDraft.valueBand }); }}>
      <fieldset disabled={carDisabled}><legend>Car</legend>
        <Toggle label="I own a car" checked={carDraft.owned} onChange={owned => { if (!(financed && !owned)) setOwned(owned); }} />
        {financed && <p className="ft-car-note">Your car loan is still open, so the car stays until it is paid off.</p>}
        {carDraft.owned && <div className="ft-plan-cards ft-plan-cards--car" role="group" aria-label="Car value band">{CAR_CHOICES.map(band => <label className="ft-plan-card" data-selected={carDraft.valueBand === band} key={band} htmlFor={`${carId}-${band}`}>
          <input type="radio" name={carId} id={`${carId}-${band}`} aria-label={`${CAR_BANDS[band].label} car, worth about ${CAR_BANDS[band].value}`} checked={carDraft.valueBand === band} onChange={() => setCarDraft({ owned: true, valueBand: band })} />
          <strong>{CAR_BANDS[band].label}</strong><span>Worth about {CAR_BANDS[band].value}</span>
          <dl><div><dt>To run / month</dt><dd>{money(carRunningCost(band))}</dd></div></dl>
        </label>)}</div>}
        <p className="ft-car-note">{carDraft.owned
          ? `About ${money(carCost)} / month in fuel, upkeep and registration. Repairs and accidents can happen${carDraft.valueBand === 'nice' ? ' and cost more on a nicer car' : ''}; auto insurance is available at the Health House${autoPlan ? ` (${autoPlan.name}: ${money(premiumFor(autoPlan, carDraft.valueBand))} / month)` : ''}.`
          : `No running costs, no car repairs and no auto insurance${state.insurance.auto ? ' (your auto plan is dropped)' : ''}.`}</p>
      </fieldset>
      <Button type="submit" variant="primary" disabled={carDisabled || !carChanged}>Save car</Button>{carTask.feedback}
    </form>
  </>} consequence={<><p>After Save · {error ? 'Check amount' : `${money(-(Number(budget) + carCost))} / month`}</p><PolicyPreview state={state} overrides={{ ...budgetOverrides, ...(carChanged ? carOverrides : {}) }} invalid={!!error} compact /></>} help={<>
    <p>This changes flexible spending, while housing and essentials stay the same.</p>
    <p>A car adds a monthly running cost by value band (cheap {money(carRunningCost('cheap'))}, mid {money(carRunningCost('mid'))}, nice {money(carRunningCost('nice'))}), makes car repairs possible and unlocks auto insurance. Selling or buying one here changes costs and risk only, never your cash.</p>
    <PolicyPreview state={state} overrides={{ ...budgetOverrides, ...(carChanged ? carOverrides : {}) }} invalid={!!error} />
  </>} details={<LedgerHistory state={state} categories={['housing', 'essentials', 'car_costs', 'discretionary']} />} />;
}
