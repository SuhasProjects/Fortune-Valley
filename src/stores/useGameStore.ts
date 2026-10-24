/**
 * Zustand game store (OWNER: Agent 4; ported onto the canonical engine by Agent 1
 * during integration — no math lives here). Calls engine functions only.
 */
import { create } from 'zustand';
import { advanceMonth, applyAction, compareWithBaseline, createGame, runMonteCarlo, netWorthOf, shouldRequestOpportunity, summarizeForAi } from '@/engine';
import { explainOutcome, generateScenario, proposeOpportunity, proposalToEvent, scenarioToConfig } from '@/services/aiClient';
import type { ActionResult, BuildingId, GameAction, GameConfig, GameState, MonteCarloResult, PersonalizedInput, PolicyLogEntry } from '@/types/domain';

export interface FinishPayload {
  config: GameConfig;
  finalState: GameState;
  policyLog: PolicyLogEntry[];
  monteCarlo: MonteCarloResult;
  /** Explanation text for the reveal; `source` says whether it came from the AI or the offline template. */
  explanation?: { text: string; source: 'ai' | 'fallback' };
}
export interface PersonalizationResult { config: GameConfig; fallback: boolean; warnings: string[] }

export interface GameStore {
  game: GameState | null;
  config: GameConfig | null;
  openBuildingId: BuildingId | null;
  timelineOpen: boolean;
  historyOpen: boolean;
  personalizationLoading: boolean;
  personalizationError: string | null;
  lastActionError: string | null;
  aiStatus: 'idle' | 'loading' | 'online' | 'offline';
  finishPayload: FinishPayload | null;
  requestVersion: number;

  startGame(config: GameConfig): void;
  advanceOneMonth(): void;
  dispatchAction(action: GameAction): ActionResult | null;
  openBuilding(target: BuildingId): void;
  closeBuilding(): void;
  setPaused(paused: boolean): void;
  openTimeline(): void;
  closeTimeline(): void;
  setHistoryOpen(open: boolean): void;
  markNotificationRead(id: string): void;
  markAllNotificationsRead(): void;
  requestOpportunity(): Promise<void>;
  /** Ask the AI (or offline template) to explain the finish payload; fills finishPayload.explanation. */
  requestExplanation(question?: string): Promise<void>;
  finishGame(): void;
  resetGame(): void;
  generatePersonalized(prompt: string, numbers?: Omit<PersonalizedInput, 'freeText'>): Promise<PersonalizationResult>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  config: null,
  openBuildingId: null,
  timelineOpen: false,
  historyOpen: false,
  personalizationLoading: false,
  personalizationError: null,
  lastActionError: null,
  aiStatus: 'idle',
  finishPayload: null,
  requestVersion: 0,

  startGame: (config) => {
    const game = createGame(config);
    const started = applyAction(game, { type: 'resume' });
    set((s) => ({
      config: structuredClone(config),
      game: started.ok ? started.state : game,
      finishPayload: null,
      openBuildingId: null,
      timelineOpen: false,
      historyOpen: false,
      personalizationLoading: false,
      personalizationError: null,
      lastActionError: null,
      aiStatus: 'idle',
      requestVersion: s.requestVersion + 1,
    }));
  },

  advanceOneMonth: () => {
    const { game } = get();
    if (!game || game.status !== 'playing') return;
    const next = advanceMonth(game);
    set({ game: next });
    if (shouldRequestOpportunity(game, next)) {
      void get().requestOpportunity();
    }
  },

  dispatchAction: (action) => {
    const { game } = get();
    if (!game) return null;
    if (action.type === 'advance_month') { get().advanceOneMonth(); return null; }
    const r = applyAction(game, action);
    set(r.ok ? { game: r.state, lastActionError: null } : { lastActionError: r.message });
    return r;
  },

  openBuilding: (target) => set({ openBuildingId: target }),
  closeBuilding: () => set({ openBuildingId: null }),
  setPaused: (paused) => { get().dispatchAction({ type: paused ? 'pause' : 'resume' }); },
  openTimeline: () => set({ timelineOpen: true }),
  closeTimeline: () => set({ timelineOpen: false }),
  setHistoryOpen: (historyOpen) => set({ historyOpen }),
  markNotificationRead: (id) => set((s) => (s.game ? { game: { ...s.game, notifications: s.game.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) } } : s)),
  markAllNotificationsRead: () => { get().dispatchAction({ type: 'mark_notifications_read' }); },

  requestOpportunity: async () => {
    const { game, config, requestVersion, aiStatus } = get();
    if (!game || !config || aiStatus === 'loading' || game.activeEvents.some((event) => event.type === 'B')) return;
    const scenarioId = game.scenarioId;
    const monthIndex = game.monthIndex;
    set({ aiStatus: 'loading' });
    try {
      const summary = summarizeForAi(game, config.narrativeFocus, config.archetype);
      const result = await proposeOpportunity(summary);
      const current = get();
      if (!current.game || current.requestVersion !== requestVersion || current.game.scenarioId !== scenarioId || current.game.monthIndex !== monthIndex || current.game.status === 'finished') return;
      set({ aiStatus: result.source === 'ai' ? 'online' : 'offline' });
      if (!result.proposal || current.game.activeEvents.some((event) => event.type === 'B')) return;
      const event = proposalToEvent(result.proposal, current.game, result.source);
      if (event) get().dispatchAction({ type: 'enqueue_event', event });
    } catch {
      const current = get();
      if (current.requestVersion === requestVersion && current.game?.scenarioId === scenarioId) set({ aiStatus: 'offline' });
    }
  },

  requestExplanation: async (question = 'What do these results mean for my strategy?') => {
    const { finishPayload, config, requestVersion } = get();
    if (!finishPayload || !config) return;
    const summary = summarizeForAi(finishPayload.finalState, config.narrativeFocus, config.archetype);
    const result = await explainOutcome(summary, question, finishPayload.monteCarlo);
    const current = get();
    if (!current.finishPayload || current.requestVersion !== requestVersion) return;
    set({ finishPayload: { ...current.finishPayload, explanation: { text: result.text, source: result.source } }, aiStatus: result.source === 'ai' ? 'online' : 'offline' });
  },

  finishGame: () => {
    const { game, config } = get();
    if (!game || !config) return;
    const r = game.status === 'finished' ? { ok: true as const, state: game } : applyAction(game, { type: 'finish' });
    const finalState = r.ok ? r.state : game;
    const base = runMonteCarlo(config, finalState.policyLog, finalState);
    // Paired counterfactual: same luck, player's decisions vs the default policy untouched.
    const comparison = compareWithBaseline(config, finalState.policyLog, base.months, { paths: base.pathsRequested, seed: base.seed });
    const monteCarlo = comparison ? { ...base, comparison } : base;
    set((s) => ({ game: finalState, finishPayload: { config: structuredClone(config), finalState, policyLog: finalState.policyLog, monteCarlo }, aiStatus: 'idle', requestVersion: s.requestVersion + 1 }));
    void get().requestExplanation();
  },

  resetGame: () => set((s) => ({ game: null, config: null, openBuildingId: null, timelineOpen: false, historyOpen: false, finishPayload: null, lastActionError: null, aiStatus: 'idle', requestVersion: s.requestVersion + 1 })),

  generatePersonalized: async (prompt, numbers = {}) => {
    const clean = prompt.trim();
    if (!clean) throw new Error('Describe the situation you want to explore.');
    const requestVersion = get().requestVersion + 1;
    set({ personalizationLoading: true, personalizationError: null, requestVersion });
    try {
      const res = await generateScenario({ freeText: clean.slice(0, 2000), ...numbers });
      const seed = (Date.now() ^ 0x5bd1e995) >>> 0;
      const config = scenarioToConfig(res.proposal, seed, res.source);
      if (get().requestVersion === requestVersion) set({ personalizationLoading: false, aiStatus: res.source === 'ai' ? 'online' : 'offline' });
      return { config, fallback: res.source === 'fallback', warnings: res.warnings };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Personalization is unavailable.';
      if (get().requestVersion === requestVersion) set({ personalizationLoading: false, personalizationError: message });
      throw error;
    }
  },
}));

export const selectNetWorth = (s: GameStore): number => (s.game ? netWorthOf(s.game) : 0);
export const selectDebtTotal = (s: GameStore): number => (s.game ? s.game.debts.reduce((a, d) => a + d.balance, 0) : 0);
export const selectPendingEvent = (s: GameStore) => s.game?.activeEvents.find((e) => e.type === 'B') ?? s.game?.activeEvents[0] ?? null;
