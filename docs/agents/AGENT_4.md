# Agent 4: game flow (screens, clock, toasts, menus, settings, saving, finish, sound)

Read [README.md](README.md) first (vision, palette, `--px` scale system, materials, contracts, ownership).
Branch: `agent4-flow`.

**Plain English:** you make the game *run like a game*. You own the code that decides which screen is showing (title,
town, results), and you assemble the town screen from everyone's pieces. You also own everything that happens over
time: the month clock and its speed, the little notices that pop up when money moves or a decision arrives, the timeline and
activity books, a pause menu, a settings menu, keyboard shortcuts, "Saved" feedback, the "counting 1,000 futures"
moment before the results, and small retro sound effects. You don't draw art or build buttons; you use Agent 2's kit.

---

## 0. What exists now (so you don't need to read it)

- `src/main.tsx` renders `<App/>` in StrictMode and imports `src/styles/index.css`.
- `src/App.tsx`: `?dev=engine` → `EngineHarness`. Otherwise `Town`: calls `store.refreshSavedGame()` once; if no `game`
  → `<Landing/>` (Agent 5); else `<GameShell fullscreen toasts={<NotificationStack …/>}>` containing
  `<FullscreenGameView hud={inline HUD JSX} status={status tag} scene={<TownScene onBuildingClick eventBuildings/>}>` plus:
  `lastActionError` alert; building `PanelHost` with EventCards + `ConnectedBuildingPanel`; `Your timeline` PanelHost
  (`game.timeline` list); `Town activity` PanelHost (`game.notifications` with "Open building →"); results in a PanelHost titled
  `Your next chapter` rendering `RevealChart` (or `props.renderReveal`); when `status === 'finished'` and no payload, a
  "Your final month is complete" banner with `Review your story →` calling `finishGame`. `AppProps = { panels?, renderReveal? }`.
- `src/components/layout/FullscreenGameView.tsx`: uses `useGameClock({ intervalMs: 60_000, blocked: activeEvents.length > 0 })`
  and renders `GameClock` with `onAdvance=clock.advanceNow`, `onPause=setPaused`, `onFinish=finishGame`,
  `onToggleAuto`. `GameShell.tsx` adds the old SVG `WorldBackdrop`, a skip link and a footer. `BuildingOverview.tsx` is an
  unused read-only fallback. `src/styles/game-viewport.css` holds the stretched fullscreen layout. **All of these get
  replaced by `GameScreen`; delete them when unused.**
- `src/hooks/useGameClock.ts`: `useGameClock({ enabled=true, intervalMs=60000, blocked=false })` →
  `{ secondsRemaining, resetCountdown, advanceNow, autoAdvanceEnabled, setAutoAdvanceEnabled, blocked }`. One 1 s interval;
  resets on month change; only ticks while `status === 'playing'` and not blocked. Tested in `useGameClock.test.tsx`.
- `src/components/flow/`: `NotificationStack` (framer-motion; shows last 3 unread, dismiss `×`, `Open {building}`, `View all
  activity`; `aria-label="Recent financial activity"`), `NotificationHistory` and `TimelineDrawer` (unused drawers),
  `GameClock` (see AGENT_2 §0), `format.ts` (`usd`, `monthLabel`, used by everyone, keep the API stable), `EventCard`
  (now Agent 3's).
- `src/stores/useGameStore.ts` (yours): full API in README §12. Notes: `advanceOneMonth` auto-saves and may fire
  `requestOpportunity()` (async AI or offline Type B event; sets `aiStatus`); `dispatchAction` sets `lastActionError` on
  rejection; `finishGame()` is synchronous (~1 s for 1,000 paths + paired comparison) then calls `requestExplanation()`;
  `resetGame()` returns to no game but keeps the save in storage. Tests: `useGameStore.test.ts` (133 lines).
- `src/components/layout/AppShell.test.tsx` (yours): jsdom tests rendering `<App/>` (stubbed `showModal`): panel
  navigation keeps the run, store controls advance, full notification history, finish payload reaches the reveal.
- `tests/town.browser.ts` (yours): end-to-end smoke (start story via `tests/helpers.ts`, open/close all five windows by
  mouse and keyboard, focus return, `Next month` → `Month 1 / N`, Pause disables Next month, Resume, two more months →
  `Decision waiting` building, `View all activity` → `Town activity`, 3 `.activity-area .notice`, Bank window, outside click
  closes, `Finish & reveal` → `expectReveal`, `leaveReveal`; plus a 320-px no-overflow check and a Bank savings persistence
  test). Update selectors in it when you change markup you own.

---

## 1. Phase 0 (first ~45 min): stub PR

`[agent4] contracts: screen router, GameScreen, settings, sfx`:
- `src/App.tsx` → screen router: `?dev=engine` → EngineHarness; `?dev=ui` → Agent 2's `src/ui/dev/UiGallery.tsx` (lazy
  import; render a placeholder until it exists); else `!game` → `<TitleScreen/>` (Agent 5; until their stub lands keep
  `<Landing/>`); `finishPayload` → `<RevealScreen payload onPlayAgain={resetGame}/>`; else `<GameScreen/>`.
- `src/game/GameScreen.tsx` wrapping today's `FullscreenGameView` content so nothing visibly changes yet.
- `src/game/settings/` with `useSettings()`, `setSetting(key, value)`, `OptionsWindow` (stub) and the `Settings` type from
  README §9. `src/game/audio/sfx.ts` with `sfx(name)` as a no-op.

---

## 2. `GameScreen`: compose the town

```tsx
<GameStage label="Fortune Valley town" world={<TownWorld onBuildingClick={open} eventBuildings={…} openBuilding={openBuildingId} monthIndex={game.monthIndex}/>}>
  <Hud onOpenTimeline={store.openTimeline}/>  <StatusTag/>  <ToastStack/>  <MonthBanner/>
  <ControlBar …clock props…/>  <HudFooter/>
  {openBuildingId && <BuildingWindow building={openBuildingId} onClose={store.closeBuilding}/>}
  {timelineOpen && <TimelineWindow/>} {historyOpen && <ActivityWindow/>} {menu && <PauseMenu/>} …
</GameStage>
```
- `eventBuildings` = unique `game.activeEvents.map(e => e.buildingTarget)`.
- Replace `FullscreenGameView`, `GameShell`, `BuildingOverview` and `game-viewport.css`; delete them when nothing imports
  them. `App` no longer needs `panels`/`renderReveal` props; update `AppShell.test.tsx` accordingly (keep what it proves).
- `lastActionError` shows as a red toast (auto-clears after 5 s or on next action; add a `clearActionError()` store
  action).
- Natural end (`status === 'finished'`, no payload): a centred parchment card "Your 24 months are complete" with a primary
  `Review your story` button that runs the finish sequence (§6).

---

## 3. Clock and time

- Auto-advance interval comes from `useSettings().autoAdvanceSeconds` (30/60/120, default 60; 0 = off, which shows
  `Auto-time off`). `Auto on/off` in the control bar toggles between off and the last non-zero value.
- **Countdown is blocked** while any active event exists (as today) **or** any window/menu is open (building, timeline,
  activity, pause, options, confirm). The player shouldn't lose a month while reading. The label reads `Decision waiting`
  only for events; otherwise it stays paused silently.
- Month advance feedback: `MonthBanner` (a parchment ribbon "Month 5 · Jun 2026" that drops in under the HUD for ~1.2 s,
  stepped animation), `sfx('month')`, coins `sfx('coin')` if net cash rose. Reduced motion → no movement.
- Keep `useGameClock` tests green; add: blocked while a window is open; interval follows the setting.

---

## 4. Toasts (`src/game/flow/ToastStack.tsx`, replaces `NotificationStack` usage)

- Right edge under the HUD (below the status tag height), stacked downward, max 3 visible, region
  `aria-label="Recent financial activity"`, `aria-live="polite"`. Each toast is a small kit `Board` with a pin, the month,
  `summary`, optional `Money` (signed), and an icon per kind (info book, positive coin, negative crack-coin, decision bell).
- **Priority:** `decision` toasts always sort first and never auto-dismiss; they have a primary button
  `Go to {building title}` that opens the building. `info` / `positive` / `negative` auto-dismiss after 6 s
  (`markNotificationRead`), pausing while hovered. `×` dismiss button named `Dismiss {summary}`.
- `View all activity` small button under the stack (keep the name).
- When a new Type B event appears (activeEvents grows with type B), `sfx('alert')`.
- Keep class hooks the e2e test uses or update the test (`.activity-area .notice` today).

---

## 5. Windows and menus (all built with Agent 2's `Modal`, `Board`, `Button`, `Tabs`, …)

- **TimelineWindow** (dialog `Your timeline`): a journal with one row per `game.timeline` entry (newest first): month label
  via `monthLabel`, type icon (choice, shock, milestone, policy change, ai event), description, `Money` net worth after.
  Filter tabs: All / Choices / Surprises / Milestones. Empty state: "Your story starts here…".
- **ActivityWindow** (dialog `Town activity`): all notifications newest first, read/unread styling, `Mark all read`
  (`markAllNotificationsRead`), `Open {building}` buttons that close this and open the building.
- **PauseMenu** (dialog `Paused`): opened by Esc when no other window is open, or a gear `IconButton` next to the status
  tag. Buttons: `Resume`, `Options`, `Guide` (Agent 5 exports `GuideWindow` from the title folder; import it), `Save & quit
  to title` (`saveGame()` then `resetGame()`), `Restart this story` (confirm, then `startGame(freshScenario(...))` for premade
  archetypes, or `startGame(config)` for custom ones). Opening the pause menu also pauses the game (`setPaused(true)`); Resume
  restores the previous state.
- **OptionsWindow** (dialog `Options`): Auto-advance (Off / 30 s / 60 s / 120 s as `Tabs` or `Select`), Sound (`Toggle`), Reduce
  motion (`Toggle`, defaulting to the OS setting), Tips (`Toggle`), `Delete saved game` (confirm → `clearSavedGame`). Used by
  the pause menu and by Agent 5's title screen.
- **ConfirmDialog** (generic, `src/game/flow/ConfirmDialog.tsx`): `{ title, body, confirmLabel, onConfirm, onCancel, danger? }`.
  Use it for restart, delete save, and finishing early.
- **First-game tips** (when `tips` is on and it's month 0 of a fresh game): three small coach-mark bubbles pointing at a
  building, the control bar and the HUD, advancing on click and never shown again (store a flag in settings).

---

## 6. Finish sequence

`Finish & reveal` (or natural end):
1. If `game.monthIndex < config.durationMonths`, ConfirmDialog "Finish early? You've played 6 of 24 months. Results will
   use the months you played." (`Finish now` / `Keep playing`).
2. Show a full-screen **FinishOverlay**: the world stays visible, darkened, with a central parchment card "Counting 1,000
   possible futures…" and a stepped animation (coin stack filling or hourglass, drawn by Agent 2 as an icon sheet, or ask
   Agent 1 for an `fx/hourglass` sprite). `sfx('reveal')`.
3. Wait two `requestAnimationFrame`s so the overlay paints, call `store.finishGame()` (synchronous), and keep the overlay
   at least 900 ms total so it doesn't flash. Then the router switches to Agent 5's `RevealScreen`.
4. `onPlayAgain` → `resetGame()` → title.

---

## 7. Keyboard, saving, sound

- **Shortcuts** (`src/game/flow/useShortcuts.ts`; ignored while focus is in an input/textarea/select or a modal is open
  except Esc): `Space` pause/resume, `N` next month, `1`–`5` open Bank/Office/Health House/Home/Market, `T` timeline,
  `A` activity, `Esc` pause menu, `?` guide. Show them in the Guide and as tooltips.
- **Saved indicator:** when `savedGame.savedAt` changes, show a small `Saved` tag with a check icon next to the status
  tag for 1.5 s.
- **Sound** (`src/game/audio/sfx.ts`): synthesize short square/triangle-wave blips with the Web Audio API (no audio
  files): click, open, close, coin (two rising notes), month (soft chime), alert (two-tone), reveal (arpeggio). Volume
  low, created lazily after the first user gesture, silent when `sound` is off or in tests (`navigator.webdriver`).
  Agent 2's buttons don't call sfx; you add a delegated `click` listener on the stage for `button` elements to play
  `click`.
- **Settings persistence:** `localStorage` key `fortune-valley-settings-v1`, Zod-validated on load, defaults on corruption.

---

## 8. Tests you own

- `useGameStore.test.ts`, `useGameClock.test.tsx`, `AppShell.test.tsx`: keep and extend (router picks the right screen;
  clock blocked by open window; settings persistence and defaults; `clearActionError`).
- `src/game/flow/flow.test.tsx`: toast ordering and auto-dismiss (fake timers), decision toast opens the building,
  shortcuts ignored in inputs, pause menu pauses/resumes, finish-early confirm, overlay calls `finishGame` once.
- `tests/flow.browser.ts`: start a story, press `N` → month 1, `Space` pauses, `2` opens Town Office, `Esc` closes it, `Esc`
  opens `Paused`, Options toggles persist across reload, `Save & quit to title` then Continue (Agent 5's button; use
  helpers) restores the month, finish early → overlay → reveal.
- `tests/town.browser.ts`: keep it passing as markup changes.

---

## 9. Done checklist

- [ ] App has three screens with no website wrapper; GameScreen composes every agent's piece; old layout files deleted.
- [ ] Clock, auto speed and blocking feel right; month banner and sounds add feel without being annoying.
- [ ] Toasts are prioritised, readable, actionable; timeline and activity are in-world journals.
- [ ] Pause menu, options, confirmations, tips, shortcuts, save indicator and the finish sequence all work by keyboard.
- [ ] All your tests green; `town.browser.ts` updated and passing.
