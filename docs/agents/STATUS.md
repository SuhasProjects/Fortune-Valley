# Fortune Valley — live status and briefs for idle agents

Updated 2026-10-24 (late). Read this, then only the files your brief names. Everything you need is here; do not explore.

## What is going on

- `main` is the integration base. Agent 1 (Claude, "main agent") integrates every branch onto `main` and keeps it green.
  Nobody else merges to `main`. Branch from `origin/main`; never merge an old `main` into your branch; catch up with
  `git fetch origin && git rebase origin/main`.
- Work merged on `main` today: the town built from tiles/sprites (`src/game/world`, `src/game/stage`, `src/game/art`,
  `scripts/art`, `art-src/`), the ending engine API (`src/engine/whatIf.ts`: straight-line 10/50/90 outcomes, one-decision
  what-if, "from the start" hypotheticals), UI kit + HUD (`src/ui`, `src/game/hud`), game flow (`src/game/GameScreen.tsx`,
  `src/game/flow`, `settings`, `audio`), building windows (`src/components/panels`, `BuildingWindow`), title + ending
  (`src/game/title`, `src/game/reveal`), richer offline AI content (`src/services/aiFallback.ts`), 250 engine property tests,
  docs (`README.md`, `docs/ARCHITECTURE.md`, `docs/INTEGRATION.md`, `docs/ART_PIPELINE.md`), QA report `docs/QA-pass-1.md`.
- Main agent is currently doing: the title backdrop (`src/game/title/TitleScene.tsx`, `art-src/title/scene/**`,
  `scripts/art/title-scene.mjs`) so it matches the town's art; fixing the last browser-test failures
  (`tests/title.browser.ts` picker-overlap test, `tests/reveal.browser.ts` no-decisions test, `tests/town.browser.ts` on the
  mobile project); integrating. **Do not touch those files or `src/engine/**`, `src/game/world/**`, `src/game/art/**`,
  `scripts/art/**`, `art-src/world/**`, `art-src/title/**`.**
- CI (`.github/workflows/ci.yml`) was red on `main` for hours because `AppShell.test` gave `finishGame` only 2 s on slow runners; fixed. Check https://github.com/SuhasProjects/financegamething/actions before assuming `main` is broken.
- Subagents: an AI-wiring subagent is integrating human Agent 5's Luminal/DeepSeek config (branch `ai-wiring`). Otherwise none running (six finished: agent2/4/5-finish, ai-content, engine-hardening, world-ring, qa-pass-1).
- Humans: Agent 3 pushes `agent3-windows`; Agent 4 (human) pushed `agent4-human` (deploy audit `docs/DEPLOY.md`, manual QA
  `docs/QA.md`, extra sprites). Both merged.

## Ground rules (every agent)

- Node 22. On the shared Mac: `export PATH=/Users/akhilesh/miniconda3/envs/fintown/bin:$PATH`. `npm install` once.
- Commands: `npm run dev` (http://127.0.0.1:5173), `npm run typecheck`, `npm test` (Vitest, ~380 tests), `npm run build`,
  `FV_PORT=<port> npm run test:browser` (Playwright: projects `desktop` 1366×768 and `mobile` 390×844; set a unique port per
  agent so parallel runs don't share a dev server). A single file: `FV_PORT=<port> npx playwright test tests/x.browser.ts --reporter=line`.
  Failure details: `test-results/<test>/error-context.md`.
- Browser runs rewrite screenshots: before committing run `git checkout docs/screenshots src/components/panels/screenshots`.
- Visual rules: `docs/agents/README.md` §2–§8 (palette CSS vars `--c-*` only, sizes in `calc(N * var(--px))`, fonts
  Pixelify Sans 700 / VT323 only, wood + parchment materials from `src/ui`, no gradients/blur/border-radius, laptop first).
- Stable accessible names that tests rely on: `docs/INTEGRATION.md` "accessible names" table. Never delete or weaken a test.
- No financial math in UI; numbers come from `@/engine` or the store.
- Commits: small, prefixed `[<area>]`, last line `Co-Authored-By: <your model name> <noreply@...>`. Push your branch early
  and often; report back with: files changed, test counts, anything outside your ownership that still needs doing.
- All green before each push: `npm run typecheck && npm test && FV_PORT=<port> npm run test:browser`. If a failure is in a
  file you don't own and you didn't cause it, say so in the report instead of editing it.

## Brief M — Mobile and small-laptop layout (branch `mobile-layout`, port 5191)

Goal: the game must not break at 390×844 (phone, stage zoom 1) and 1280×720 (small laptop, zoom 4). Laptop is the target;
phones only need to be usable.

Own: `src/game/hud/hud.css`, `src/game/flow/flow.css`, `src/game/GameScreen.css` (create if missing; import from
`GameScreen.tsx` — that one import line is yours), `src/game/title/title.css` **media-query blocks only** (the
`@media (max-width:639px)` / `(max-width:1099px)` rules), `src/components/panels/windows.css` media rules only, and new
test `tests/mobile.browser.ts`. Read first: `src/game/stage/GameStage.tsx` (how `--px` is set: `px = max(1, floor(min(w/320, h/180)))`),
`src/game/GameScreen.tsx` (layer order: HUD, status tools, ControlBar, modals, toasts, footer), `src/game/hud/Hud.tsx`,
`ControlBar.tsx`, `tests/helpers.ts` (`openTitle`, `startStory`, `expectReveal`).

Known problems (from `docs/QA.md`, `docs/QA-pass-1.md` and test runs):
1. 390×844: HUD board and control bar are sized in `--px` = 1px, so text is tiny and the control bar wraps; building
   buttons are partly under the HUD so taps fail (`tests/town.browser.ts` "town navigation…" fails on the mobile project;
   it taps `Open Pine Bank:` etc.). Fix: at zoom 1 the UI layer should use a floor of `--px: 2px` for text/controls (set a
   separate `--ui-px` variable on `.fv-ui` children = `max(2px, var(--px))` and use it in hud/flow CSS), keep the HUD to two
   rows (brand+date / four values) and the control bar to two rows at < 640px, and keep the world's core (320×180 at zoom 1,
   centred) fully visible between them (HUD max height 20% of viewport, control bar at bottom with `pointer-events: none`
   on empty space, buttons `pointer-events: auto`).
2. 1280×720: Pine Bank window reaches behind the control bar and clips (`docs/qa/bank-1280x720.png`). Window max height
   must be `100dvh - HUD - control bar - 4*px`, body scrolls inside (`ScrollArea`), header always visible.
3. Toasts clipped under the HUD at 1280×720: `src/game/flow/flow.css` toast stack top = HUD height + 2*px.
4. Title at 390×844: corner labels clipped, Continue button overlaps scenery text (`docs/QA-pass-1.md` #8).

Acceptance (write these in `tests/mobile.browser.ts`, mobile project only via `test.skip(testInfo.project.name !== 'mobile')`,
plus one 1280×720 test on desktop): no horizontal scroll; HUD, five buildings and control bar all visible without scrolling;
tapping each building opens its dialog (names `Pine Bank`… in `docs/INTEGRATION.md`); Bank window fits between HUD and control
bar at 1280×720 (`boundingBox` check); `Next month` advances; finish → reveal reachable. Existing `tests/town.browser.ts`
must pass on both projects.

## Brief W — Windows, dialogs and kit polish (branch `windows-polish`, port 5192)

Goal: fix the kit/window defects QA found; keep every panel number and accessible name unchanged.

Own: `src/ui/**` (except `src/ui/dev/**`), `src/components/panels/**` presentation only (no changes to actions, labels,
ids, validation), `src/components/town/PanelHost.tsx`, `src/components/flow/EventCard.tsx`. Read first: `src/ui/index.ts`,
`src/ui/Window.tsx` + `Window.css`, `src/ui/Modal.tsx`, `src/ui/Surfaces.css`, `src/components/panels/BuildingWindow.tsx`,
`windows.css`, `canonical/panels.test.tsx` (22 tests you must keep green), `src/components/panels/panels.browser.ts`
(stress route: `FV_PORT=5192 npx playwright test -c src/components/panels/playwright.config.ts`; it uses port 5174 — if busy,
change that config's port to 5194).

Defects:
1. `Window` renders the title plaque **below** the frame/body in modals (`docs/QA-pass-1.md` #4; `src/ui/Window.css`
   header order/positioning). The header must sit on top of the wood frame: plaque with the title centred, optional
   portrait slot left, help `?` and close `×` right, body below.
2. Windows overflow at 1280×720 (#4): `fv-window--lg` max height `calc(100dvh - 24 * var(--px))`, body `ScrollArea`.
3. `Tooltip` bubbles: verify they never take layout when hidden (fixed once with `display:none`; keep).
4. `Select`/`NumberField`/`Slider` visual consistency across Bank/Home/Market/Insurance windows (same heights, aligned
   labels, `$` prefix inside the field, focus ring 2 art px gold). Check each window at 1440×900 and 1280×720 by
   screenshot (`src/components/panels/screenshots/window-<id>.png`, you may commit these) and fix misalignment.
5. `EventCard`: option descriptions visible under each button; Type A receipt (gross / insurer paid / out of pocket from
   `event.shock`); pinned-notice look (`Tag` tones per README §8).
6. Button pressed/disabled frames and `aria-pressed` states in the gallery (`/?dev=ui`) must match the reference bars.

Acceptance: `npm test` (incl. panels tests) green; `tests/hud.browser.ts`, `tests/town.browser.ts`, panels stress suite
green on both projects; screenshots show the header on top of every window.

## Brief P — DONE by the main agent (on `main`: deps removed, lazy ending, a11y test). Skip.

### (old) Brief P — Performance, bundle and accessibility (branch `perf-a11y`, port 5193)

Goal: faster load, smaller bundle, keyboard-complete, no console errors.

Own: `package.json` dependency removals only (tell the main agent in the report which you removed), `vite.config.ts`
`build` options only, `index.html` (preload/meta), `src/main.tsx`, new `tests/a11y.browser.ts`, and small fixes in any
file **only** to remove a dependency import or fix a focus/aria bug (list each file+line in the report).

Tasks:
1. Dependencies: `recharts` is no longer used (ending charts are hand-written SVG) — confirm with
   `grep -rn "recharts" src api` and remove it. `framer-motion` is referenced only in `src/game/flow/ToastStack.tsx`
   (check) — replace with the kit's stepped CSS animation (`steps()` keyframes, respect reduced motion) and remove the
   package. Run `npm install` after editing `package.json`; commit `package-lock.json`.
2. Bundle: `npm run build` must finish without the "chunk larger than 500 kB" warning. Lazy-load `RevealScreen` and the
   `EngineHarness`/`UiGallery` dev routes with `React.lazy` + `Suspense` in `src/App.tsx` (that edit is approved; keep the
   routing logic intact; use a `Board` with "Loading…" as fallback). Keep the Web Worker (`src/engine/whatIf.worker.ts`)
   as a separate chunk. Report before/after sizes.
3. Fonts: ensure Pixelify Sans and VT323 are preloaded (`<link rel="preload" as="font">` for the two woff2 files Vite emits,
   or `@fontsource` CSS import order) so the title doesn't flash a fallback font.
4. Accessibility (`tests/a11y.browser.ts`, desktop): Tab order title → New Story → cards; in the game Tab reaches the HUD
   Timeline button, the five buildings in order, the control bar; every focused element shows the 2-art-px gold outline
   (computed `outline-style` solid or the building's hover frame visible); Esc closes windows and returns focus to the
   opener; skip link is first in Tab order and works (`docs/QA-pass-1.md` #9 says building focus outline is missing and
   the skip link is odd — verify and fix in `src/game/world/world.css` ONLY the `:focus-visible` rule, or report).
   No `console.error`/page errors across title → game → window → finish → reveal (route `/api/ai` to 503 in the test).
5. Lighthouse-style checks by hand: images `width/height` set, `<html lang>`, `<title>` "Fortune Valley", theme-color.

Acceptance: `npm run build` clean; all suites green on both projects; report lists removed deps and size deltas.

## Brief AF — DONE (branch `aspect-fit`): odd aspect ratios and landscape-only phones

Rules now in force (see `src/game/stage/scale.ts`, `GameStage.tsx`, `RotateOverlay.tsx`):
- `--px = max(1, floor(min(w/320, h/180)))` is never raised: one step up would always cut the 320×180 core. A window
  that shows past the 480×288 map (tall/narrow: 800×1000, 1024×1366; ultrawide: 5120×1440) gets the seamless
  `world/edge-tile` grass-and-pines border (`art-src/world/edge-tile.txt`), never a flat colour; the title mirrors its
  sky/mountain/hill layers beside the map and uses the same tile under the hills.
- The UI layer (`.fv-ui`) is inset to the map's edges (`--ui-left/top/right/bottom`, `data-fit`), so the HUD, control
  bar, toasts, tips and the coach sit on the town; town windows take the full viewport height when the map is shorter
  than the window (`data-fit=tall|both`). Opening tips dock on the border below the bar when there is room.
- Phones are landscape-only: `(max-width: 899px) and (orientation: portrait) and (pointer: coarse)` (plus a
  `max-device-width`/`hover: none` fallback) shows the "Turn your phone sideways" notice (`role=dialog`, `aria-live`)
  and makes the game inert underneath; state is kept. Tall desktop windows are not phones. The old
  `@media (max-width: 639px)` portrait-phone blocks are gone. Playwright: `mobile` (390×844) only runs
  `tests/mobile*.browser.ts` (notice checks); `mobile-landscape` (844×390, Pixel UA, touch) runs the whole suite.

## How to hand back

Push your branch, then write a report (≤150 words): branch + head commit, what changed (files), test counts
(typecheck / unit / browser per project), anything outside your ownership that needs doing (file + line). The main agent
rebases and integrates onto `main`.
