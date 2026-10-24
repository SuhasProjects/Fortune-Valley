# Agent 4 — The town screen and the gameplay flow

Branch name: `agent4-town-flow`. You own the screen the player spends the game on.

## What you own
`src/components/town/TownScene.tsx`, `src/components/town/buildings.ts`, `src/components/flow/**`,
`src/components/layout/FullscreenGameView.tsx`, `src/components/layout/GameShell.tsx`, `src/hooks/**`, `src/stores/**`,
`src/styles/game-viewport.css`, `src/styles/world.css`, `src/App.tsx`.

You do not touch: engine, panels, `PanelHost.tsx` (Agent 3), landing/title/reveal (Agent 5), kit internals (Agent 2).

## Context you need

- `src/App.tsx` is small. `App` returns `<EngineHarness/>` for `?dev=engine`, `<Landing/>` when no game, else `Town`.
  `Town` builds the HUD inline (`<header className="town-hud">` with brand, date, Cash, Savings, Debt, Net worth, Timeline
  button), the status tag (`PAUSED`, `STORY COMPLETE`, `PREPARING OPPORTUNITY`, `AI CONNECTED`, `OFFLINE READY`), and
  renders `GameShell fullscreen` → `FullscreenGameView { hud, status, scene }` with children: action error, `PanelHost` for the
  open building (with `EventCard`s for that building's events), timeline dialog, history dialog, reveal dialog, and the
  completion banner that calls `store.finishGame`.
- `FullscreenGameView` layers: town, HUD, status, controls (`GameClock` fed by `useGameClock({ intervalMs: 60_000, blocked:
  activeEvents.length > 0 })`). `GameClock` props: `status, onAdvance, onPause, onFinish, secondsRemaining,
  autoAdvanceEnabled, blocked, onToggleAuto`. Button labels the browser test relies on: `Next month`, `Pause`, `Resume`,
  `View all activity`, `Close panel`, and hotspot labels `Open Pine Bank: …` etc. with `Decision waiting` appended when an
  event is pending.
- `TownScene` renders `<img src="/assets/town-valley-v2.png">` and five `<button class="town-hotspot">` positioned by
  `buildings[id].x/y` percentages (center-anchored, 23% × 32%), each with `.building-sign`, `.building-tooltip`, and
  `.event-badge`. Styles in `world.css` lines ~100–110 and `game-viewport.css`.
- Store (`src/stores/useGameStore.ts`): state `game`, `config`, `openBuildingId`, `timelineOpen`, `historyOpen`, `aiStatus`,
  `finishPayload`, `savedGame`, `lastActionError`, `lastInsight`; actions `startGame`, `advanceOneMonth`, `dispatchAction`,
  `openBuilding`, `closeBuilding`, `setPaused`, `openTimeline`, `closeTimeline`, `setHistoryOpen`, `markNotificationRead`,
  `markAllNotificationsRead`, `requestOpportunity`, `requestExplanation`, `requestInsight`, `finishGame`, `resetGame`,
  `generatePersonalized`, `saveGame`, `loadSavedGame`, `clearSavedGame`, `refreshSavedGame`. Autosave happens inside
  `advanceOneMonth`. `finishGame` runs Monte Carlo synchronously (~1 s) then calls `requestExplanation`.
- Notifications: `game.notifications: GameNotification[]` with `kind` (`info` | `decision` | …), `read`, `relatedBuilding`,
  `amountSigned`, `summary`, `details`, `monthIndex`. `NotificationStack` shows the last three unread, newest first, using
  framer-motion. `TimelineDrawer.tsx` and `NotificationHistory.tsx` are unused (App renders lists inside `PanelHost`).
- Events: `game.activeEvents: GameEvent[]` with `type` `'A' | 'B'`, `buildingTarget`, options; answered via
  `dispatchAction({ type: 'apply_event_option', eventId, optionId })`. `EventCard` renders one.
- Kit from Agent 2: `@/components/layout/ui` (`PixelPanel`, `PixelButton`, `PixelToast`, `PixelTag`, `PixelDialogFrame`) and
  `townMap.ts` (`TOWN_IMAGE`, `TOWN_ASPECT`, `TOWN_HOTSPOTS`). Until merged, use the existing classes and the hotspot table in
  `docs/art-reference/ART_DIRECTION.md`.
- Browser tests: `tests/town.browser.ts` desktop 1366×768 and mobile 390×844, asserts no horizontal overflow, opens every
  building by accessible name, month tick text `Month 1 / N`, pause disables Next month, `Decision waiting` appears after
  three months (offline fallback event), history dialog, screenshots to `docs/screenshots/`.

## Tasks, in order

### 1. Town stage with the reference image (first PR)
- `TownScene`: render `TOWN_IMAGE` inside a stage `div` sized to the largest `TOWN_ASPECT` box that fits the viewport under the
  HUD, centered; `image-rendering: pixelated`; filler outside the box is `#96c450` with a faint 16 px checker (or Agent 2's
  `grass-tile.png` when it exists). No `object-fit: fill` anywhere (today `game-viewport.css` line 16 stretches; remove it).
- Hotspots become absolutely positioned `button`s using `TOWN_HOTSPOTS` left/top/width/height percentages of the stage, no
  translate. Keep the accessible names exactly (`Open Pine Bank: Savings & debt`). Hover/focus: inset gold frame per the art
  doc, cursor pointer. The image already shows name plaques, so hide `.building-sign` by default; keep the tooltip on hover.
- `buildings.ts` keeps titles and hints (used by PanelHost eyebrows); drop `x/y/color` once nothing reads them.
- Mobile (390 px) still must not overflow horizontally: let the stage shrink to width and center vertically. It will be
  small; that is acceptable, laptop is the target.

### 2. HUD and controls as HTML over the picture
- Extract the inline HUD from `App.tsx` into `src/components/flow/TownHud.tsx` and the bottom bar into `GameClock.tsx`.
  Position them in `FullscreenGameView` over the baked HUD strip (top 1.3%–8.5% of the stage) and over the baked bottom panel
  (32.7%–67% wide, 88.5%–95.5% tall), so they cover the picture's own UI. Use percentages of the stage, not the viewport.
- Content and order exactly as the reference: coin badge + `FORTUNE VALLEY` over `config.title`; calendar + `monthLabel`
  over `Month n / N`; Cash; Savings; Debt; Net worth (red when negative); `Timeline ↗` button. Bottom: `Next month in 00:28`,
  `Auto on/off`, `⏸ Pause`/`▶ Resume`, `Next month →` (primary), `Finish & reveal`. Status tag under the HUD's left end.
- Styling through the kit when merged; parchment colours from the art doc meanwhile. Fonts: Pixelify Sans labels, VT323
  values with `tabular-nums`.
- Remove `WorldBackdrop` from `GameShell` when `fullscreen` (the picture is the backdrop) and the fixed footer text overlap
  with the controls.

### 3. Decision-first notifications
- `NotificationStack`: sort unread so `kind === 'decision'` comes first, then by `monthIndex` desc; cap at three; render with
  `PixelToast` (`kind="decision"` gets the gold band). Decision toasts get an action `Open <building>` → `openBuilding`.
- Add a store selector `selectVisibleToasts(state)` and a unit test in `src/stores/useGameStore.test.ts`.

### 4. Finish, save and reset feedback
- `Finish & reveal` and the completion banner: set a local `computing` flag, render a `PixelPanel` overlay
  `Computing 1,000 futures…` with a 12-frame pixel spinner, then `requestAnimationFrame(() => requestAnimationFrame(finishGame))`
  so the frame paints before the synchronous Monte Carlo.
- Saved indicator: after `advanceOneMonth`, show `Saved` as a small `PixelTag` next to the clock for 1.5 s (store exposes
  `savedGame.savedAt`; watch it change).
- Reset confirmation: when `savedGame` exists and the player triggers `resetGame` (from the reveal's close or Agent 5's
  reset button, both call `store.resetGame`), show a two-button `PixelPanel` `Start a new story? Your saved game will be
  replaced.` Implement as `confirmReset()` in the store that sets `pendingReset: true`; `App` renders the confirm; keep
  `resetGame` itself unchanged so Agent 5 needs no change.
- Clock: keep 60 s default. Add `?clock=fast` (2 s) and `?clock=turbo` (0.5 s) query options for demos, parsed in
  `FullscreenGameView` only. Keep blocking on any unresolved event (safer for players).

### 5. Cleanup
- Delete `TimelineDrawer.tsx` and `NotificationHistory.tsx` after confirming no imports (`grep -r TimelineDrawer src`).
- Remove dead `.illustrated-*`, `.map-location`, `.map-guide` rules from `world.css` once the new stage is in.
- Store test file currently has no `test(` calls that Vitest counts; make sure your new tests run (`npm test` shows them).

### 6. Tests and screenshots
- `tests/town.browser.ts`: keep every existing assertion; add: town image natural width > 0, no element wider than the
  viewport at 1366 and 1920 (add a `wide` project `{ viewport: 1920×1080 }` to `playwright.config.ts`, tell Agent 1),
  decision toast appears before info toasts after month three, `Saved` tag appears after Next month, `Computing` overlay
  appears on Finish. Regenerate `docs/screenshots/` only from a passing run.

## Rules
- Hotspot ids are `bank`, `office`, `hospital`, `home`, `market`. Titles stay `Pine Bank`, `Town Office`, `Health House`,
  `Your Home`, `Market Hall`.
- Nothing in these files computes money. HUD values come from `selectNetWorth`, `selectDebtTotal`, `game.cash`, `game.savings`.
- Keep `App.tsx` edits to wiring; Agent 5 will change the one line that chooses `Landing`/title screen. Do your HUD extraction
  early so that line is the only overlap.

## Acceptance
- At 1440×900 the town screen is visually the reference image with live values in the HUD and working buttons.
- At 1920×1080 no stretching; filler is grass, not bars. At 390×844 no horizontal overflow.
- Decision toasts first; `Computing 1,000 futures…` visible before results; `Saved` tag after each month; reset confirm when a
  save exists. Two dead components deleted. All tests green.
