// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { applyAction, createGame } from '../../../engine';
import { scenarios } from '../../../data/scenarios';
import { BOUNDS } from '../../../config/defaults';
import type { BuildingId, GameEvent } from '../../../types/domain';
import { BuildingPanel, panelRegistry } from '../panelRegistry';
import { StressStatesPage } from '../dev/StressStatesPage';
import { stressFixtures } from '../dev/stressFixtures';
import { amountError } from './shared';

afterEach(cleanup);
const initial = () => applyAction(createGame(scenarios[1]!), { type: 'resume' }).state;
const dispatchFor = (state = initial()) => vi.fn((action: Parameters<typeof applyAction>[1]) => applyAction(state, action));
describe('canonical component contract and shell', () => {
  it('registers only canonical building IDs and exposes the three zones', () => {
    expect(Object.keys(panelRegistry).sort()).toEqual(['bank', 'home', 'hospital', 'market', 'office']);
    render(<BuildingPanel building="bank" state={initial()} dispatch={dispatchFor()} />);
    for (const name of ['Current status', 'Decision', 'Projected consequence']) expect(screen.getByRole('region', { name })).toBeTruthy();
    expect(screen.getByText(/Preview unavailable/)).toBeTruthy();
  });
  it('renders every panel for four starting lives without undefined or NaN', () => {
    for (const config of scenarios) for (const building of Object.keys(panelRegistry) as BuildingId[]) {
      const state = applyAction(createGame(config), { type: 'resume' }).state;
      const view = render(<BuildingPanel building={building} state={state} dispatch={dispatchFor(state)} />);
      expect(view.container.textContent).not.toMatch(/NaN|undefined/); view.unmount();
    }
  });
  it('rejects invalid presentation amounts without a calculator or alternate actions', () => {
    for (const raw of ['', '-1', 'NaN', 'Infinity', '101', '.001']) expect(amountError(raw, 0, 100)).toBeTruthy();
    expect(amountError('12.50', 0, 100)).toBeUndefined();
  });
});
describe('reduced Bank decisions', () => {
  it('keeps drafts local and preserves the investment contribution in the canonical action', async () => {
    const state = initial(); const dispatch = dispatchFor(state);
    render(<BuildingPanel building="bank" state={state} dispatch={dispatch} />);
    fireEvent.change(screen.getByLabelText('Monthly savings contribution (USD)'), { target: { value: '325' } });
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save savings contribution' }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'set_contributions', savingsContributionPerMonth: 325, investmentContributionPerMonth: state.policy.investmentContributionPerMonth }));
    expect(state.policy.savingsContributionPerMonth).toBe(scenarios[1]!.initialState.policy.savingsContributionPerMonth);
  });
  it('caps extra debt input at both debt and cash, and rejects excess before dispatch', () => {
    const state = initial(); state.cash = 100; state.debts[0]!.balance = 40;
    const dispatch = dispatchFor(state); render(<BuildingPanel building="bank" state={state} dispatch={dispatch} />);
    fireEvent.click(screen.getByText('Make a one-time extra debt payment'));
    const input = screen.getByLabelText('One-time debt payment (USD)');
    expect(input.getAttribute('max')).toBe('40');
    fireEvent.change(input, { target: { value: '41' } });
    expect((screen.getByRole('button', { name: 'Pay once' }) as HTMLButtonElement).disabled).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('dispatches an affordable one-time payment and clears only after success', async () => {
    const state = initial(); const dispatch = dispatchFor(state);
    render(<BuildingPanel building="bank" state={state} dispatch={dispatch} />);
    fireEvent.click(screen.getByText('Make a one-time extra debt payment'));
    const input = screen.getByLabelText('One-time debt payment (USD)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '10' } }); fireEvent.click(screen.getByRole('button', { name: 'Pay once' }));
    await waitFor(() => expect(input.value).toBe(''));
    expect(dispatch).toHaveBeenCalledWith({ type: 'make_extra_payment', debtId: state.debts[0]!.id, amount: 10 });
  });
  it('disables payments for no cash and shows the engine rejection without mutating state', async () => {
    const state = initial(); state.cash = 0;
    const dispatch = vi.fn(() => ({ ok: false as const, code: 'invalid_amount' as const, message: 'Engine rejected this policy.', state }));
    render(<BuildingPanel building="bank" state={state} dispatch={dispatch} />);
    fireEvent.click(screen.getByText('Make a one-time extra debt payment'));
    expect((screen.getByLabelText('One-time debt payment (USD)') as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Monthly savings contribution (USD)'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save savings contribution' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Engine rejected this policy.'));
    expect(state.cash).toBe(0); expect(state.policy.savingsContributionPerMonth).toBe(scenarios[1]!.initialState.policy.savingsContributionPerMonth);
  });
});
describe('reduced Market decisions', () => {
  it('requires 100% and sends only set_allocation when allocation is saved', async () => {
    const state = initial(); const dispatch = dispatchFor(state);
    render(<BuildingPanel building="market" state={state} dispatch={dispatch} />);
    fireEvent.change(screen.getByLabelText('Single-stock basket (%)'), { target: { value: '30' } });
    expect((screen.getByRole('button', { name: 'Save allocation' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Bonds (%)'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save allocation' }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'set_allocation', allocation: { stock: .3, bond: .2, etf: .5 } }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(state.policy.targetAllocation).toEqual(scenarios[1]!.initialState.policy.targetAllocation);
  });
  it('uses set_contributions separately and preserves savings', async () => {
    const state = initial(); const dispatch = dispatchFor(state);
    render(<BuildingPanel building="market" state={state} dispatch={dispatch} />);
    fireEvent.click(screen.getByText('Monthly investment contribution', { exact: true }));
    fireEvent.change(screen.getByLabelText('Monthly investment contribution (USD)'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save investment contribution' }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'set_contributions', savingsContributionPerMonth: state.policy.savingsContributionPerMonth, investmentContributionPerMonth: 200 }));
  });
});
describe('Insurance, Home and Office', () => {
  it('offers exactly two health choices and calls set_insurance', async () => {
    const state = initial(); const dispatch = dispatchFor(state);
    render(<BuildingPanel building="hospital" state={state} dispatch={dispatch} />);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    fireEvent.click(screen.getByLabelText(/High premium \/ low deductible/));
    fireEvent.click(screen.getByRole('button', { name: 'Save health plan' }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'set_insurance', line: 'health', planId: 'health_plus' }));
    expect(screen.getByText(/never accident likelihood/)).toBeTruthy();
  });
  it('uses one budget slider within the engine bounds', async () => {
    const state = initial(); const dispatch = dispatchFor(state);
    render(<BuildingPanel building="home" state={state} dispatch={dispatch} />);
    const slider = screen.getByRole('slider'); expect(slider.getAttribute('max')).toBe(String(BOUNDS.monthlySpendMax));
    expect(screen.getAllByRole('slider')).toHaveLength(1);
    fireEvent.change(slider, { target: { value: '120' } }); fireEvent.click(screen.getByRole('button', { name: 'Save budget' }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'set_budget', discretionaryMonthly: 120 }));
  });
  it('keeps Office read-only and marks the missing tax estimate instead of calculating it', () => {
    render(<BuildingPanel building="office" state={initial()} dispatch={dispatchFor()} />);
    expect(screen.queryByRole('spinbutton')).toBeNull(); expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByText('Take-home — illustrative tax estimate')).toBeTruthy();
    expect(screen.getByText(/awaiting the engine's complete monthly pay summary/)).toBeTruthy();
  });
  it('accepts and declines using the canonical engine event and option IDs', async () => {
    const state = initial();
    const offer: GameEvent = { id: 'job', type: 'B', title: 'Library offer', body: 'A role is available.', buildingTarget: 'office', source: 'fallback', createdAtMonth: 0, options: [{ id: 'take-job', label: 'Accept', description: 'Librarian', effect: { template: 'offer_job', grossAnnualSalary: 80000, title: 'Librarian' } }, { id: 'keep-job', label: 'Decline', description: 'Keep current role', effect: { template: 'none' } }] };
    state.activeEvents = [offer]; const dispatch = dispatchFor(state);
    render(<BuildingPanel building="office" state={state} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept offer' }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'apply_event_option', eventId: 'job', optionId: 'take-job' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decline offer' }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'apply_event_option', eventId: 'job', optionId: 'keep-job' }));
  });
});
describe('stress states dev page', () => {
  it('renders 40 panels for the four edge states and all four starting lives', () => {
    render(<StressStatesPage />);
    for (const title of ['Bank', 'Market', 'Insurance', 'Home', 'Office']) expect(screen.getAllByRole('region', { name: title })).toHaveLength(8);
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });
  it('clones canonical fixtures rather than mutating the shared sample', () => {
    const first = stressFixtures(); first[0]!.state.cash = 123;
    const next = stressFixtures(); expect(next[0]!.state.cash).toBe(0);
    expect(next.find(value => value.id === 'no-insurance')!.state.insurance.health).toBeNull();
    expect(next.find(value => value.id === 'unemployed')!.state.employment.status).toBe('unemployed');
  });
});
