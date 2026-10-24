// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { scenarios } from '../../data/scenarios';
import { advanceMonth, netWorthOf } from '../../engine';
import { useGameStore } from '../../stores/useGameStore';
import { ConnectedBuildingPanel, dispatchPanelCommand } from './ConnectedBuildingPanel';
afterEach(() => { cleanup(); useGameStore.getState().resetGame(); });
const start = () => { useGameStore.getState().startGame(scenarios[1]!); return useGameStore.getState().game!; };

describe('Bank decision UX', () => {
  it('does not show errors on an untouched one-time payment, then clears the amount after success', async () => {
    const before = start(); const debt = before.debts[0]!;
    render(<ConnectedBuildingPanel building="bank" />);
    const input = screen.getByLabelText(`Extra payment toward ${debt.name}`) as HTMLInputElement;
    const button = screen.getAllByRole('button', { name: 'Pay once' })[0] as HTMLButtonElement;
    expect(input.value).toBe(''); expect(input.getAttribute('aria-invalid')).toBe('false'); expect(button.disabled).toBe(true);
    expect(screen.queryByText('Enter a valid amount.')).toBeNull();
    fireEvent.change(input, { target: { value: '100' } }); fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('One-time payment applied.'));
    expect(input.value).toBe(''); expect(button.disabled).toBe(true);
    expect(useGameStore.getState().game!.cash).toBe(before.cash - 100);
    expect(useGameStore.getState().game!.debts[0]!.balance).toBe(debt.balance - 100);
  });
  it('moves savings to cash without changing net worth or the recurring contribution', async () => {
    const before = start(); render(<ConnectedBuildingPanel building="bank" />);
    fireEvent.click(screen.getByText('Move money once'));
    const input = screen.getByLabelText('Withdraw savings to cash') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Transfer to cash' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('One-time transfer applied.'));
    const after = useGameStore.getState().game!;
    expect(after.cash).toBe(before.cash + 100); expect(after.savings).toBe(before.savings - 100);
    expect(netWorthOf(after)).toBe(netWorthOf(before));
    expect(after.policy.savingsContributionPerMonth).toBe(before.policy.savingsContributionPerMonth);
    expect(input.value).toBe('');
  });
  it('rejects a transfer with insufficient funds and leaves the state untouched', () => {
    const before = start();
    expect(dispatchPanelCommand({ kind: 'transfer', from: 'cash', to: 'savings', amount: before.cash + 1 }).ok).toBe(false);
    expect(useGameStore.getState().game).toBe(before);
  });
  it('saves recurring debt payments and the contribution buffer using canonical actions', async () => {
    start(); render(<ConnectedBuildingPanel building="bank" />);
    fireEvent.click(screen.getByText('Recurring debt payment & cash buffer'));
    fireEvent.change(screen.getByLabelText('Extra debt payment / month'), { target: { value: '50' } });
    const extraForm = screen.getByLabelText('Extra debt payment / month').closest('form')!;
    fireEvent.submit(extraForm);
    await waitFor(() => expect(useGameStore.getState().game!.policy.extraDebtPaymentPerMonth).toBe(50));
    fireEvent.change(screen.getByLabelText('Cash buffer for contributions'), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save cash buffer' }));
    await waitFor(() => expect(useGameStore.getState().game!.policy.minCashBuffer).toBe(100000));
    const updated = useGameStore.getState().game!;
    const next = advanceMonth(updated);
    expect(next.policy.extraDebtPaymentPerMonth).toBe(50);
    expect(next.ledger.some(row => row.category === 'savings_contribution' || row.category === 'investment_contribution')).toBe(false);
    expect(updated.policyLog.at(-1)!.action.type).toBe('set_min_cash_buffer');
  });
  it('disables transfers and extra payments when no funds are available', () => {
    const config = structuredClone(scenarios[1]!); config.initialState.cash = 0; config.initialState.savings = 0;
    useGameStore.getState().startGame(config); render(<ConnectedBuildingPanel building="bank" />);
    expect((screen.getByLabelText('Transfer cash to savings') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Withdraw savings to cash') as HTMLInputElement).disabled).toBe(true);
    for (const input of screen.getAllByLabelText(/Extra payment toward/)) expect((input as HTMLInputElement).disabled).toBe(true);
  });
});

describe('clear panel accounting labels', () => {
  it('shows no household protection when the selected catalog entry means no coverage', () => {
    start(); dispatchPanelCommand({ kind: 'choose_insurance', coverage: 'renters', planId: null });
    render(<ConnectedBuildingPanel building="home" />);
    expect(screen.getByText('No home or renters protection selected.')).toBeTruthy();
  });
  it('separates actual paycheck withholding from the engine take-home estimate', () => {
    start(); render(<ConnectedBuildingPanel building="office" />);
    expect(screen.getByText('Last paycheck withholding')).toBeTruthy();
    expect(screen.getByText('Estimated take-home / month')).toBeTruthy();
    expect(screen.queryByText('Estimated withholding / month')).toBeNull();
  });
});
