/**
 * Sample fixtures for UI work. All computed by the real engine from a fixed seed —
 * nothing hand-typed. Import from '@/fixtures'. Owner: Agent 1.
 *
 *   import { fixtureConfig, fixtureState, fixtureFinishedState, fixtureEventB, fixtureMonteCarlo } from '@/fixtures';
 */
import { archetypeConfig } from '@/config/archetypes';
import { advanceMonth, applyAction, createGame, runMonteCarlo } from '@/engine';
import { fallbackOpportunity } from '@/services/aiFallback';
import { proposalToEvent } from '@/services/scenarioMapper';
import { summarizeForAi } from '@/engine/selectors';
import type { GameConfig, GameEvent, GameState, MonteCarloResult } from '@/types/domain';

export const FIXTURE_SEED = 20261024;

/** Entry-level worker, 24-month horizon. */
export const fixtureConfig: GameConfig = archetypeConfig('entry_worker', FIXTURE_SEED, { durationMonths: 24 });

function build(): { state: GameState; finished: GameState; eventB: GameEvent; mc: MonteCarloResult } {
  let s = createGame(fixtureConfig);
  s = applyAction(s, { type: 'resume' }).state;
  for (let i = 0; i < 6; i++) s = advanceMonth(s);
  s = applyAction(s, { type: 'set_allocation', allocation: { stock: 0.1, bond: 0.3, etf: 0.6 } }).state;
  s = applyAction(s, { type: 'set_contributions', savingsContributionPerMonth: 300, investmentContributionPerMonth: 200 }).state;
  const proposal = fallbackOpportunity(summarizeForAi(s, fixtureConfig.narrativeFocus, 'entry_worker'));
  const eventB = proposalToEvent(proposal!, s, 'fallback')!;
  s = applyAction(s, { type: 'enqueue_event', event: eventB }).state;
  const state = s;
  let f = applyAction(s, { type: 'apply_event_option', eventId: eventB.id, optionId: eventB.options[0]!.id }).state;
  while (f.status !== 'finished') f = advanceMonth(f);
  const mc = runMonteCarlo(fixtureConfig, f.policyLog, f, { paths: 300 });
  return { state, finished: f, eventB, mc };
}

const built = build();
/** Mid-game state at month 6 with a pending Type B event and two policy changes. */
export const fixtureState: GameState = built.state;
/** Same run played to the horizon. */
export const fixtureFinishedState: GameState = built.finished;
/** A fallback-sourced Type B opportunity (valid whitelisted effects). */
export const fixtureEventB: GameEvent = built.eventB;
/** Real MonteCarloResult (300 paths to keep import cheap; production uses 1,000). */
export const fixtureMonteCarlo: MonteCarloResult = built.mc;
