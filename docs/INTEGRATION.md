# Integration contract (Agent 1 — schema owner)

Read `src/types/domain.ts` first; this page is the map. Changes to shapes are announced + land with updated fixtures.

## Import map

| Need | Import |
|---|---|
| All types | `import type { GameState, GameConfig, GameAction, Policy, GameEvent, MonteCarloResult, ... } from '@/types/domain'` |
| Engine API | `import { createGame, advanceMonth, applyAction, runMonteCarlo, compareStrategies, netWorthOf, monthLabel, ... } from '@/engine'` |
| Selectors (derived values, AI summary, trigger rule) | `import { selectMonthsOfEssentialsCovered, selectPendingOpportunities, summarizeForAi, shouldRequestOpportunity } from '@/engine'` |
| Assumptions & plan catalog | `import { DEFAULT_ASSUMPTIONS, INSURANCE_PLANS, BOUNDS, DISCLAIMER } from '@/config/defaults'` |
| Four starting lives | `import { ARCHETYPES, archetypeConfig } from '@/config/archetypes'` (Agent 4 wraps them in `src/data/scenarios.ts`) |
| AI client (always resolves; offline fallback built in) | `import { generateScenario, proposeOpportunity, explainOutcome, scenarioToConfig, proposalToEvent } from '@/services/aiClient'` |
| Fixtures (engine-computed, not hand-typed) | `import { fixtureConfig, fixtureState, fixtureFinishedState, fixtureEventB, fixtureMonteCarlo } from '@/fixtures'` |
| Store (Agent 4) | `import { useGameStore, selectNetWorth } from '@/stores/useGameStore'` |

Path alias `@/` → `src/`. Run `npm run typecheck && npm test` before every PR.

## Function signatures

```ts
createGame(config: GameConfig): GameState                       // throws on invalid config
advanceMonth(state: GameState, opts?: { lean?, inPlace?, rng? }): GameState   // pure; status 'finished' → returns input
applyAction(state: GameState, action: GameAction): ActionResult // { ok:true, state } | { ok:false, code, message, state: original }
runMonteCarlo(config, policyLog, observedState, { paths?=1000, seed?=config.seed, months? }): MonteCarloResult
compareStrategies(config, logA, logB, { a, b }, { months, paths?, seed? }): MonteCarloComparison
netWorthOf(state) === cash + savings + stock + bond + etf − Σ debts   // the only definition of net worth
```

`advance_month` is NOT handled by `applyAction` (it returns `invalid_status`); call `advanceMonth`. The store wraps both.

## Who does what (UI ↔ engine)

- **Agent 3 panels** are controlled components: read from `useGameStore(s => s.game)` and call `dispatchAction(action)`. Never compute balances in the UI; use `netWorthOf`, `selectMonthsOfEssentialsCovered`, `annualWithholding(state, salary)` (Office), `activePlan(state, line)` / `settleClaim(cost, plan)` (Hospital "what if" calculator), `state.marketState` + `state.assumptions.assets` (Market).
  - Bank: `transfer`, `make_extra_payment`, `set_extra_debt_payment`, `set_contributions` (savings part), `set_min_cash_buffer`; show `state.debts`, `state.savings`.
  - Market: `set_allocation` (weights sum to 1), `set_contributions` (investment part); show `state.investments`, `state.marketState.lastMonthlyReturns`.
  - Office: read-only salary, `annualWithholding`, employment status; Type B job offers appear here.
  - Home: `set_budget` (discretionary), `set_housing`; show `state.household`.
  - Hospital/Insurance: `set_insurance(line, planId|null)` using `state.assumptions.insurancePlans`; show claims from `state.realizedShocks`.
- **Agent 4 flow**: notifications = `state.notifications` (kind `info` is routine; show the last N unread). Timeline = `state.timeline` (every entry has `netWorthAfter`; `action` holds the structured decision). Events = `state.activeEvents` (array; Type A are acknowledgements, Type B are decisions; `expiresAtMonth` is inclusive). Dispatch `apply_event_option` / `dismiss_event`.
- **Agent 5 reveal**: consume `MonteCarloResult` from `useGameStore(s => s.finishPayload?.monteCarlo)`. `endingNetWorths` is sorted ascending (histogram-ready); `bands[m]` gives p10/median/p90 per month for a fan chart; `observedNetWorth` is the engine's actual value and `percentileOfObserved` = share of paths that ended **below** it (only defined when `observedHorizonMatches`). Always print `assumptionsSummary` and never describe the percentile as a score. Optional `comparison` for paired A/B. `finishPayload.explanation` (filled asynchronously by `requestExplanation()`, called automatically by `finishGame()`) holds the AI or offline-template explanation with its `source` label — show it, labeled, when present.

## Actions (discriminated union)

`advance_month · set_allocation · set_budget · set_housing · set_insurance · set_contributions · set_extra_debt_payment · set_min_cash_buffer · make_extra_payment · transfer · apply_event_option · dismiss_event · enqueue_event · mark_notifications_read · pause · resume · finish`

Error codes: `invalid_allocation · invalid_amount · insufficient_funds · unknown_debt · unknown_plan · unknown_event · unknown_option · event_expired · invalid_status · invalid_effect · duplicate_event · game_finished`. On error the returned `state` is the untouched input — safe to ignore.

## Events

- Type A (engine): produced inside `advanceMonth`; money already applied; one option `ack` with effect `none`.
- Type B (AI or fallback): produced by `proposeOpportunity(summary)` → `proposalToEvent(proposal, state, source)` → `dispatchAction({ type:'enqueue_event', event })`. Effects are whitelisted templates (`offer_job, change_housing, change_insurance, budget_choice, loan_choice, contribution_choice, none`) with engine-validated bounds. When the player picks an option, the engine logs `resolvedEffect` so Monte Carlo can replay the decision.
- Trigger rule: `shouldRequestOpportunity(prev, next)` — every 3 months, after a shock, employment change, debt payoff, or net-worth $5k band crossing; never while a Type B is pending. The store already does this.

## AI gateway

`POST /api/ai` with body `AiRequest` → `AiResponse` or `AiErrorResponse` (see domain.ts). Env (server only): `AI_API_KEY`, `AI_MODEL` (default `claude-opus-5-5`), `AI_ENABLED`, `AI_TIMEOUT_MS`. Set `VITE_AI_OFFLINE=true` to force client fallback. Browser code never sees the key.

## What-if preview (for panels)

`previewMonth(state, { policy?, household?, insurance? })` runs one month with the change and one without, under the same seed streams, and returns `baseline`, `withChange`, `delta` and any `rejected` overrides. Pure and cheap (~1 ms); call it on every form change to show "next month this would …".

## Reveal extras (Agent 5)

`finishPayload.monteCarlo.comparison` (when the player made any decision) pairs the player's strategy against the default policy under identical luck: `a`/`b` summaries, `pairedMedianDifference`, `probabilityAOutperformsB`. `histogram(endingNetWorths, bins)` returns chart-ready buckets. Full gateway examples: `docs/AI_API.md`.

## Town shell (Agent 2)

`App({ panels?, renderReveal? })`: Agent 3 passes `panels` as a partial `Record<BuildingId, ReactNode>`; Agent 5 passes `renderReveal(payload: FinishPayload)`. `TownScene` takes `eventBuildings: BuildingId[]`; `PanelHost` is the accessible dialog every panel renders inside. See `docs/TOWN_HANDOFF.md`.

## Theme tokens

`src/styles/pixel-tokens.css` defines `--pixel`, palette and chart series colors (`--ft-series-*`). Use them in Tailwind via `bg-[var(--ft-panel)]` etc., and in Recharts via `stroke="var(--ft-series-etf)"`. Integer pixel scaling only; `image-rendering: pixelated` on sprites.
