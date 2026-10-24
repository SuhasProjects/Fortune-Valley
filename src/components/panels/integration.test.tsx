// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { scenarios } from '../../data/scenarios';
import { advanceMonth, applyAction, annualWithholding, selectMonthlyTakeHome } from '../../engine';
import { useGameStore, selectNetWorth } from '../../stores/useGameStore';
import { ConnectedBuildingPanel, dispatchPanelCommand, planPanelCommand, selectPanelModel } from './ConnectedBuildingPanel';
import type { GameEvent } from '../../types/domain';
afterEach(() => { cleanup(); useGameStore.getState().resetGame(); });
const start = () => { useGameStore.getState().startGame(scenarios[1]!); return useGameStore.getState().game!; };
describe('canonical engine panel integration', () => {
  it('renders all connected buildings against every shared scenario', () => {
    for (const config of scenarios) {
      useGameStore.getState().startGame(config);
      for (const building of ['bank', 'market', 'office', 'home', 'hospital'] as const) {
        const view = render(<ConnectedBuildingPanel building={building} />);
        expect(screen.getByText(/Fictional educational simulation/)).toBeTruthy(); view.unmount();
      }
    }
  });
  it('persists savings through the store and posts recurring transfers each month', () => {
    const initial = start();
    expect(dispatchPanelCommand({ kind: 'save_savings', monthlyAmount: 300 }).ok).toBe(true);
    expect(useGameStore.getState().game!.policy.investmentContributionPerMonth).toBe(initial.policy.investmentContributionPerMonth);
    let next = advanceMonth(useGameStore.getState().game!);
    next = advanceMonth(next);
    expect(next.ledger.filter(entry => entry.category === 'savings_contribution' && entry.account === 'savings').map(entry => entry.amountSigned)).toEqual([300, 300]);
  });
  it('validates the entire market update before dispatching either action', () => {
    const before = start();
    expect(dispatchPanelCommand({ kind: 'save_investments', monthlyAmount: 900, allocation: { stock: .8, bond: .8, etf: 0 } }).ok).toBe(false);
    expect(useGameStore.getState().game).toBe(before);
    expect(dispatchPanelCommand({ kind: 'save_investments', monthlyAmount: 250, allocation: { stock: .3, bond: .2, etf: .5 } }).ok).toBe(true);
    expect(useGameStore.getState().game!.policy.investmentContributionPerMonth).toBe(250);
    expect(useGameStore.getState().game!.policy.targetAllocation.stock).toBe(.3);
    expect(useGameStore.getState().game!.policy.savingsContributionPerMonth).toBe(before.policy.savingsContributionPerMonth);
  });
  it('uses portfolio weights in real future paths under the same seed', () => {
    start();
    dispatchPanelCommand({ kind: 'save_investments', monthlyAmount: 300, allocation: { stock: 1, bond: 0, etf: 0 } });
    const stock = advanceMonth(useGameStore.getState().game!);
    dispatchPanelCommand({ kind: 'save_investments', monthlyAmount: 300, allocation: { stock: 0, bond: 1, etf: 0 } });
    const bond = advanceMonth(useGameStore.getState().game!);
    expect(stock.seed).toBe(bond.seed);
    expect(stock.investments).not.toEqual(bond.investments);
    expect(stock.ledger.some(entry => entry.category === 'investment_contribution' && entry.account === 'stock')).toBe(true);
    expect(bond.ledger.some(entry => entry.category === 'investment_contribution' && entry.account === 'bond')).toBe(true);
  });
  it('extra payments debit real cash, cap at debt balance, and reject unaffordable requests', () => {
    const before = start(); const debt = before.debts[0]!;
    expect(dispatchPanelCommand({ kind: 'pay_debt', debtId: debt.id, amount: 100 }).ok).toBe(true);
    const after = useGameStore.getState().game!;
    expect(after.cash).toBe(before.cash - 100); expect(after.debts[0]!.balance).toBe(debt.balance - 100);
    expect(dispatchPanelCommand({ kind: 'pay_debt', debtId: debt.id, amount: before.cash + 1 }).ok).toBe(false);
    expect(useGameStore.getState().game).toBe(after);
    const nearPayoff = { ...before, debts: [{ ...debt, balance: 10 }] };
    const result = applyAction(nearPayoff, { type: 'make_extra_payment', debtId: debt.id, amount: 100 });
    expect(result.ok).toBe(true); expect(result.state.cash).toBe(before.cash - 10); expect(result.state.debts[0]!.balance).toBe(0);
  });
  it('budget updates are recurring and engine-bounded', () => {
    start();
    expect(dispatchPanelCommand({ kind: 'save_budget', monthlyAmount: 120 }).ok).toBe(true);
    const updated = useGameStore.getState().game!;
    expect(updated.household.discretionaryMonthly).toBe(120);
    expect(advanceMonth(updated).ledger.some(entry => entry.category === 'discretionary' && entry.amountSigned === -120)).toBe(true);
    expect(dispatchPanelCommand({ kind: 'save_budget', monthlyAmount: -1 }).ok).toBe(false);
    expect(useGameStore.getState().game).toBe(updated);
  });
  it('insurance changes future premiums and claim costs without altering the sampled shocks', () => {
    const config = structuredClone(scenarios[1]!);
    const medical = config.assumptions.shocks.find(shock => shock.kind === 'medical')!;
    medical.monthlyIncidence = 1;
    medical.costMin = 10000; medical.costMax = 10000; // Covered fixture exceeds the deductible.
    useGameStore.getState().startGame(config);
    dispatchPanelCommand({ kind: 'choose_insurance', coverage: 'health', planId: null });
    const uninsured = useGameStore.getState().game!;
    const plan = uninsured.assumptions.insurancePlans.find(plan => plan.line === 'health')!;
    expect(dispatchPanelCommand({ kind: 'choose_insurance', coverage: 'health', planId: plan.id }).ok).toBe(true);
    const insured = useGameStore.getState().game!;
    expect(insured.cash).toBe(uninsured.cash); // No retroactive premium or refund.
    const coveredMonth = advanceMonth(insured); const uncoveredMonth = advanceMonth(uninsured);
    expect(coveredMonth.ledger.some(entry => entry.category === 'insurance_premium' && entry.description.includes(plan.name) && entry.amountSigned === -plan.monthlyPremium)).toBe(true);
    expect(coveredMonth.realizedShocks.map(record => [record.shock.kind, record.shock.grossCost])).toEqual(uncoveredMonth.realizedShocks.map(record => [record.shock.kind, record.shock.grossCost]));
    const covered = coveredMonth.realizedShocks.find(record => record.shock.kind === 'medical')!;
    const uncovered = uncoveredMonth.realizedShocks.find(record => record.shock.kind === 'medical')!;
    expect(covered.shock.outOfPocket).toBeLessThan(uncovered.shock.outOfPocket);
    expect(dispatchPanelCommand({ kind: 'choose_insurance', coverage: 'auto', planId: plan.id }).ok).toBe(false);
  });
  it('Office uses the engine pay selector and exposes the real catalog and assumptions', () => {
    const game = start(); const model = selectPanelModel(game, scenarios[1]!, selectNetWorth(useGameStore.getState()));
    const tax = annualWithholding(game, game.employment.grossAnnualSalary);
    expect(model.employment.takeHomeMonthly).toBe(selectMonthlyTakeHome(game, tax.incomeTax + tax.payroll));
    expect(model.marketAssumptions).toHaveLength(3);
    expect(model.insurance.plans.some(plan => plan.canonicalPlanId === null)).toBe(true);
    expect(model.discretionaryBudget.max).toBe(50000);
  });
  it('resolves canonical event and option IDs without editing salary in the panel', () => {
    start();
    const event: GameEvent = { id: 'offer', type: 'B', title: 'Job', body: 'Offer', createdAtMonth: 0, source: 'fallback', buildingTarget: 'office', options: [{ id: 'yes', label: 'Accept', description: 'A new job', effect: { template: 'offer_job', grossAnnualSalary: 80000, title: 'Librarian' } }] };
    useGameStore.getState().dispatchAction({ type: 'enqueue_event', event });
    const game = useGameStore.getState().game!;
    expect(planPanelCommand(game, { kind: 'choose_event', eventId: 'offer', optionId: 'yes' }).actions).toEqual([{ type: 'apply_event_option', eventId: 'offer', optionId: 'yes' }]);
    expect(planPanelCommand(game, { kind: 'choose_event', eventId: 'offer', optionId: 'missing' }).error).toBeTruthy();
    expect(dispatchPanelCommand({ kind: 'choose_event', eventId: 'offer', optionId: 'yes' }).ok).toBe(true);
    expect(useGameStore.getState().game!.employment.grossAnnualSalary).toBe(80000);
    expect(useGameStore.getState().game!.activeEvents).toHaveLength(0);
    expect(useGameStore.getState().game!.policyLog.at(-1)!.resolvedEffect?.template).toBe('offer_job');
  });
});
