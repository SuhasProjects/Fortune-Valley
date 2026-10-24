# Next steps per agent (from Agent 1, integrator) — as of main e1e6747+

Current state of `main`: engine, AI gateway, store, town shell, canonical panels, save/resume, Monte Carlo reveal chart, CI workflow. 102 unit/integration tests + 6 Chromium browser tests pass. Fresh clone verified.

## Rules for everyone (these caused real breakage today)

1. **Branch from current `main` every time.** Do not merge an old copy of main into your branch; it reverts other people's work (happened twice).
2. **Before every push:** `npm run typecheck && npm test && npm run test:browser`. If you change what a dialog or panel shows, update `tests/town.browser.ts` in the same commit.
3. **Do not delete another agent's tests or files.** If a test is stale, retarget it and say so in the PR.
4. **No financial math in UI.** Use engine exports (`@/engine`). If you need a number the engine doesn't give you, ask Agent 1; don't compute it.
5. Keep PRs small; the integrator merges continuously. Ping Agent 1 with the branch name when something is ready.

## Agent 2 — Town / shell / visual system (`frontendpixelart`)

1. **Pixel UI kit for the panels.** Agent 3's canonical panels are unskinned on purpose and are waiting for your components. Create `src/components/layout/ui/` exporting `PixelPanel`, `PixelButton`, `PixelInput`, `PixelSelect`, `PixelSlider`, `PixelToast`, styled with the tokens in `src/styles/pixel-tokens.css` + `world.css`. Document props in `docs/TOWN_HANDOFF.md`. Then style `src/components/panels/PanelShell.tsx` zones (status / decision / consequence) and the `aside[aria-label="12-month policy preview"]`.
2. **Reveal dialog:** the `PanelHost` dialog is 620px wide; the fan chart and histogram in `src/components/reveal/RevealChart.tsx` need ~700px to breathe. Either widen the dialog for the reveal (`title="Your next chapter"`) or give the reveal a full-screen variant. Keep the chart colors (`REVEAL_COLORS`); they were validated for colorblind separation.
3. **Landing:** style the "Saved game / Continue" block (already functional) and the status tag states `AI DIRECTOR ONLINE` / `OFFLINE SIMULATION` / `PREPARING OPPORTUNITY`.
4. **Event cards inside building dialogs** (`EventCard` in `components/flow`) need the pixel treatment; they are how Type A/B events are answered.
5. Regenerate `docs/screenshots/` from `npm run test:browser` only after the above; don't commit screenshots from a failing run.

## Agent 3 — Building panels (`agent3-panels`)

Engine now provides everything `src/components/panels/MISSING.md` asked for. Resolve each item and delete MISSING.md when done:

1. **12-month preview:** `PolicyPreview` is now wired to `previewHorizon(state, { policy }, 12)` (Agent 1 did this). Extend it: Home should preview `household.discretionaryMonthly` and Insurance should preview `insurance` overrides — `previewHorizon` accepts `{ policy?, household?, insurance? }`. Bank's one-time payment is not a policy; preview it with `previewMonth(state, …)` after applying `make_extra_payment` on a cloned state via `applyAction` (no math, just the engine).
2. **Office:** use `selectPaySummary(state)` for gross / income tax / payroll / take-home per month, and show `note` (illustrative withholding label).
3. **Events:** App now renders `EventCard` for every active event of the open building above your panel (Office keeps its own job-offer UI; those are excluded to avoid duplicates). If you want events inside `PanelShell` instead, render `state.activeEvents.filter(e => e.buildingTarget === building)` yourself and tell Agent 1 so the App fallback is removed.
4. **Market:** show `state.marketState.lastMonthlyReturns` and `state.assumptions.assets` (expected return / volatility) next to the allocation controls; use `validateAllocation` from `@/engine` for inline validation.
5. **Insurance:** use `settleClaim(cost, plan)` from `@/engine` to show "a $5,000 medical bill would cost you $X under each plan" (deterministic, no probabilities).
6. **Tests:** your `src/components/panels/canonical/panels.test.tsx` and `panels.browser.ts` are the panel suite; keep them green. The root browser test now covers Bank savings persistence only.
7. Adopt Agent 2's UI kit as soon as it lands; do not write local CSS for pixel styling.

## Agent 4 — Flow: notifications, clock, timeline (`agent4-flow`)

1. **Autoplay:** `src/hooks/useGameClock.ts` exists but nothing uses it. Add a play/pause speed control to `GameClock` (1 month / 2 s, 1 month / 0.5 s) wired to `store.advanceOneMonth` + `setPaused`; pause automatically when a Type B event is enqueued or the game finishes.
2. **Type B surfacing:** when `store.aiStatus` becomes `online/offline` after a request and a new event appears in `game.activeEvents`, show a `decision` toast that opens the building (`relatedBuilding`). The store already pushes a `decision` notification on `enqueue_event`; make sure the stack prioritises it over routine `info` toasts.
3. **Timeline drawer:** `TimelineDrawer` and `NotificationHistory` components are unused since the redesign (App renders lists inside `PanelHost`). Either delete them or make App use them — don't leave both.
4. **Finish flow:** `finishGame()` runs 1,000 paths + the paired comparison synchronously (~1 s). Show a "Computing 1,000 futures…" state before calling it (e.g. `requestAnimationFrame` then `finishGame()`).
5. **Save/resume UX:** store exposes `savedGame`, `loadSavedGame`, `clearSavedGame`, `refreshSavedGame`. Add a "Game saved" subtle indicator after each month and confirm before `resetGame` when a save exists.
6. **Store test** for autoplay pausing on finish/event.

## Agent 5 — Reveal (if/when present)

1. The default reveal is `src/components/reveal/RevealChart.tsx`, mounted via App's `renderReveal` fallback. Own that file: improve layout, add hover crosshair on the fan chart, direct labels on the median/observed lines, and a toggle between "Your strategy" and "Default policy" bands using `monteCarlo.comparison.a/b.bands`.
2. Show `payload.explanation` with its `source` label; add a "Why?" button that calls `store.requestExplanation(question)` with the player's own question.
3. Never compute statistics in the component; everything comes from `MonteCarloResult` (`histogram()` from `@/engine` is the only helper).

## Agent 1-core (Vaishnav) — engine hardening

1. Coordinate with Agent 1 (Akhilesh) before changing engine semantics (`advanceMonth` order, funding order, replay rules). Open small PRs; the integrator will merge within the hour.
2. Good next targets: property tests for `allocateAmount` conservation, `parseSave` fuzzing (malformed JSON, NaN, huge arrays), and `validateNarrativeEvent` against the AI schema in `api/_lib/schemas.ts` (they must accept/reject the same shapes).
3. When an AI key is available: run `tests/engine/ai-gateway.test.ts` patterns against the live gateway and record results in `docs/AI_API.md`.

## Deployment owner (whoever has the Vercel project)

1. Connect the Vercel project to `SuhasProjects/financegamething`, production branch `main`, and redeploy. The live site is still an old build and its AI route crashes; the fix is on main (`34aa7d8`).
2. Set env vars (server-side only, never `VITE_`): `AI_API_KEY`, and for Luminal `AI_PROVIDER=openai_compatible`, `AI_BASE_URL`, `AI_MODEL`. Redeploy after setting.
3. Enable GitHub Actions on the repo so `.github/workflows/ci.yml` runs on PRs.
4. Luminal: the key provided works for `images.luminal.cloud` but every text endpoint rejects it. Get the text API base URL + a text-enabled key from Luminal; then it's a config change.
