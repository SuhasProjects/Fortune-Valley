import type { BuildingId, GameAction, GameConfig, GameState, LedgerCategory } from '../../types/domain';
import { INSURANCE_LINES } from '../../types/domain';
import { applyAction, annualWithholding, selectMonthlyTakeHome } from '../../engine';
import { BOUNDS } from '../../config/defaults';
import { selectNetWorth, useGameStore } from '../../stores/useGameStore';
import { monthLabel } from '../flow/format';
import { BuildingPanel } from './panelRegistry';
import type { Building, CommandResult, HistoryRow, MoneyField, PanelCommand, PanelModel } from './contracts';
import { money, percent } from './shared';

const field = (value: number, max: number = BOUNDS.contributionMax, min = 0): MoneyField => ({ value, min, max, step: .01 });
const toPanelBuilding = (target: BuildingId): Building => target === 'hospital' ? 'insurance' : target;
const toTownBuilding = (target: Building): BuildingId => target === 'insurance' ? 'hospital' : target;
const categories: Record<Building, LedgerCategory[]> = {
  bank: ['debt_interest', 'debt_payment', 'savings_contribution', 'savings_interest', 'transfer'],
  market: ['investment_contribution', 'investment_return'],
  office: ['salary', 'unemployment_benefit', 'tax_withholding'],
  home: ['housing', 'essentials', 'discretionary'],
  insurance: ['insurance_premium', 'insurance_claim', 'shock_cost']
};
const noneId = (line: string) => `__no_coverage_${line}`;

/** Display mapping only: balances and financial calculations belong to the engine. */
export function selectPanelModel(game: GameState, config: GameConfig, netWorth: number): PanelModel {
  const row = (entry: GameState['ledger'][number]): HistoryRow => ({ id: entry.id, month: monthLabel(config.startMonth, entry.monthIndex), description: `${entry.account}: ${entry.description}`, amount: entry.amountSigned });
  const recent = [...game.ledger].reverse();
  const gross = recent.find(entry => entry.category === 'salary' || entry.category === 'unemployment_benefit');
  const taxPosted = recent.find(entry => entry.category === 'tax_withholding' && entry.monthIndex === gross?.monthIndex);
  const tax = annualWithholding(game, game.employment.grossAnnualSalary);
  // Aggregate the engine's two tax components, then let its pay selector calculate take-home.
  const estimatedTakeHome = selectMonthlyTakeHome(game, tax.incomeTax + tax.payroll);
  const history = Object.fromEntries(Object.entries(categories).map(([building, kinds]) => [building, recent.filter(entry => kinds.includes(entry.category)).slice(0, 12).map(row)]));
  return {
    editable: game.status === 'playing' || game.status === 'paused', cash: game.cash, savings: game.savings, netWorth,
    savingsContribution: field(game.policy.savingsContributionPerMonth), investmentContribution: field(game.policy.investmentContributionPerMonth),
    bankTools: {
      transferToSavings: { ...field(0, game.cash, .01), unavailableReason: game.cash <= 0 ? 'No cash available to transfer.' : undefined },
      transferToCash: { ...field(0, game.savings, .01), unavailableReason: game.savings <= 0 ? 'No savings available to transfer.' : undefined },
      extraDebtPayment: field(game.policy.extraDebtPaymentPerMonth),
      minCashBuffer: field(game.policy.minCashBuffer, BOUNDS.cashMax)
    },
    discretionaryBudget: field(game.household.discretionaryMonthly, BOUNDS.monthlySpendMax),
    debts: game.debts.map(debt => ({ id: debt.id, name: debt.name, balance: debt.balance, apr: debt.apr, minimumDue: debt.minimumPayment, extraPayment: { ...field(0, game.cash, .01), unavailableReason: game.cash <= 0 ? 'No cash available for an extra payment.' : debt.balance <= 0 ? 'This debt is already repaid.' : undefined } })),
    allocation: game.policy.targetAllocation, positions: game.investments,
    marketAssumptions: (['stock', 'bond', 'etf'] as const).map(asset => ({ asset, annualReturn: game.assumptions.assets[asset].expectedAnnualReturn, annualVolatility: game.assumptions.assets[asset].annualVolatility })),
    employment: {
      status: `${game.employment.status} · ${game.employment.title}`, grossAnnual: game.employment.grossAnnualSalary,
      grossMonthly: selectMonthlyTakeHome(game, 0), withholdingMonthly: taxPosted ? Math.abs(taxPosted.amountSigned) : undefined,
      withholdingLabel: 'Last paycheck withholding',
      takeHomeMonthly: estimatedTakeHome,
      monthlyContext: 'Gross monthly pay and take-home are engine estimates for current employment. Withholding shows the latest posted paycheck, when available, and may precede a job change. Unemployment benefits are shown in paycheck history rather than the salary estimate.',
      lastPaycheck: gross ? row(gross) : undefined
    },
    housing: {
      description: `${game.household.housingKind} housing · ${config.description}`, rentMonthly: game.household.housingMonthly, essentialsMonthly: game.household.essentialsMonthly,
      recurring: recent.filter(entry => entry.account === 'cash' && entry.monthIndex === game.monthIndex - 1 && ['housing', 'essentials', 'discretionary', 'insurance_premium', 'debt_payment'].includes(entry.category)).map(entry => ({ id: entry.id, label: entry.description, amount: entry.amountSigned }))
    },
    insurance: {
      selected: Object.fromEntries(INSURANCE_LINES.map(line => [line, game.insurance[line] ?? noneId(line)])),
      plans: [
        ...game.assumptions.insurancePlans.map(plan => ({
          id: plan.id, canonicalPlanId: plan.id, kind: plan.line, name: plan.name, premiumMonthly: plan.monthlyPremium,
          deductible: plan.deductible, coverageLimit: plan.coverageCap, available: true,
          assumptions: `Per covered claim: ${percent(plan.coinsurance)} coinsurance after the deductible. Out-of-pocket maximum: ${plan.outOfPocketMax === null ? 'none' : money(plan.outOfPocketMax)}. Insurer payout cap: ${plan.coverageCap === null ? 'none' : money(plan.coverageCap)}. A payout cap can leave additional costs to you. Simplified ${plan.line} coverage only; other claim types are excluded.`
        })),
        ...INSURANCE_LINES.map(line => ({ id: noneId(line), canonicalPlanId: null, kind: line, name: 'No coverage', premiumMonthly: 0, deductible: 0, coverageLimit: 0, assumptions: 'No premium and no insurer payment. You fund the full cost of a shock. This changes cost protection, not event likelihood.', available: true }))
      ],
      claims: [...game.realizedShocks].reverse().filter(record => record.shock.kind !== 'job_loss').map((record, index) => ({ id: `claim-${record.monthIndex}-${index}`, month: monthLabel(game.startMonth, record.monthIndex), description: `${record.shock.kind}: gross cost ${money(record.shock.grossCost)}, insurer paid ${money(record.shock.insurerPaid)}; your out-of-pocket cost`, amount: -record.shock.outOfPocket }))
    },
    history,
    events: game.activeEvents.map(event => ({ id: event.id, building: toPanelBuilding(event.buildingTarget), title: event.title, body: event.body, source: event.source, options: event.options.map(option => ({ id: option.id, label: option.label, description: option.description, disabledReason: event.expiresAtMonth !== undefined && game.monthIndex > event.expiresAtMonth ? 'This opportunity has expired.' : undefined })) }))
  };
}

/** Preflight the complete batch through the canonical engine before dispatching. */
export function planPanelCommand(game: GameState, command: PanelCommand): { actions: GameAction[]; error?: never } | { actions?: never; error: string } {
  if (game.status !== 'playing' && game.status !== 'paused') return { error: 'Start a playable story before changing its policies.' };
  let actions: GameAction[];
  switch (command.kind) {
    case 'save_savings': actions = [{ type: 'set_contributions', savingsContributionPerMonth: command.monthlyAmount, investmentContributionPerMonth: game.policy.investmentContributionPerMonth }]; break;
    case 'save_investments': actions = [{ type: 'set_allocation', allocation: command.allocation }, { type: 'set_contributions', savingsContributionPerMonth: game.policy.savingsContributionPerMonth, investmentContributionPerMonth: command.monthlyAmount }]; break;
    case 'pay_debt': actions = [{ type: 'make_extra_payment', debtId: command.debtId, amount: command.amount }]; break;
    case 'transfer': actions = [{ type: 'transfer', from: command.from, to: command.to, amount: command.amount }]; break;
    case 'save_extra_debt_payment': actions = [{ type: 'set_extra_debt_payment', amount: command.monthlyAmount }]; break;
    case 'save_cash_buffer': actions = [{ type: 'set_min_cash_buffer', amount: command.amount }]; break;
    case 'save_budget': actions = [{ type: 'set_budget', discretionaryMonthly: command.monthlyAmount }]; break;
    case 'choose_insurance':
      if (command.coverage === 'home') return { error: 'Separate home insurance is not modeled; use the renters coverage line.' };
      actions = [{ type: 'set_insurance', line: command.coverage, planId: command.planId }]; break;
    case 'choose_event': actions = [{ type: 'apply_event_option', eventId: command.eventId, optionId: command.optionId }]; break;
  }
  let preview = game;
  for (const action of actions) {
    const result = applyAction(preview, action);
    if (!result.ok) return { error: result.message };
    preview = result.state;
  }
  return { actions };
}

export function dispatchPanelCommand(command: PanelCommand): CommandResult {
  const store = useGameStore.getState();
  if (!store.game) return { ok: false, error: 'No story is running.' };
  const plan = planPanelCommand(store.game, command);
  if (plan.error !== undefined) return { ok: false, error: plan.error };
  for (const action of plan.actions) {
    const result = store.dispatchAction(action);
    if (!result?.ok) return { ok: false, error: result && !result.ok ? result.message : 'No story is running.' };
  }
  return { ok: true, message: command.kind === 'choose_event' ? 'Choice recorded.' : command.kind === 'pay_debt' ? 'One-time payment applied.' : command.kind === 'transfer' ? 'One-time transfer applied.' : 'Policy saved.' };
}

export function ConnectedBuildingPanel({ building }: { building: BuildingId }) {
  const game = useGameStore(state => state.game); const config = useGameStore(state => state.config);
  const netWorth = useGameStore(selectNetWorth); const openBuilding = useGameStore(state => state.openBuilding);
  if (!game || !config) return null;
  return <BuildingPanel building={toPanelBuilding(building)} model={selectPanelModel(game, config, netWorth)} onCommand={dispatchPanelCommand} onNavigate={target => openBuilding(toTownBuilding(target))} />;
}
