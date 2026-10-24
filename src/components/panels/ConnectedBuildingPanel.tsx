import type { GameAction, GameConfig, GameState, BuildingTarget } from '../../types/domain';
import { applyActionPure } from '../../engine/runtime';
import { selectNetWorth, useGameStore } from '../../stores/useGameStore';
import { monthLabel } from '../flow/format';
import { BuildingPanel } from './panelRegistry';
import type { Building, CommandResult, HistoryRow, MoneyField, PanelCommand, PanelModel } from './contracts';
import { percent } from './shared';

const unsupported = 'Not available in the current engine prototype.';
// Numeric input guard only; engine remains responsible for actual affordability.
const field = (value: number, unavailableReason?: string): MoneyField => ({ value, min: 0, max: Number.MAX_SAFE_INTEGER, step: .01, unavailableReason });
const toPanelBuilding = (target: BuildingTarget): Building => target === 'hospital' ? 'insurance' : target;
const toTownBuilding = (target: Building): BuildingTarget => target === 'insurance' ? 'hospital' : target;
const categories: Record<Building, string[]> = { bank: ['debt', 'savings', 'interest'], market: ['investment', 'return'], office: ['income', 'tax'], home: ['housing', 'essential'], insurance: ['insurance', 'claim'] };

export function selectPanelModel(game: GameState, config: GameConfig, netWorth: number): PanelModel {
  const row = (entry: GameState['ledger'][number]): HistoryRow => ({ id: entry.id, month: monthLabel(config.startMonth, entry.monthIndex), description: entry.description, amount: entry.amountSigned });
  const recent = [...game.ledger].reverse();
  const gross = recent.find(entry => entry.category === 'income');
  const tax = recent.find(entry => entry.category === 'tax');
  const history = Object.fromEntries(Object.entries(categories).map(([building, kinds]) => [building, recent.filter(entry => kinds.includes(entry.category)).slice(0, 12).map(row)]));
  return {
    editable: game.status === 'playing' || game.status === 'paused', cash: game.cash, savings: game.savings, netWorth,
    integrationNotes: ['Offline engine prototype: allocation is saved, but investment contributions currently all go to the ETF. Returns, debt interest, and claims are not implemented yet.'],
    savingsContribution: field(game.policies.savingsContributionPerMonth), investmentContribution: field(game.policies.investmentContributionPerMonth),
    discretionaryBudget: field(0, `Discretionary budget editing: ${unsupported}`),
    debts: game.debts.map(debt => ({ id: debt.id, name: debt.name, balance: debt.balance, apr: debt.apr, minimumDue: debt.minimumPayment, extraPayment: field(0, `Extra debt payments: ${unsupported}`) })),
    allocation: game.policies.targetAllocation, positions: game.investments, marketAssumptions: [],
    employment: { status: game.employment.status.replace('_', ' '), grossAnnual: game.employment.grossAnnualPay, grossMonthly: gross?.amountSigned, withholdingMonthly: tax ? Math.abs(tax.amountSigned) : undefined, monthlyContext: 'Monthly figures show the latest posted gross pay and withholding, when available. They may precede a recent job change. The current engine supplies no forward pay estimate or take-home selector.', lastPaycheck: gross ? row(gross) : undefined },
    housing: { description: config.description, rentMonthly: game.household.rent, essentialsMonthly: game.household.monthlyEssentialExpenses, recurring: recent.filter(entry => entry.monthIndex === game.monthIndex && ['housing', 'essential', 'insurance', 'debt'].includes(entry.category)).map(entry => ({ id: entry.id, label: entry.description, amount: entry.amountSigned })) },
    insurance: { selected: {}, plans: [], claims: recent.filter(entry => entry.category === 'claim').map(row), readOnlyPlans: game.insurance.map(plan => ({ id: plan.id, name: plan.name, premiumMonthly: plan.premium, deductible: plan.deductible, coverageDescription: `Recorded coverage fraction: ${percent(plan.coverage)}. This prototype supplies no coverage category, dollar limit, exclusions, or claims calculation. Plan changes are not available yet.` })) },
    history,
    event: game.activeEvent ? { id: game.activeEvent.id, building: toPanelBuilding(game.activeEvent.buildingTarget), title: game.activeEvent.title, body: game.activeEvent.body, source: game.activeEvent.source, options: game.activeEvent.options.map(option => ({ id: option.id, label: option.label })) } : undefined
  };
}

/** Pure integration planning: use the existing engine to validate the entire action
 * batch before the store receives any action. Never compute financial effects here. */
export function planPanelCommand(game: GameState, command: PanelCommand): { actions: GameAction[]; error?: never } | { actions?: never; error: string } {
  if (game.status !== 'playing' && game.status !== 'paused') return { error: 'Start or resume a playable story before changing its policies.' };
  let actions: GameAction[];
  if (command.kind === 'save_savings') {
    if (!Number.isFinite(command.monthlyAmount) || command.monthlyAmount < 0) return { error: 'Enter a valid monthly amount.' };
    actions = [{ type: 'set_contributions', savings: command.monthlyAmount, investments: game.policies.investmentContributionPerMonth }];
  } else if (command.kind === 'save_investments') {
    if (!Number.isFinite(command.monthlyAmount) || command.monthlyAmount < 0 || !Object.values(command.allocation).every(value => Number.isFinite(value))) return { error: 'Enter valid investment settings.' };
    actions = [{ type: 'set_allocation', allocation: command.allocation }, { type: 'set_contributions', savings: game.policies.savingsContributionPerMonth, investments: command.monthlyAmount }];
  } else if (command.kind === 'choose_event') {
    const event = game.activeEvent;
    if (!event || event.id !== command.eventId || (event.expiresAtMonth !== undefined && game.monthIndex > event.expiresAtMonth)) return { error: 'This opportunity is no longer available.' };
    const option = event.options.find(value => value.id === command.optionId);
    if (!option) return { error: 'This choice is no longer available.' };
    // Canonical options own their whitelisted actions. No manual salary mutation.
    actions = [option.action];
  } else return { error: unsupported };
  let preview = game;
  for (const action of actions) {
    const next = applyActionPure(preview, action);
    if (next === preview) return { error: 'The engine rejected this change; your saved policy is unchanged.' };
    preview = next;
  }
  return { actions };
}

export function dispatchPanelCommand(command: PanelCommand): CommandResult {
  const store = useGameStore.getState();
  if (!store.game) return { ok: false, error: 'No story is running.' };
  const plan = planPanelCommand(store.game, command);
  if (plan.error !== undefined) return { ok: false, error: plan.error };
  // Synchronous store actions: preflight the complete batch first, then commit
  // without yielding. No direct store assignment and no partial validation.
  for (const action of plan.actions) store.dispatchAction(action);
  return { ok: true, message: command.kind === 'choose_event' ? 'Choice recorded.' : 'Policy saved.' };
}

export function ConnectedBuildingPanel({ building }: { building: BuildingTarget }) {
  const game = useGameStore(state => state.game); const config = useGameStore(state => state.config);
  const netWorth = useGameStore(selectNetWorth); const openBuilding = useGameStore(state => state.openBuilding);
  if (!game || !config) return null;
  return <BuildingPanel building={toPanelBuilding(building)} model={selectPanelModel(game, config, netWorth)} onCommand={dispatchPanelCommand} onNavigate={target => openBuilding(toTownBuilding(target))} />;
}
