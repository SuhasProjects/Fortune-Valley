import { create } from 'zustand'
import { applyActionPure, attachEvent } from '../engine/runtime'
import { fallbackOpportunities, scenarioById, scenarios } from '../data/scenarios'
import type { BuildingTarget, FinishPayload, GameAction, GameConfig, GameEvent, GameState } from '../types/domain'

type PersonalizationResult = { config: GameConfig; fallback: boolean }
interface GameStore {
  game: GameState | null; initialState: GameState | null; config: GameConfig | null
  openBuildingId: BuildingTarget | null; timelineOpen: boolean; historyOpen: boolean
  personalizationLoading: boolean; personalizationError: string | null; finishPayload: FinishPayload | null
  requestVersion: number
  startGame(config: GameConfig): void; advanceOneMonth(): void; dispatchAction(action: GameAction): void
  openBuilding(target: BuildingTarget): void; closeBuilding(): void; setPaused(paused: boolean): void
  openTimeline(): void; closeTimeline(): void; setHistoryOpen(open: boolean): void; markNotificationRead(id: string): void
  finishGame(): void; resetGame(): void; generatePersonalized(prompt: string): Promise<PersonalizationResult>
}
const clone = <T,>(value: T): T => structuredClone(value)
const fallbackConfig = (prompt: string): GameConfig => {
  const normalized = prompt.toLowerCase()
  const base = normalized.includes('student') ? scenarios[0] : normalized.includes('family') || normalized.includes('child') ? scenarios[3] : normalized.includes('invest') || normalized.includes('retire') ? scenarios[2] : scenarios[1]
  return { ...clone(base), scenarioId: `personalized-${base.scenarioId}`, title: 'Personalized starting point', description: `Offline fallback based on the selected mechanics in “${prompt.slice(0, 72)}${prompt.length > 72 ? '…' : ''}”`, mode: 'personalized', seed: base.seed + 17, initialState: { ...clone(base.initialState), scenarioId: `personalized-${base.scenarioId}`, seed: base.seed + 17 } }
}
const buildOpportunity = (game: GameState): GameEvent => {
  const fixture = fallbackOpportunities[(game.seed + game.monthIndex) % fallbackOpportunities.length]
  const eventId = `fallback-${game.scenarioId}-${game.monthIndex}-${fixture.template}`
  const newPay = Math.round(game.employment.grossAnnualPay * 1.08 / 1000) * 1000
  return { id: eventId, type: 'B', title: fixture.title, body: fixture.body, buildingTarget: fixture.building, source: 'fallback', expiresAtMonth: game.monthIndex + 2, options: fixture.template === 'offer_job' ? [
    { id: 'accept', label: `Accept $${newPay.toLocaleString()} gross/year`, action: { type: 'accept_job_offer', eventId, grossAnnualPay: newPay } },
    { id: 'decline', label: 'Keep current role', action: { type: 'decline_event', eventId } }
  ] : [{ id: 'review', label: 'Review this policy', action: { type: 'apply_event_option', eventId, optionId: 'review' } }, { id: 'skip', label: 'Not now', action: { type: 'decline_event', eventId } }] }
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null, initialState: null, config: null, openBuildingId: null, timelineOpen: false, historyOpen: false,
  personalizationLoading: false, personalizationError: null, finishPayload: null, requestVersion: 0,
  startGame: config => { const initial = { ...clone(config.initialState), status: 'playing' as const }; set({ config: clone(config), game: initial, initialState: clone(initial), finishPayload: null, openBuildingId: null, timelineOpen: false }) },
  advanceOneMonth: () => set(store => {
    if (!store.game || store.game.status !== 'playing') return store
    let game = applyActionPure(store.game, { type: 'advance_month' })
    if (game.monthIndex > 0 && game.monthIndex % 3 === 0 && !game.activeEvent) game = attachEvent(game, buildOpportunity(game))
    if (store.config && game.monthIndex >= store.config.durationMonths) game = applyActionPure(game, { type: 'finish' })
    return { game }
  }),
  dispatchAction: action => set(store => store.game ? { game: applyActionPure(store.game, action) } : store),
  openBuilding: target => set({ openBuildingId: target }), closeBuilding: () => set({ openBuildingId: null }),
  setPaused: paused => get().dispatchAction({ type: paused ? 'pause' : 'resume' }),
  openTimeline: () => set({ timelineOpen: true }), closeTimeline: () => set({ timelineOpen: false }), setHistoryOpen: historyOpen => set({ historyOpen }),
  markNotificationRead: id => set(store => store.game ? { game: { ...store.game, notifications: store.game.notifications.map(n => n.id === id ? { ...n, read: true } : n) } } : store),
  finishGame: () => set(store => {
    if (!store.game || !store.initialState || !store.config) return store
    const finalState = applyActionPure(store.game, { type: 'finish' })
    return { game: finalState, finishPayload: { initialState: clone(store.initialState), finalState: clone(finalState), policyActions: clone(finalState.replayLog), durationMonths: store.config.durationMonths, seed: store.config.seed } }
  }),
  resetGame: () => set(store => ({ game: null, initialState: null, config: null, openBuildingId: null, timelineOpen: false, historyOpen: false, finishPayload: null, requestVersion: store.requestVersion + 1 })),
  generatePersonalized: async prompt => {
    const clean = prompt.trim(); if (!clean) throw new Error('Describe the situation you want to explore.')
    const requestVersion = get().requestVersion + 1; set({ personalizationLoading: true, personalizationError: null, requestVersion })
    try {
      // Agent 1's aiClient can replace this deliberate offline fallback without changing callers.
      await Promise.resolve()
      const config = fallbackConfig(clean)
      if (get().requestVersion !== requestVersion) return { config, fallback: true }
      set({ personalizationLoading: false })
      return { config, fallback: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Personalization is unavailable.'
      if (get().requestVersion === requestVersion) set({ personalizationLoading: false, personalizationError: message })
      throw error
    }
  }
}))

export const selectScenario = (id: string) => scenarioById(id)
export const selectNetWorth = (state: GameStore) => state.game ? state.game.cash + state.game.savings + Object.values(state.game.investments).reduce((a, b) => a + b, 0) - state.game.debts.reduce((a, d) => a + d.balance, 0) : 0
