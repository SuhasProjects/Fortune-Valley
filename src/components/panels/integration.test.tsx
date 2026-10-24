// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { scenarios } from '../../data/scenarios';
import { useGameStore, selectNetWorth } from '../../stores/useGameStore';
import { ConnectedBuildingPanel, dispatchPanelCommand, planPanelCommand, selectPanelModel } from './ConnectedBuildingPanel';
afterEach(() => { cleanup(); useGameStore.getState().resetGame(); });
describe('shared flow integration', () => {
  it('renders all connected buildings against every shared scenario', () => {
    for (const config of scenarios) {
      useGameStore.getState().startGame(config);
      for (const building of ['bank', 'market', 'office', 'home', 'hospital'] as const) {
        const view = render(<ConnectedBuildingPanel building={building} />);
        expect(screen.getByText(/Fictional educational simulation/)).toBeTruthy(); view.unmount();
      }
    }
  });
  it('persists savings through the store and applies it on the next real engine month', () => {
    useGameStore.getState().startGame(scenarios[1]);
    const initial = useGameStore.getState().game!;
    expect(dispatchPanelCommand({ kind: 'save_savings', monthlyAmount: 300 }).ok).toBe(true);
    expect(useGameStore.getState().game!.policies.investmentContributionPerMonth).toBe(initial.policies.investmentContributionPerMonth);
    useGameStore.getState().advanceOneMonth();
    expect(useGameStore.getState().game!.savings).toBe(initial.savings + 300);
  });
  it('validates the entire market update before dispatching either action', () => {
    useGameStore.getState().startGame(scenarios[1]); const before = useGameStore.getState().game!;
    expect(dispatchPanelCommand({ kind: 'save_investments', monthlyAmount: 900, allocation: { stock: .8, bond: .8, etf: 0 } }).ok).toBe(false);
    expect(useGameStore.getState().game).toBe(before);
    expect(dispatchPanelCommand({ kind: 'save_investments', monthlyAmount: 250, allocation: { stock: .3, bond: .2, etf: .5 } }).ok).toBe(true);
    expect(useGameStore.getState().game!.policies.investmentContributionPerMonth).toBe(250);
    expect(useGameStore.getState().game!.policies.targetAllocation.stock).toBe(.3);
    expect(useGameStore.getState().game!.policies.savingsContributionPerMonth).toBe(before.policies.savingsContributionPerMonth);
  });
  it('rejects unsupported transactions rather than reporting success', () => {
    useGameStore.getState().startGame(scenarios[1]); const before = useGameStore.getState().game!;
    expect(dispatchPanelCommand({ kind: 'pay_debt', debtId: before.debts[0].id, amount: 100 }).ok).toBe(false);
    expect(dispatchPanelCommand({ kind: 'save_budget', monthlyAmount: 100 }).ok).toBe(false);
    expect(dispatchPanelCommand({ kind: 'choose_insurance', coverage: 'health', planId: 'health-basic' }).ok).toBe(false);
    expect(useGameStore.getState().game).toBe(before);
    const model = selectPanelModel(before, scenarios[1], selectNetWorth(useGameStore.getState()));
    expect(model.debts[0].extraPayment.unavailableReason).toBeTruthy();
    expect(model.employment.takeHomeMonthly).toBeUndefined();
    expect(model.insurance.plans).toEqual([]);
    expect(model.insurance.readOnlyPlans![0].coverageDescription).toContain('80%');
  });
  it('resolves event IDs to the engine-owned option action', () => {
    const base = scenarios[1].initialState;
    const game = { ...base, status: 'playing' as const, activeEvent: { id: 'offer', type: 'B' as const, title: 'Job', body: 'Offer', source: 'fallback' as const, buildingTarget: 'office' as const, options: [{ id: 'yes', label: 'Accept', action: { type: 'accept_job_offer' as const, eventId: 'offer', grossAnnualPay: 60000 } }] } };
    expect(planPanelCommand(game, { kind: 'choose_event', eventId: 'offer', optionId: 'yes' }).actions).toEqual([game.activeEvent.options[0].action]);
    expect(planPanelCommand(game, { kind: 'choose_event', eventId: 'offer', optionId: 'missing' }).error).toBeTruthy();
  });
});
