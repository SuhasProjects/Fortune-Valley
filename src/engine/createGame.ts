import type { GameConfig, GameState } from '@/types/domain';
import { netWorthOf } from './accounting';
import { validateConfig } from './validation';

/** Build the initial GameState from a validated config. Throws on invalid config. */
export function createGame(config: GameConfig): GameState {
  const v = validateConfig(config);
  if (!v.ok) throw new Error(`Invalid GameConfig: ${v.message}`);
  const init = structuredClone(config.initialState);
  const state: GameState = {
    schemaVersion: 1,
    scenarioId: config.scenarioId,
    seed: config.seed,
    startMonth: config.startMonth,
    durationMonths: config.durationMonths,
    monthIndex: 0,
    status: 'setup',
    cash: init.cash,
    savings: init.savings,
    investments: init.investments,
    debts: init.debts,
    employment: init.employment,
    household: init.household,
    insurance: init.insurance,
    taxProfile: init.taxProfile,
    marketState: { lastMonthlyReturns: { stock: 0, bond: 0, etf: 0 }, index: { stock: 1, bond: 1, etf: 1 } },
    policy: init.policy,
    assumptions: structuredClone(config.assumptions),
    activeEvents: [],
    ledger: [],
    notifications: [],
    timeline: [],
    policyLog: [],
    netWorthHistory: [],
    shortfallMonths: [],
    realizedShocks: [],
  };
  const nw = netWorthOf(state);
  state.netWorthHistory.push(nw);
  state.timeline.push({ id: `T_start_${config.seed.toString(36)}`, monthIndex: 0, type: 'milestone', description: `Started: ${config.title}`, netWorthAfter: nw });
  return state;
}
