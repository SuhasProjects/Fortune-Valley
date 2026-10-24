// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BuildingPanel } from './panelRegistry';
import type { Building, CommandResult } from './contracts';
import { fixtureFor } from './demo/fixtures';
import { parseAmount, validWeights } from './validation';
afterEach(cleanup);
describe('presentation guards', () => {
  it('rejects blank, negative, nonfinite, out-of-range, and off-step amounts', () => {
    const field = { value: 0, min: 0, max: 100, step: 5 };
    for (const raw of ['', '-1', 'Infinity', '101', '3']) expect(parseAmount(raw, field).error).toBeTruthy();
    expect(parseAmount('25', field).value).toBe(25);
  });
  it('requires finite nonnegative allocation weights totaling 100%', () => {
    for (const values of [['', '50', '50'], ['-10', '60', '50'], ['50', '50', '50'], ['NaN', '0', '100']]) expect(validWeights(values)).toBe(false);
    expect(validWeights(['33.33', '33.33', '33.34'])).toBe(true);
  });
});
describe('controlled financial panels', () => {
  it('renders every panel for all four archetypes, including unemployment and no coverage', () => {
    for (let index = 0; index < 4; index++) for (const building of ['bank', 'market', 'office', 'home', 'insurance'] as Building[]) {
      const { unmount } = render(<BuildingPanel building={building} model={fixtureFor(index)} onCommand={() => ({ ok: true })} />);
      expect(screen.getByText(/Fictional educational simulation/)).toBeTruthy(); unmount();
    }
  });
  it('keeps edits local and sends savings as a recurring intent', async () => {
    const model = fixtureFor(1); const onCommand = vi.fn(() => ({ ok: true as const }));
    render(<BuildingPanel building="bank" model={model} onCommand={onCommand} />);
    fireEvent.change(screen.getByLabelText('Monthly savings contribution'), { target: { value: '325' } });
    expect(onCommand).not.toHaveBeenCalled(); expect(model.savingsContribution.value).toBe(200);
    fireEvent.click(screen.getByText('Save monthly amount'));
    await waitFor(() => expect(onCommand).toHaveBeenCalledWith({ kind: 'save_savings', monthlyAmount: 325 }));
  });
  it('does not save invalid portfolio weights and sends both policy fields together', async () => {
    const model = fixtureFor(1); const onCommand = vi.fn(() => ({ ok: true as const }));
    render(<BuildingPanel building="market" model={model} onCommand={onCommand} />);
    fireEvent.change(screen.getByLabelText('Single-stock basket (%)'), { target: { value: '30' } });
    expect((screen.getByText('Save investment policy') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Bonds (%)'), { target: { value: '20' } });
    fireEvent.click(screen.getByText('Save investment policy'));
    await waitFor(() => expect(onCommand).toHaveBeenCalledWith({ kind: 'save_investments', monthlyAmount: 150, allocation: { stock: .3, bond: .2, etf: .5 } }));
    expect(model.allocation.stock).toBe(.2);
  });
  it('shows engine rejection without changing saved insurance', async () => {
    const model = fixtureFor(1); const onCommand = vi.fn(() => ({ ok: false as const, error: 'Plan unavailable.' }));
    render(<BuildingPanel building="insurance" model={model} onCommand={onCommand} />);
    fireEvent.change(screen.getByLabelText('Future health plan'), { target: { value: 'health-plus' } });
    fireEvent.click(screen.getByText('Save health plan'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Plan unavailable.'));
    expect(onCommand).toHaveBeenCalledWith({ kind: 'choose_insurance', coverage: 'health', planId: 'health-plus' });
    expect(model.insurance.selected.health).toBe('health-basic');
  });
  it('sends event and option IDs and displays unexpected failures', async () => {
    const onCommand = vi.fn(async () => { throw new Error('offline'); });
    render(<BuildingPanel building="office" model={fixtureFor(1)} onCommand={onCommand} />);
    fireEvent.click(screen.getByText('Accept offer'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('could not be applied'));
    expect(onCommand).toHaveBeenCalledWith({ kind: 'choose_event', eventId: 'job-offer', optionId: 'accept' });
  });
  it('locks pending submissions and all controls in read-only mode', async () => {
    let resolve!: (result: CommandResult) => void;
    const onCommand = vi.fn(() => new Promise<CommandResult>(done => { resolve = done; }));
    const { rerender } = render(<BuildingPanel building="bank" model={fixtureFor(1)} onCommand={onCommand} />);
    fireEvent.click(screen.getByText('Save monthly amount')); fireEvent.click(screen.getByText('Save monthly amount'));
    expect(onCommand).toHaveBeenCalledTimes(1);
    resolve({ ok: true }); await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    rerender(<BuildingPanel building="bank" model={{ ...fixtureFor(1), editable: false }} onCommand={onCommand} />);
    expect((screen.getByText('Save monthly amount') as HTMLButtonElement).disabled).toBe(true);
  });
  it('debt payment is one-time and never locally changes cash or debt', async () => {
    const model = fixtureFor(1); const onCommand = vi.fn(() => ({ ok: true as const }));
    render(<BuildingPanel building="bank" model={model} onCommand={onCommand} />);
    fireEvent.change(screen.getByLabelText('Extra payment toward Student loan'), { target: { value: '100' } }); fireEvent.click(screen.getByText('Pay once'));
    await waitFor(() => expect(onCommand).toHaveBeenCalledWith({ kind: 'pay_debt', debtId: 'student-loan', amount: 100 }));
    expect(model.cash).toBe(2400); expect(model.debts[0].balance).toBe(5000);
  });
});
