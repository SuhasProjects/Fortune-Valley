# Integration contract

Read `src/types/domain.ts` first; this page is the map. Shapes change only with updated fixtures and a note in the PR.
Path alias `@/` → `src/`. Run `npm run typecheck && npm test` before every PR; `npm run test:browser` before pushing UI.

## Import map

| Need | Import |
|---|---|
| All types | `import type { GameState, GameConfig, GameAction, Policy, GameEvent, MonteCarloResult, OutcomeLines, DecisionChoice, WhatIfInput, WhatIfResult, ... } from '@/types/domain'` |
| Engine API | `import { createGame, advanceMonth, applyAction, runMonteCarlo, compareStrategies, compareWithBaseline, netWorthOf, monthLabel, previewMonth, previewHorizon, ... } from '@/engine'` |
| Ending API | `import { outcomeLines, listDecisions, runWhatIfAsync, runWhatIf, changedPolicyLog } from '@/engine'` |
| Selectors (derived values, AI summary, trigger rule) | `import { selectMonthsOfEssentialsCovered, selectPaySummary, selectPendingOpportunities, summarizeForAi, shouldRequestOpportunity } from '@/engine'` |
| Assumptions & plan catalog | `import { DEFAULT_ASSUMPTIONS, INSURANCE_PLANS, BOUNDS, DISCLAIMER } from '@/config/defaults'` |
| Four starting lives | `import { ARCHETYPES, archetypeConfig } from '@/config/archetypes'`; wrapped for the picker in `src/data/scenarios.ts` (`scenarios`, `scenarioCards`, `freshScenario`, `scenarioById`) |
| AI client (always resolves; offline fallback built in) | `import { generateScenario, proposeOpportunity, explainOutcome, scenarioToConfig, proposalToEvent } from '@/services/aiClient'` |
| Fixtures (engine-computed, not hand-typed) | `import { fixtureConfig, fixtureState, fixtureFinishedState, fixtureEventB, fixtureMonteCarlo } from '@/fixtures'` |
| Store | `import { useGameStore, selectNetWorth, selectDebtTotal, selectPendingEvent, type FinishPayload } from '@/stores/useGameStore'` |
| Stage, world, sprites | `import { GameStage, useStageScale } from '@/game/stage/GameStage'`; `import { TownWorld } from '@/game/world/TownWorld'`; `import { BUILDINGS, BUILDING_IDS } from '@/game/world/landmarks'`; `import { Sprite, BuildingPortrait } from '@/game/art/Sprite'`; `import { SPRITES, type SpriteName } from '@/game/art/manifest'` |
| UI kit | `import { Board, Window, Modal, Button, IconButton, Field, NumberField, Select, Slider, Toggle, Tabs, Tooltip, Icon, Money, Plaque, Tag, Inset, Divider, ScrollArea, WoodFrame, useReducedMotion } from '@/ui'` |
| HUD | `import { Hud, ControlBar, StatusTag, HudFooter } from '@/game/hud'` |
| Settings, sound | `import { useSettings, setSetting, OptionsWindow } from '@/game/settings'`; `import { sfx } from '@/game/audio/sfx'` |
| Formatting | `import { usd, monthLabel } from '@/components/flow/format'` (format only; never compute money in UI) |

## Public screen and component contracts

These are the contracts from the build plan (`docs/agents/README.md` §9) as they actually landed. Where the code
differs from the plan it is marked **(differs)**.

```ts
// src/game/stage/GameStage.tsx
export function GameStage(props: { world: ReactNode; label: string; children?: ReactNode }): JSX.Element
//   fixed full-viewport .fv-stage; sets --px, --view-w, --view-h; children = UI layer above the world
export function useStageScale(): { px: number; viewW: number; viewH: number }
// src/game/stage/scale.ts
export const CORE_W = 320, CORE_H = 180, MAP_W = 480, MAP_H = 288, CORE_OFFSET_X = 80, CORE_OFFSET_Y = 54, MIN_SCALE = 1
export function stageScale(width: number, height: number): StageScale

// src/game/world/TownWorld.tsx
export interface TownWorldProps {
  onBuildingClick?: (id: BuildingId) => void   // omitted = decorative, non-interactive (reveal backdrop)
  eventBuildings?: BuildingId[]                 // "!" badge + ". Decision waiting" in the accessible name
  openBuilding?: BuildingId | null              // steady hover highlight
  timeOfDay?: 'day' | 'dusk'
  monthIndex?: number                           // accepted, currently unused (reserved for the Town Office clock)
}
// src/game/world/landmarks.ts
export const BUILDINGS: Record<BuildingId, { title: string; hint: string }>
export const BUILDING_IDS: BuildingId[]
// src/game/world/layout.ts: BUILDING_LAYOUT, PROPS, SMOKE, LAMP, FIREFLIES (art-px positions on the 480x288 map)

// src/game/art/Sprite.tsx
export function Sprite(props: { name: SpriteName; frame?: number | string; animate?: boolean; className?: string; label?: string; style?: CSSProperties }): JSX.Element
//   frame may be a variant name: 'hover' | 'lit' | 'lights'. label omitted = aria-hidden.
export function BuildingPortrait(props: { building: BuildingId }): JSX.Element
// src/game/art/manifest.ts (generated): SPRITES, SpriteName, SpriteMeta { src, w, h, frames, anchor?, slice?, speed? }

// src/ui/index.ts
export { Board, WoodFrame, Window, Modal, Button, IconButton, Plaque, Tag, Inset, Field, NumberField, Select, Slider,
         Toggle, Tabs, Tooltip, Icon, iconNames, Money, Divider, ScrollArea, useReducedMotion, setUiReducedMotion }
// Modal: native <dialog>, focus trap, Escape, backdrop click, restores focus, locks body scroll.
//   Props: { title; onClose; children; width?: 'sm'|'md'|'lg'; plaque?: ReactNode; headerExtra?: ReactNode }
//   Dialog accessible name = title; close button accessible name = "Close panel".
// Window: same without dialog behaviour (onClose optional). Icon: { name: IconName; size?: 10|16; label?; compact? }.

// src/game/hud/index.ts
export function Hud(props: { onOpenTimeline: () => void }): JSX.Element     // reads the store
export function ControlBar(props: ControlBarProps): JSX.Element            // { status, onAdvance, onPause(paused), onFinish, secondsRemaining?, autoAdvanceEnabled?, blocked?, onToggleAuto? }
export function StatusTag(): JSX.Element                                   // OFFLINE READY / AI CONNECTED / PREPARING OPPORTUNITY / PAUSED / STORY COMPLETE
export function HudFooter(): JSX.Element

// src/game/settings/index.ts
export function useSettings(): Settings   // { autoAdvanceSeconds: 0|30|60|120, lastAutoAdvanceSeconds, sound, reduceMotion, tips, tipsSeen } persisted in localStorage
export function setSetting<K extends SettingKey>(key: K, value: Settings[K]): void
export function OptionsWindow(props: { onClose: () => void; onDeleteSave?: () => void }): JSX.Element   // (differs: extra optional onDeleteSave)
// src/game/audio/sfx.ts
export function sfx(name: 'click'|'open'|'close'|'coin'|'month'|'alert'|'reveal'): void   // no-op when sound is off

// Building windows (src/components/panels/BuildingWindow.tsx): Modal named after the building, portrait, roof band,
//   keeper greeting, that building's <EventCard>s and its engine-backed panel. GameScreen still mounts the older
//   <PanelHost building onClose> + <ConnectedBuildingPanel/> pair until the flow switches to BuildingWindow.
export function BuildingWindow(props: { building: BuildingId; onClose: () => void }): JSX.Element
export function PanelHost(props: { building?: BuildingId; title?: string; onClose: () => void; children: ReactNode }): JSX.Element
export function ConnectedBuildingPanel(props: { building: BuildingId }): JSX.Element   // reads the store, dispatches actions
// Canonical panel API (src/components/panels/index.ts): BuildingPanel { building, state, dispatch }, panelRegistry

// src/game/title/TitleScreen.tsx, src/game/title/GuideWindow.tsx
export function TitleScreen(): JSX.Element                       // starts games through the store itself
export function GuideWindow(props: { onClose: () => void }): JSX.Element   // dialog "Guide", five chapters as tabs
// src/game/reveal/RevealScreen.tsx
export function RevealScreen(props: { payload: FinishPayload; onPlayAgain: () => void }): JSX.Element
export function OutcomeChart(props: { lines: ChartLines; yDomain: [number, number]; title: string; highlightLabel?: string }): JSX.Element

// src/App.tsx (differs from the plan's "screen router")
export default function App(props: { panels?: Partial<Record<BuildingId, ReactNode>>; renderReveal?: (payload: FinishPayload) => ReactNode }): JSX.Element
//   ?dev=engine → EngineHarness; ?dev=ui → UiGallery; !store.game → Landing (= TitleScreen alias);
//   store.finishPayload → PanelHost("Your next chapter") around RevealChart (= RevealScreen alias); else GameScreen.
```

Known deviations from `docs/agents/README.md` §9, in one place:

| Plan | Code |
|---|---|
| `GameScreen` mounts `BuildingWindow` | `BuildingWindow` exists; `GameScreen` still mounts `PanelHost` + `ConnectedBuildingPanel` + `EventCard`. |
| `App` routes `TitleScreen` / `RevealScreen` directly | `App` still imports `Landing` and `RevealChart`, which are one-line aliases to them; the reveal is mounted inside a `PanelHost`. |
| `GuideWindow` also opened from the pause menu | The pause menu's Guide is a plain `PanelHost` with one line of shortcuts; `GuideWindow` is used on the title only. |
| `Sprite.frame?: number` | `number \| string` (variant names), plus a `style` prop. |
| `useSettings()` shape | Two extra persisted fields: `lastAutoAdvanceSeconds`, `tipsSeen`. |
| `OptionsWindow({ onClose })` | Extra optional `onDeleteSave`. |
| Engine ending API | As planned, plus `runWhatIf` (sync core) and `changedPolicyLog` are exported too. |

## Stable accessible names (tests rely on these)

| Element | Accessible name | Source |
|---|---|---|
| Stage | group `Fortune Valley town` (game), main `Fortune Valley` (title), main `Simulation results` (reveal) | `GameScreen`, `TitleStage` |
| Town | section `Fortune Valley. Choose a building to manage your money.` | `TownWorld` |
| Building buttons | starts with `Open Pine Bank:` / `Open Town Office:` / `Open Health House:` / `Open Your Home:` / `Open Market Hall:`; ends with `. Decision waiting` when an event is pending; badge `Decision waiting` | `TownWorld` |
| Building windows | dialog `Pine Bank`, `Town Office`, `Health House`, `Your Home`, `Market Hall` | `PanelHost` → `Modal` |
| Window close | button `Close panel` | `Window` |
| HUD | region `Financial overview`; text `Month n / N`; button `Timeline` | `Hud` |
| Clock | group `Time controls`; buttons containing `Next month`, `Pause` / `Resume`, `Finish & reveal`, `Auto on` / `Auto off`; timer text `Next month in` / `Auto-time off` / `Decision waiting` | `ControlBar` |
| Status | status `OFFLINE READY` … ; button `Open pause menu` | `StatusTag`, `GameScreen` |
| Timeline / activity | dialogs `Your timeline`, `Town activity`; button `View all activity` | `TimelineWindow`, `ActivityWindow`, `ToastStack` |
| Toast region | `Recent financial activity` | `ToastStack` |
| Menus | dialogs `Paused`, `Options`, `Guide`, `Finish early?` (button `Finish now`); title menu group `Main menu` with buttons `New Story`, `Custom Story`, `Continue`; title corner buttons `Options`, `Guide` | `GameScreen`, `TitleScreen` |
| Title | heading `Fortune Valley`; story buttons containing the life title (`College Student`, `Entry-Level Worker`, `Professional`, `Young Family`) | `TitleScreen`, `StoryPicker` |
| Reveal | heading `You finished month N with …`; text `Same strategy, 1,000 futures`; chart group `Your 1,000 futures: four ending net worth lines` with line buttons `Unlucky`, `Typical`, `Lucky`, `What actually happened`; field `Ask about your results`, button `Ask`; button `Choose a new story` | `RevealScreen`, `OutcomeChart` |
| Panel internals | everything asserted in `src/components/panels/panels.browser.ts` and `canonical/panels.test.tsx` | panels |

`tests/helpers.ts` (`openTitle`, `startStory`, `expectReveal`, `leaveReveal`) is the only way browser tests start and
finish a game; change the title or reveal and update the helpers in the same PR.

## File ownership summary

| Area | Paths |
|---|---|
| Engine, types, config, services, gateway, infra, docs | `src/engine/**`, `src/types/domain.ts`, `src/config/**`, `src/fixtures/**`, `src/services/**`, `src/dev/**`, `api/**`, `server/**`, `tests/engine/**`, `tests/art/**`, `package.json`, `vite.config.ts`, `tsconfig*.json`, `playwright.config.ts`, `vercel.json`, `.github/**`, `docs/**`, `README.md` |
| Stage, world, art pipeline | `src/game/stage/**`, `src/game/world/**`, `src/game/art/**`, `scripts/art/**`, `art-src/palette.json`, `art-src/world/**`, `public/art/world/**`, `src/styles/palette.css` (generated), `tests/world.browser.ts` |
| UI kit and HUD | `src/ui/**`, `src/game/hud/**`, `art-src/ui/**`, `public/art/ui/**`, `src/styles/index.css`, `src/styles/pixel-tokens.css`, `tests/hud.browser.ts` |
| Building panels | `src/components/panels/**`, `src/components/town/PanelHost.tsx`, `src/components/flow/EventCard.tsx` |
| Game flow | `src/App.tsx`, `src/main.tsx`, `src/game/GameScreen.tsx`, `src/game/flow/**`, `src/game/settings/**`, `src/game/audio/**`, `src/components/flow/**` (except `EventCard.tsx`), `src/hooks/**`, `src/stores/**`, `src/styles/game-viewport.css`, `tests/town.browser.ts` |
| Title and reveal | `src/game/title/**`, `src/game/reveal/**`, `src/components/landing/**`, `src/components/reveal/**`, `src/data/scenarios.ts`, `art-src/title/**`, `public/art/title/**`, `index.html`, `tests/helpers.ts`, `tests/title.browser.ts`, `tests/reveal.browser.ts` |

Full per-agent table: `docs/agents/README.md` §10. Only the engine owner edits `package.json`.

## Engine signatures

```ts
createGame(config: GameConfig): GameState                       // throws on invalid config
advanceMonth(state: GameState, opts?: { lean?, inPlace?, rng? }): GameState   // pure; status 'finished' or 'paused' → returns input
applyAction(state: GameState, action: GameAction): ActionResult // { ok:true, state } | { ok:false, code, message, state: original }
runMonteCarlo(config, policyLog, observedState, { paths?=1000, seed?=config.seed, months? }): MonteCarloResult
compareStrategies(config, logA, logB, { a, b }, { months, paths?, seed? }): MonteCarloComparison
compareWithBaseline(config, policyLog, months, { paths?, seed? }): MonteCarloComparison | undefined
previewMonth(state, { policy?, household?, insurance? }): MonthPreview      // baseline vs withChange vs delta, same seeds
previewHorizon(state, overrides, months): …                                // 12-month runway with monthsUntilShortfall
netWorthOf(state) === cash + savings + stock + bond + etf − Σ debts        // the only definition of net worth
```

`advance_month` is NOT handled by `applyAction` (it returns `invalid_status`); call `advanceMonth`. The store wraps both.

## Ending engine API

Owner: engine. The reveal calls these directly (`src/game/reveal/ending-contract.ts` re-exports them as `endingApi`).
The UI does no arithmetic on the results, not even the deltas.

```ts
export interface OutcomeLines {
  months: number; start: number;               // line origin (0, start)
  p10: number; median: number; p90: number;    // endings: "unlucky", "typical", "lucky"
  yourEvents: number;                          // the player's exact game (original: observed; what-if: exact replay with the change)
  spread: number;                              // p90 − p10
}
export function outcomeLines(mc: MonteCarloResult, startNetWorth: number): OutcomeLines   // pure, from existing fields

export interface DecisionAlternative { id: string; label: string }
export interface DecisionChoice {
  id: string;                  // `${policyLogIndex}`, or 'all'
  logIndex: number | null;     // null for 'all'
  monthIndex: number | null;
  label: string;               // "Month 3 · Save $300/month"
  alternatives: DecisionAlternative[];   // never empty; always includes an undo ("Keep …", "Don't make this payment")
}
export function listDecisions(config: GameConfig, policyLog: PolicyLogEntry[]): DecisionChoice[]
//   Every entry hasPolicyDecisions treats as a decision, in month order, prefixed by
//   { id:'all', alternatives:[{ id:'defaults', label:'Never change anything (default plan)' }] } when any exist.
//   Alternatives: contributions/budget/extra payment/cash buffer at half and double (clamped to BOUNDS); allocation
//   presets all-etf / all-bonds / 60-40; every other insurance plan on that line; every other option of an event.

export interface WhatIfInput {
  config: GameConfig; policyLog: PolicyLogEntry[]; finishMonteCarlo: MonteCarloResult;
  startNetWorth: number; observedNetWorth: number; decisionId: string; alternativeId: string;
}
export interface WhatIfResult {
  decisionLabel: string; alternativeLabel: string;
  original: OutcomeLines; changed: OutcomeLines;
  delta: { p10: number; median: number; p90: number; yourEvents: number; spread: number };  // changed − original
  yourEventsComparable: boolean;   // false if replaying the unchanged log on config.seed misses the observed ending by > $1
  replayFallbacks: number;         // later decisions that could not apply in some changed futures
}
export function changedPolicyLog(config, policyLog, decisionId, alternativeId): { log; decisionLabel; alternativeLabel }
export function runWhatIf(input: WhatIfInput): WhatIfResult                                    // sync core (tests)
export function runWhatIfAsync(input: WhatIfInput, signal?: AbortSignal): Promise<WhatIfResult> // module Web Worker; main-thread setTimeout fallback where Worker is unavailable; results cached per policyLog
```

Guarantees: the changed run uses `finishMonteCarlo.seed`, `pathsRequested` and `months`, so the only difference between
the two charts is the decision. Aborting rejects with an `AbortError` and terminates the worker. Same input → identical
output (`round2` everywhere). `PolicyLogEntry.alternatives` (recorded by `applyAction` for `apply_event_option`) is what
makes other event options replayable; saves without it only offer undo.

Inputs come from `FinishPayload` (`src/stores/useGameStore.ts`):
`{ config, finalState, policyLog, monteCarlo, explanation?: { text, source: 'ai'|'fallback' } }`, with
`startNetWorth = finalState.netWorthHistory[0]` and `observedNetWorth = monteCarlo.observedNetWorth`.

## Who does what (UI ↔ engine)

- **Panels** are controlled components: read from `useGameStore(s => s.game)` and call `dispatchAction(action)`. Use
  `netWorthOf`, `selectMonthsOfEssentialsCovered`, `annualWithholding(state, salary)` / `selectPaySummary` (Office),
  `activePlan(state, line)` / `settleClaim(cost, plan)` (Health House), `state.marketState` + `state.assumptions.assets`
  (Market), `previewMonth` / `previewHorizon` for the "what happens next" insets.
  - Bank: `transfer`, `make_extra_payment`, `set_extra_debt_payment`, `set_contributions` (savings part), `set_min_cash_buffer`.
  - Market: `set_allocation` (weights sum to 1), `set_contributions` (investment part).
  - Office: read-only salary, withholding, employment status; Type B job offers appear here.
  - Home: `set_budget` (discretionary), `set_housing`.
  - Health House: `set_insurance(line, planId|null)` from `state.assumptions.insurancePlans`; claims in `state.realizedShocks`.
- **Flow**: notifications = `state.notifications`; timeline = `state.timeline` (every entry has `netWorthAfter`); events =
  `state.activeEvents` (Type A are acknowledgements, Type B are decisions; `expiresAtMonth` inclusive). Dispatch
  `apply_event_option` / `dismiss_event`. `store.requestInsight(question)` gives a mid-game "why did this happen?" answer.
- **Reveal**: everything above under *Ending engine API*. `finishPayload.explanation` is filled asynchronously by
  `requestExplanation()` (called by `finishGame()`); `requestExplanation(question)` replaces it with an answer.
  `monteCarlo.comparison` (paired default-policy run) is still computed and available. Never describe
  `percentileOfObserved` as a score.

## Actions (discriminated union)

`advance_month · set_allocation · set_budget · set_housing · set_insurance · set_contributions · set_extra_debt_payment · set_min_cash_buffer · make_extra_payment · transfer · apply_event_option · dismiss_event · enqueue_event · mark_notifications_read · pause · resume · finish`

Error codes: `invalid_allocation · invalid_amount · insufficient_funds · unknown_debt · unknown_plan · unknown_event · unknown_option · event_expired · invalid_status · invalid_effect · duplicate_event · game_finished`. On error the returned `state` is the untouched input.

## Events

- Type A (engine): produced inside `advanceMonth`; money already applied; one option `ack` with effect `none`.
- Type B (AI or fallback): `proposeOpportunity(summary)` → `proposalToEvent(proposal, state, source)` →
  `dispatchAction({ type:'enqueue_event', event })`. Effects are whitelisted templates (`offer_job, change_housing,
  change_insurance, budget_choice, loan_choice, contribution_choice, none`) with engine-validated bounds. When the player
  picks an option the engine logs `resolvedEffect`, `label` and the unpicked `alternatives`, so Monte Carlo and the
  what-if can replay the decision.
- Trigger rule: `shouldRequestOpportunity(prev, next)`: every 3 months, after a shock, employment change, debt payoff, or
  net-worth $5k band crossing; never while a Type B is pending. The store already does this.

## AI gateway

`POST /api/ai` with body `AiRequest` → `AiResponse` or `AiErrorResponse` (see domain.ts and [AI_API.md](AI_API.md)).
Env (server only): `AI_API_KEY`, `AI_MODEL`, `AI_PROVIDER`, `AI_BASE_URL`, `AI_AUTH_HEADER`, `AI_ENABLED`, `AI_TIMEOUT_MS`.
`VITE_AI_OFFLINE=true` forces the client fallback. Browser code never sees the key.

## Save & resume (one slot)

The store autosaves after every month (`saveGame()`), exposes `savedGame` metadata for the title's **Continue** button,
`loadSavedGame()`, `clearSavedGame()` and `refreshSavedGame()` (called at app start). Saves are schema-versioned
(`SAVE_SCHEMA_VERSION`), validated and reconciled on load; anything invalid is discarded. Storage is `localStorage`
when available, otherwise persistence is silently off. Settings live separately under `fortune-valley-settings-v1`.

## Theme

Colours are the `--c-<name>` variables in `src/styles/palette.css`, generated from `art-src/palette.json` (keys and
names in [ART_PIPELINE.md](ART_PIPELINE.md)). Money: `--c-money-up`, `--c-money-down`, neutral `--c-outline`. Fonts and
sizes are tokens in `src/ui/tokens.css`, all in `--px` multiples. Chart colours on the reveal: lucky `--c-money-up`,
typical `--c-outline`, unlucky `--c-money-down`, your line `--c-gold`. Integer pixel scaling only;
`image-rendering: pixelated` on every sprite. `src/styles/pixel-tokens.css` (`--ft-*`) is legacy and only still
imported by older components.
