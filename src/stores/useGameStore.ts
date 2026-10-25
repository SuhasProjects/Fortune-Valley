/**
 * Zustand game store (OWNER: Agent 4; ported onto the canonical engine by Agent 1
 * during integration — no math lives here). Calls engine functions only.
 */
import { create } from 'zustand';
import { advanceMonth, applyAction, compareWithBaseline, createGame, defaultStorage, hasCar, monthLabel, parseSave, runMonteCarlo, netWorthOf, serializeSave, shouldRequestOpportunity, summarizeForAi, SAVE_STORAGE_KEY, type KeyValueStorage } from '@/engine';
import { describeShock, explainOutcome, generateScenario, proposeOpportunity, proposalToEvent, scenarioToConfig } from '@/services/aiClient';

/** One flavour request per shock or life-event notification, keyed by scenario + notification id; survives store resets within a session. */
const flavourRequested = new Set<string>();

/** Offer templates a player sees at most once per run, however the model is prompted. */
const ONE_SHOT_OFFERS = new Set<string>(['change_insurance', 'loan_choice']);
import type { ActionResult, BuildingId, GameAction, GameConfig, GameState, MonteCarloResult, PersonalizedInput, PolicyLogEntry } from '@/types/domain';
import { INSURANCE_PLANS } from '@/config/defaults';
import { askCoach } from '@/services/aiClient';
import type { CoachFacts, CoachTurn } from '@/types/domain';

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
  /** Set when a valid save exists in storage (checked on load and after saves). */
  savedGame: { savedAt: string; title: string; monthIndex: number } | null;
  /** Injectable for tests; null = no persistence available. */
  storage: KeyValueStorage | null;

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
  /** Ask the AI (or offline table) for a news-wire scene for one shock notification; fire-and-forget, never blocks the month. */
  requestShockFlavour(notificationId: string): Promise<void>;
  markAllNotificationsRead(): void;
  clearActionError(): void;
  requestOpportunity(): Promise<void>;
  /** Ask the AI (or offline template) to explain the finish payload; fills finishPayload.explanation. */
  requestExplanation(question?: string): Promise<void>;
  /** Mid-game "explain this" for a salient event or player question; no Monte Carlo involved. */
  requestInsight(question: string): Promise<{ text: string; source: 'ai' | 'fallback' } | null>;
  lastInsight: { monthIndex: number; question: string; text: string; source: 'ai' | 'fallback' } | null;
  /** Coach chat (session only, never saved to disk). */
  coachOpen: boolean;
  coachHistory: CoachTurn[];
  coachLoading: boolean;
  setCoachOpen(open: boolean): void;
  /** Append the question, ask the AI (or offline coach) with the last 4 turns and the open building, append the answer. */
  askCoach(question: string): Promise<CoachTurn | null>;
  finishGame(): void;
  resetGame(): void;
  generatePersonalized(prompt: string, numbers?: Omit<PersonalizedInput, 'freeText'>): Promise<PersonalizationResult>;
  /** Persist the current run (one slot, schema-versioned). Returns false if storage is unavailable. */
  saveGame(): boolean;
  /** Restore the saved run; returns false (and clears a corrupt save) when nothing valid is stored. */
  loadSavedGame(): boolean;
  clearSavedGame(): void;
  /** Re-read storage to refresh `savedGame` (call once on app start). */
  refreshSavedGame(): void;
}

const readSaveMeta = (storage: KeyValueStorage | null): GameStore['savedGame'] => {
  if (!storage) return null;
  try {
    const parsed = parseSave(storage.getItem(SAVE_STORAGE_KEY));
    return parsed.ok ? { savedAt: parsed.save.savedAt, title: parsed.save.config.title, monthIndex: parsed.save.state.monthIndex } : null;
  } catch {
    return null;
  }
};

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
  savedGame: null,
  storage: defaultStorage(),
  lastInsight: null,
  coachOpen: false,
  coachHistory: [],
  coachLoading: false,

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
      coachOpen: false,
      coachHistory: [],
      coachLoading: false,
      requestVersion: s.requestVersion + 1,
    }));
  },

  advanceOneMonth: () => {
    const { game } = get();
    if (!game || game.status !== 'playing') return;
    const next = advanceMonth(game);
    set({ game: next });
    get().saveGame();
    for (const n of next.notifications) if (n.shockKind && !n.flavour && n.monthIndex === game.monthIndex) void get().requestShockFlavour(n.id);
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
  requestShockFlavour: async (notificationId) => {
    const { game, config, requestVersion } = get();
    const n = game?.notifications.find((x) => x.id === notificationId);
    if (!game || !config || !n?.shockKind || n.flavour) return;
    const key = `${game.scenarioId}:${notificationId}`;
    if (flavourRequested.has(key)) return;
    flavourRequested.add(key);
    const input = { kind: n.shockKind, amount: n.shockKind === 'life' ? (n.amountSigned ?? 0) : Math.max(0, -(n.amountSigned ?? 0)), monthLabel: monthLabel(game.startMonth, n.monthIndex), archetype: config.archetype, housingKind: game.household.housingKind, hasCar: hasCar(game), employment: game.employment.status };
    try {
      const r = await describeShock(input, notificationId);
      const current = get();
      if (!current.game || current.requestVersion !== requestVersion || current.game.scenarioId !== game.scenarioId) return;
      const flavour = { headline: r.headline, scene: r.scene, source: r.source };
      set({
        game: {
          ...current.game,
          notifications: current.game.notifications.map((x) => (x.id === notificationId ? { ...x, flavour } : x)),
          timeline: n.eventId ? current.game.timeline.map((t) => (t.eventId === n.eventId && t.type === 'shock' ? { ...t, flavour } : t)) : current.game.timeline,
        },
        ...(r.source === 'ai' ? { aiStatus: 'online' as const } : {}),
      });
    } catch { /* toast keeps the engine text */ }
  },
  markAllNotificationsRead: () => { get().dispatchAction({ type: 'mark_notifications_read' }); },
  clearActionError: () => set({ lastActionError: null }),

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
      // Hard guard behind the prompt: an offer the player already saw (insurance especially) is never shown twice.
      const seen = new Set(current.game.offeredTemplates ?? []);
      if (result.proposal.options.some((o) => o.effect.template !== 'none' && seen.has(o.effect.template) && ONE_SHOT_OFFERS.has(o.effect.template))) return;
      const event = proposalToEvent(result.proposal, current.game, result.source);
      if (event) get().dispatchAction({ type: 'enqueue_event', event });
    } catch {
      const current = get();
      if (current.requestVersion === requestVersion && current.game?.scenarioId === scenarioId) set({ aiStatus: 'offline' });
    }
  },

  setCoachOpen: (coachOpen) => set({ coachOpen }),
  askCoach: async (question) => {
    const { game, config, requestVersion, coachLoading } = get();
    if (!game || !config || coachLoading) return null;
    const q = question.trim().slice(0, 300);
    if (!q) return null;
    const history = get().coachHistory;
    set({ coachHistory: [...history, { role: 'user', text: q }], coachLoading: true });
    try {
      const summary = summarizeForAi(game, config.narrativeFocus, config.archetype);
      const facts: CoachFacts = {
        savingsApy: game.assumptions.savingsApy,
        debts: game.debts.map((d) => ({ name: d.name, kind: d.kind, balance: d.balance, apr: d.apr, minimumPayment: d.minimumPayment })),
        insurance: INSURANCE_PLANS.filter((p) => Object.values(game.insurance).includes(p.id)).map((p) => ({ line: p.line, name: p.name, monthlyPremium: p.monthlyPremium, deductible: p.deductible, coinsurance: p.coinsurance })),
      };
      const result = await askCoach(summary, q, history.slice(-4), get().openBuildingId, facts);
      if (get().requestVersion !== requestVersion) return null;
      const turn: CoachTurn = { role: 'coach', text: result.text, source: result.source };
      set((s) => ({ coachHistory: [...s.coachHistory, turn], coachLoading: false, aiStatus: result.source === 'ai' ? 'online' : 'offline' }));
      return turn;
    } catch {
      if (get().requestVersion === requestVersion) set({ coachLoading: false });
      return null;
    }
  },

  requestInsight: async (question) => {
    const { game, config, requestVersion } = get();
    if (!game || !config) return null;
    const q = question.trim().slice(0, 500);
    if (!q) return null;
    const summary = summarizeForAi(game, config.narrativeFocus, config.archetype);
    const result = await explainOutcome(summary, q);
    if (get().requestVersion !== requestVersion) return null;
    const insight = { monthIndex: game.monthIndex, question: q, text: result.text, source: result.source };
    set({ lastInsight: insight, aiStatus: result.source === 'ai' ? 'online' : 'offline' });
    return { text: result.text, source: result.source };
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

  saveGame: () => {
    const { game, config, storage } = get();
    if (!game || !config || !storage) return false;
    try {
      storage.setItem(SAVE_STORAGE_KEY, serializeSave(config, game));
      set({ savedGame: { savedAt: new Date().toISOString(), title: config.title, monthIndex: game.monthIndex } });
      return true;
    } catch {
      return false;
    }
  },
  loadSavedGame: () => {
    const { storage } = get();
    if (!storage) return false;
    let parsed: ReturnType<typeof parseSave>;
    try { parsed = parseSave(storage.getItem(SAVE_STORAGE_KEY)); } catch { return false; }
    if (!parsed.ok) { get().clearSavedGame(); return false; }
    const { config, state } = parsed.save;
    set((s) => ({ config: structuredClone(config), game: structuredClone(state), finishPayload: null, openBuildingId: null, timelineOpen: false, historyOpen: false, lastActionError: null, aiStatus: 'idle', coachOpen: false, coachHistory: [], coachLoading: false, requestVersion: s.requestVersion + 1, savedGame: { savedAt: parsed.save.savedAt, title: config.title, monthIndex: state.monthIndex } }));
    return true;
  },
  clearSavedGame: () => {
    try { get().storage?.removeItem(SAVE_STORAGE_KEY); } catch { /* ignore */ }
    set({ savedGame: null });
  },
  refreshSavedGame: () => set((s) => ({ savedGame: readSaveMeta(s.storage) })),

  resetGame: () => set((s) => ({ game: null, config: null, lastInsight: null, coachOpen: false, coachHistory: [], coachLoading: false, openBuildingId: null, timelineOpen: false, historyOpen: false, finishPayload: null, lastActionError: null, aiStatus: 'idle', requestVersion: s.requestVersion + 1 })),

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
