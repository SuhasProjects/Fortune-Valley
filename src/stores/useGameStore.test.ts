import { beforeEach, describe, expect, it } from 'vitest'
import { scenarios } from '../data/scenarios'
import { useGameStore } from './useGameStore'

beforeEach(() => useGameStore.getState().resetGame())
describe('game store', () => {
  it.each(scenarios)('advances $scenarioId for 12 months', scenario => { const store = useGameStore.getState(); store.startGame(scenario); for (let i=0;i<12;i++) useGameStore.getState().advanceOneMonth(); expect(useGameStore.getState().game?.monthIndex).toBe(12) })
  it('pause prevents month advancement', () => { const s = scenarios[0]; useGameStore.getState().startGame(s); useGameStore.getState().setPaused(true); useGameStore.getState().advanceOneMonth(); expect(useGameStore.getState().game?.monthIndex).toBe(0) })
  it('records and persists policy changes at exact month', () => { useGameStore.getState().startGame(scenarios[1]); useGameStore.getState().advanceOneMonth(); useGameStore.getState().dispatchAction({ type:'set_contributions', savings:333, investments:222 }); const game=useGameStore.getState().game!; expect(game.policies.savingsContributionPerMonth).toBe(333); expect(game.replayLog[0].monthIndex).toBe(1) })
  it('creates one bounded opportunity and cannot accept twice', () => { useGameStore.getState().startGame(scenarios[1]); for(let i=0;i<3;i++) useGameStore.getState().advanceOneMonth(); const event=useGameStore.getState().game!.activeEvent!; expect(event).toBeTruthy(); const action=event.options[0].action; useGameStore.getState().dispatchAction(action); const after=useGameStore.getState().game!; useGameStore.getState().dispatchAction(action); expect(useGameStore.getState().game).toEqual(after) })
  it('produces accurate finish payload', () => { useGameStore.getState().startGame(scenarios[2]); useGameStore.getState().dispatchAction({ type:'set_allocation', allocation:{ stock:.1,bond:.3,etf:.6 } }); useGameStore.getState().finishGame(); const state=useGameStore.getState(); expect(state.finishPayload?.policyActions).toHaveLength(1); expect(state.finishPayload?.finalState.status).toBe('finished') })
  it('does not retain personalized free text in timeline', async () => { const privateText='my private details'; const result=await useGameStore.getState().generatePersonalized(privateText); useGameStore.getState().startGame(result.config); expect(JSON.stringify(useGameStore.getState().game?.timeline)).not.toContain(privateText) })
})
