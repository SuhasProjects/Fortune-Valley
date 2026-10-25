# Fortune Valley: architecture

How the pieces fit, from the pure engine up to the pixels. Contracts and signatures are in [INTEGRATION.md](INTEGRATION.md);
the AI gateway wire format in [AI_API.md](AI_API.md); the art tooling in [ART_PIPELINE.md](ART_PIPELINE.md).

## Layers

| Layer | Where | Rule |
|---|---|---|
| **Engine** | `src/engine/**`, types in `src/types/domain.ts`, assumptions in `src/config/**` | Pure, deterministic, typed. `createGame` → `advanceMonth` / `applyAction`; `runMonteCarlo` replays a policy log on 1,000 seeds; `whatIf.ts` re-runs it with one decision changed, in a Web Worker (`whatIf.worker.ts`). No DOM, no React. Every number the UI shows comes from here. |
| **Store** | `src/stores/useGameStore.ts` (Zustand) | Holds `game`, `config`, UI flags (`openBuildingId`, `timelineOpen`, `historyOpen`), `finishPayload`, `savedGame`, `aiStatus`. Wraps the engine (`advanceOneMonth`, `dispatchAction`, `finishGame`), autosaves, talks to the AI client, triggers Type B opportunities (`shouldRequestOpportunity`). |
| **Services** | `src/services/**`, `api/**`, `server/**` | Browser AI client with built-in offline fallbacks; the server-side gateway (`api/ai.ts` on Vercel, `server/aiDevMiddleware.ts` in `npm run dev`). |
| **Screens** | `src/App.tsx` → `src/game/title/`, `src/game/GameScreen.tsx`, `src/game/reveal/` | One screen at a time, chosen from store state. Each screen is a `GameStage` with a world underneath and HTML UI above. |
| **Stage** | `src/game/stage/` | Integer pixel zoom for the whole screen: sets `--px`. |
| **World** | `src/game/world/`, `src/game/art/` | The living town: ground and water layers, props, buildings, dusk, all sprites from the compiled manifest. |
| **UI kit** | `src/ui/` | Wood and parchment materials (`Board`, `Window`, `Modal`, `Button`, fields, `Icon`, `Money`, …). Nobody else writes frame, button or input styling. |
| **HUD / flow / panels** | `src/game/hud/`, `src/game/flow/`, `src/game/settings/`, `src/game/audio/`, `src/components/panels/` | Top bar and control bar; toasts, timeline, activity, confirm dialogs, options, sound; the five building panels. |

## Screens and component tree

`App` reads the URL and the store: `?dev=engine` → `EngineHarness`, `?dev=ui` → `UiGallery`; no game → the title; a
`finishPayload` → the reveal; otherwise the town.

```
main.tsx
└─ App.tsx (router)
   ├─ TitleScreen                                    src/game/title/   (App imports it via the Landing alias)
   │  └─ GameStage world=<TitleScene/>               sign, menu (New Story / Custom Story / Continue),
   │     ├─ StoryPicker | CustomStoryLetter           Options (OptionsWindow), GuideWindow
   │
   ├─ GameScreen                                     src/game/GameScreen.tsx
   │  └─ GameStage world=<TownWorld onBuildingClick eventBuildings openBuilding/>
   │     ├─ Hud                                      src/game/hud/   (reads the store)
   │     ├─ StatusTag · "Saved" Tag · pause IconButton
   │     ├─ ControlBar                               auto countdown, Pause/Resume, Next month, Finish & reveal
   │     ├─ <main> coach tips, month recap strip (MonthRecap), action errors
   │     │  ├─ PanelHost(building) → EventCard* + ConnectedBuildingPanel   src/components/panels/
   │     │  ├─ TimelineWindow · ActivityWindow · ConfirmDialog              src/game/flow/
   │     │  ├─ pause menu · OptionsWindow · guide · finish confirm          (PanelHost = Modal from src/ui)
   │     │  └─ finish overlay "Counting 1,000 possible futures…"
   │     ├─ ToastStack                               src/game/flow/
   │     └─ HudFooter
   │
   └─ RevealScreen                                   src/game/reveal/  (App mounts it through the RevealChart alias)
      └─ GameStage world=<TownWorld timeOfDay="dusk"/>   (no onBuildingClick → decorative)
         └─ Ledger (Board)
            ├─ headline (observed ending, p10–p90 sentence)
            ├─ OutcomeChart "Same strategy, 1,000 futures"
            ├─ WhatIfSection: two selects → OutcomeChart × 2 (shared y domain) + ChangeStrip
            ├─ Why? (explanation + "Ask about your results")
            ├─ <details> assumptions, seed, paths, elapsed
            └─ "Choose a new story"
```

Two compatibility aliases remain from the integration: `src/components/landing/Landing.tsx` re-exports `TitleScreen`,
and `src/components/reveal/RevealChart.tsx` wraps `RevealScreen` inside the `PanelHost` that `App` still mounts.
`src/components/town/TownScene.tsx`, `src/components/flow/{GameClock,NotificationStack,TimelineDrawer}.tsx` and
`src/components/layout/PixelArt.tsx` are legacy and no longer rendered by any screen.

## GameStage: the scale system

Everything is drawn in **art pixels** at a whole-number zoom (`src/game/stage/scale.ts`):

- The town **core** is 320×180 art px (16:9). It sits centred in a 480×288 **map** whose outer ring is scenery
  (`CORE_OFFSET_X/Y` = 80, 54), so wider or taller windows show more valley instead of bars.
- `px = max(1, floor(min(viewportWidth / 320, viewportHeight / 180)))`. 1280×720 → 4, 1920×1080 → 6, 2560×1440 → 8.
  Never fractional, never `transform: scale()`.
- `GameStage` (`src/game/stage/GameStage.tsx`) is a `position: fixed` full-viewport root (`.fv-stage`) that locks page
  scroll and sets `--px` (e.g. `4px`), `--view-w` and `--view-h` (visible art px). It renders `world` in `.fv-world`
  (z 0) and `children` in `.fv-ui` (z 10; the layer itself is `pointer-events: none`, each direct child is `auto`, so
  empty UI space clicks through to the town). `useStageScale()` returns `{ px, viewW, viewH }` for code that needs it.
- **Every pixel-art dimension in CSS is `calc(N * var(--px))`**, from sprite sizes to button borders and font sizes
  (`src/ui/tokens.css`). That is what makes the HUD, windows and world look like one object at any window size.

## TownWorld: the living town

`src/game/world/TownWorld.tsx` positions a `.fv-map` of `MAP_W × MAP_H × px` CSS px centred in the stage and draws,
in order:

1. **Ground** (`world/ground`, one static 480×288 sprite built from the material mask, see ART_PIPELINE) and **water**
   (`world/water`, a 3-frame sheet of only the water pixels, 400 ms per frame, `z-index: 1`).
2. **Props** from `layout.ts` (`PROPS`: fountain, lamp, bench, flowers, trees, bushes, lily pads; core positions were
   measured from the reference, the outer ring is hand-placed). Each is a `<Sprite>` with `animate` where it has frames.
3. **Buildings**: `BUILDING_LAYOUT` gives the five sprite corners. Each building is a `<button>` (or a `<div>` when the
   world is decorative) containing the base sprite, the derived `hover` frame (gold outline, shown on hover / focus /
   `data-open`), a live-HTML name plaque, and the `world/fx/badge` sprite when `eventBuildings` includes it. Accessible
   name: `Open Pine Bank: Savings & debt` (+ `. Decision waiting`).
4. **Smoke** over two chimneys (`SMOKE`), always on top (`z 900`).
5. **Dusk** (`timeOfDay="dusk"`): a flat multiply wash (`.fv-dusk`, z 1000), then above it each building's `lights`
   variant (only its window pixels), the lamp's `lit` frame and a `glow` sprite, and bobbing `firefly` sprites.

**Depth sort:** `place(x, y, h)` sets `z-index = y + h`, i.e. the sprite's foot line, so a tree in front of a building
overlaps it correctly without a scene graph. **Motion:** every animation is `steps()`-based; `useReducedMotion()`
(OS preference or the Options toggle) adds `.fv-still`, which freezes every sprite on frame 0.

`Sprite` (`src/game/art/Sprite.tsx`) draws one frame of a compiled sheet as a `background-image` sized by `--w × --px`,
reading `SPRITES[name]` from the generated manifest (`w`, `h`, `frames[]`, `speed`, `anchor`, `slice`). `frame` can be an
index or a variant name (`'hover' | 'lit' | 'lights'`); `animate` loops only the authored frames at `speed` ms each.

## UI kit, HUD, flow, panels

- **`src/ui`** (`index.ts`): `Board`, `WoodFrame`, `Plaque`, `Tag`, `Inset`, `Divider`, `ScrollArea`, `Window`, `Modal`
  (native `<dialog>`, focus trap, Escape, backdrop click, restores focus, close button named `Close panel`), `Button`,
  `IconButton`, `Field`, `NumberField`, `Select`, `Slider`, `Toggle`, `Tabs`, `Tooltip`, `Icon` (10/16 px, `compact` 6 px),
  `Money`, `useReducedMotion`. Frames are 9-slice PNGs from `art-src/ui/frames` applied with `border-image` and
  `border-width: calc(slice * var(--px))`; fonts are Pixelify Sans (headings) and VT323 (numbers and body), bundled via
  `@fontsource`; colours are the `--c-*` variables from the generated `src/styles/palette.css`.
- **HUD** (`src/game/hud`): `Hud` (region `Financial overview`: title, month, Cash / Savings / Debt / Net worth with
  tick deltas, `Timeline` button), `ControlBar` (group `Time controls`), `StatusTag` (OFFLINE READY / AI CONNECTED / …),
  `HudFooter`. All read the store directly or take the same props the old clock did.
- **Flow** (`src/game/flow`, `settings`, `audio`): `ToastStack` (region `Recent financial activity`), `TimelineWindow`
  (`Your timeline`), `ActivityWindow` (`Town activity`), `ConfirmDialog`, `useShortcuts` (Space pause, N next month,
  1–5 buildings, T timeline, A activity, Esc close top, ? guide), `useGameClock` (auto-advance; blocked while a modal or
  a pending event is open). `useSettings()` is a validated, `localStorage`-backed snapshot
  (`autoAdvanceSeconds`, `sound`, `reduceMotion`, `tips`, …); `sfx(name)` synthesises short square/triangle blips and is
  silent when sound is off or under WebDriver.
- **Panels** (`src/components/panels`): controlled components fed by the store (`state`, `dispatch`), rendered inside
  `PanelHost` (a `Modal` titled with the building name). They call engine previews (`previewMonth`, `previewHorizon`,
  `selectPaySummary`, `settleClaim`) and never compute money themselves.

## Data flow for the ending

```
ControlBar "Finish & reveal"  ──▶ GameScreen.requestFinish
                                   │  (confirm if early) → beginFinish: sfx('reveal'), overlay ≥ 900 ms
                                   ▼
                              store.finishGame()
                                   │  applyAction(game, {type:'finish'})
                                   │  runMonteCarlo(config, policyLog, finalState)      ← 1,000 paths, same strategy,
                                   │  compareWithBaseline(…)   (paired default policy)      alternate luck, ~1 s, sync
                                   ▼
                      finishPayload = { config, finalState, policyLog, monteCarlo: MonteCarloResult }
                                   │           └─ requestExplanation() fills .explanation asynchronously (AI or offline)
                                   ▼
                              App ──▶ RevealScreen({ payload, onPlayAgain: resetGame })
                                   │
        start = finalState.netWorthHistory[0]
        lines = outcomeLines(monteCarlo, start)  ──▶ OutcomeChart          { months, start, p10, median, p90, yourEvents }
                                   │
        decisions = listDecisions(config, policyLog)  ──▶ Select "Pick a decision" / Select "Instead…"
                                   │                       (first entry 'all' → 'defaults' when any decision exists)
                                   ▼  on change (previous run aborted via AbortController)
        runWhatIfAsync({ config, policyLog, finishMonteCarlo, startNetWorth, observedNetWorth, decisionId, alternativeId }, signal)
                                   │  cache hit → resolved immediately
                                   │  else module Web Worker (whatIf.worker.ts) → runWhatIf:
                                   │     changedPolicyLog()  – replace or drop that one entry
                                   │     runPaths(config, log, mc.seed, mc.pathsRequested, mc.months)  – same seeds = same luck
                                   │     replayPath(config, policyLog | log, config.seed)  – the player's exact game, before/after
                                   ▼
        WhatIfResult { original, changed, delta, yourEventsComparable, replayFallbacks }
                                   ├─▶ OutcomeChart "What you did"  +  OutcomeChart "If you had…"   (sharedYDomain)
                                   └─▶ ChangeStrip: typical ±$, your exact events ±$, spread wider/narrower
```

Why straight lines and 10/50/90: the chart has to be read in seconds; 8 in 10 futures land between the two outer
lines, and the UI does no arithmetic (even the deltas and the spread are engine fields). `changed.yourEvents` is
anchored on the observed ending plus the replay delta, so replay error never leaks into the shown difference; if the
unchanged replay does not reproduce the observed ending within $1, `yourEventsComparable` is false and the UI says the
number is estimated.

## Engine: modeling notes

Static React above, all finance below this line in `src/engine` (pure, deterministic, typed). The store orchestrates; UI renders. AI goes through `/api/ai` only.

### Monthly accounting order (fixed, tested)

1. **Income** — gross = annual salary / 12; illustrative withholding (standard deduction + progressive brackets + flat payroll rate; filing `married_joint` doubles deduction and bracket bounds). Unemployed: benefit = min(cap, replacement × prior monthly gross); re-employment at prior salary when the spell ends. Annual raise every 12 months while employed.
2. **Bills** — housing, essentials, discretionary, then premiums for each active plan.
3. **Debt** — for each debt (highest APR first): interest = balance × APR/12 accrues to the balance **first**, then payment = min(balance, minimum + remaining extra). Extra payment goes to the highest-APR debt first. Student loans with minimum 0 accrue (deferred).
   → **Funding order** if cash < 0 after steps 1–3: `policy.emergencyFundingOrder` (default savings → investments pro-rata → borrow). Borrowing creates/increases a single `overdraft` debt at `assumptions.overdraftApr` with a 3%/\$25 minimum. Money is never invented; a month that needed borrowing is recorded in `shortfallMonths` (the liquidity-shortfall metric).
4. **Contributions** — savings, then investments split by `targetAllocation`, each limited to cash above `minCashBuffer`. Trimmed contributions produce an `info` notification.
5. **Returns** — savings interest at monthly-compounded APY. Asset returns are **lognormal** monthly: `r = exp(μ + σz) − 1`, `σ = annualVol/√12`, `μ = ln(1+expected)/12 − σ²/2`, so returns are bounded above −100%. Correlated normals: ETF and bond shocks are built from the stock shock with `correlation.stockEtf` / `correlation.stockBond`. `expectedAnnualReturn` is the arithmetic mean (defaults: tech stock basket 12%/35% vol, S&P 500 index ETF 10%/17%, bond fund 4.5%/6%; stock–ETF ρ 0.75, stock–bond ρ 0.1, rounded long-run nominal US history, see `src/config/defaults.ts`). `set_allocation` rebalances existing holdings to the new target immediately (`rebalance` ledger lines, no tax), so allocation changes matter in the Monte Carlo / what-if replays too.
6. **Shocks (Type A)** — for each shock kind in fixed order, draw incidence `u` and severity `z` from the **shocks stream** regardless of insurance; a shock occurs iff `u < monthlyIncidence`. Cost is lognormal, clamped to `[costMin, costMax]`. Claims: insured pays deductible, then coinsurance share, capped at `outOfPocketMax`; insurer pays the rest up to `coverageCap`. Out-of-pocket is funded via the funding order. Job-loss is drawn on the **employment stream**.
7. **Alerts** — expire events, push notifications/timeline, record `netWorthHistory[monthIndex+1]`, increment month, finish at the horizon.

Balances and ledger postings are rounded to cents. Purchases and pro-rata liquidations use whole-cent largest-remainder allocation, normalized across accepted weights; ties follow stock/bond/ETF order. This conserves the exact cash amount even for one-cent transfers and allocation sums within tolerance. Configurations, assumptions, incoming events and logged actions are copied to isolate engine state from later caller edits.

Invariant: `netWorth = cash + savings + stock + bond + etf − Σ debts`; ledger entries per account reconcile to balance deltas (tested).

### Randomness

`mulberry32` seeded by `hash(seed, monthIndex, stream)` for streams `market | shocks | employment | life`. Same seed ⇒ identical run. The `life` stream drives life events (small uninsured costs and gifts, $20–300, about one every two months) whose signs are paired so a run nets within ±$100; it is separate so adding them never re-aligned the shock or market draws. Changing insurance, allocation or budget can never change which shocks occur or market returns — only money flows. Behavior can change risk only via explicitly modeled exposure (none in MVP).

### Actions & events

`applyAction` clones, validates, applies, logs to `policyLog` + `timeline`, or rejects with the original state. Type B effects are a closed whitelist with bounds in `src/config/defaults.ts#BOUNDS`; AI output is parsed with Zod on the server **and** re-validated in the engine. No LLM output is executed. Enqueued events must be Type B from AI/fallback, target a valid building, carry unique option ids and valid bounded effects, and not already be expired. Creation month is descriptive metadata (fixtures may be reused); expiry is enforced against the active month. Keeping the current policy is logged as a structured `none` effect rather than disappearing from history.

### Monte Carlo ("same strategy, alternate luck")

For `i in 0..N−1`: `createGame({...config, seed: hash(baseSeed,'mc-path',i)})`, replay `policyLog` entries at their original `monthIndex`, then `advanceMonth` — for `months` = months actually played (so the observed marker is on the same horizon). Event-option decisions are replayed as their `resolvedEffect` (the event itself was path-specific). Actions rejected for insufficient funds are skipped and counted in `replayFallbacks`. Metrics: sorted ending net worths, median/p10/p90/mean, P(net worth < 0), P(any overdraft borrowing), per-month bands. `observedNetWorth` is computed from the real final state. Path counts must be integers from 1 to 10,000; horizons must be integers from 1 to 240 months; seeds must be safe integers. Invalid values are rejected before loops begin. In this environment the 1,000-path, 60-month regression takes about one second. `compareStrategies` pairs path seeds so two policy logs face identical luck.

**Replay guardrail after divergence.** Each logged event decision records `context.employmentStatus` at the time. During replay, an `offer_job` effect is applied only in paths whose employment status matches that context (a "return to work" offer accepted while unemployed is skipped in paths that never lost the job; a competing offer accepted while employed is skipped in paths currently unemployed). Skips are counted in `replayFallbacks`. All other effects are unconditional policy changes and replay as-is.

Annual raises apply at every 12th month; if the player is unemployed at that moment the raise is applied to the salary they return to.

This is a retrospective replay from the initial state, not a forward forecast from today's balances.

### AI gateway (server only)

`api/ai.ts` (Vercel) and `server/aiDevMiddleware.ts` (Vite dev) wrap `api/_lib/handler.ts`: Zod-validate request → if `AI_ENABLED !== 'false'` and `AI_API_KEY` present, call Anthropic Messages API (`AI_MODEL`, default `claude-opus-5-5`) with structured output → Zod-validate the model's JSON → return `source:'ai'`; any failure (timeout, 4xx/5xx, refusal, schema mismatch) returns a typed error response, which the browser converts to a deterministic fallback with `source:'fallback'` and a warning. Three prompts: scenario mapper, Type B director, outcome explainer. Prompts forbid guarantees, invented probabilities, tax/legal advice and PII requests. Free text is never stored server-side. Gateway failures return stable error messages; provider response bodies and arbitrary exception messages are not sent to the browser.

### Configuration validation

`createGame` rejects malformed loaded configurations and invalid dates, rates, correlations, severity intervals, tax brackets, coverage parameters, employment durations and funding sources. Active insurance ids must match the persistent policy. Accepted defaults remain illustrative, not calibrated financial forecasts. Validation bounds guard numerical accounting; they do not imply that an accepted scenario is affordable or advisable.
