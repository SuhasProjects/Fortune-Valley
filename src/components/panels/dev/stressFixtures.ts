import { fixtureState } from '../../../fixtures';
import { scenarios } from '../../../data/scenarios';
import { applyAction, createGame } from '../../../engine';
import type { GameState } from '../../../types/domain';

/** Only canonical fixture/state fields are changed. The engine owns all balances,
 * accounting and action effects. Original fixtures are never mutated. */
export function stressFixtures(): { id: string; title: string; state: GameState }[] {
  const noCash = structuredClone(fixtureState); noCash.cash = 0; noCash.savings = 0;
  const highDebt = structuredClone(fixtureState);
  if (highDebt.debts[0]) highDebt.debts[0].balance = 500000;
  const noInsurance = structuredClone(fixtureState);
  noInsurance.insurance = { health: null, auto: null, renters: null };
  noInsurance.policy.insurancePlanIds = { ...noInsurance.insurance };
  const unemployed = structuredClone(fixtureState);
  unemployed.employment.status = 'unemployed'; unemployed.employment.grossAnnualSalary = 0; unemployed.employment.monthsUnemployedRemaining = 3;
  return [
    { id: 'no-cash', title: 'No cash', state: noCash },
    { id: 'high-debt', title: 'High debt', state: highDebt },
    { id: 'no-insurance', title: 'No insurance', state: noInsurance },
    { id: 'unemployed', title: 'Unemployed', state: unemployed },
    ...scenarios.map(config => ({ id: config.scenarioId, title: config.title, state: applyAction(createGame(config), { type: 'resume' }).state }))
  ];
}
