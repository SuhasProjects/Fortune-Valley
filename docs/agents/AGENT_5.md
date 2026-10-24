# Agent 5 — Title screen, custom story, and the reveal

Branch name: `agent5-title-reveal`. The game must open like a game, not a website.

## What you own
`src/components/landing/**`, `src/components/title/**` (new), `src/components/reveal/**`, `src/styles/welcome.css`,
`src/data/scenarios.ts`, `src/main.tsx`.

You do not touch: engine, store, panels, town scene, HUD, flow components, kit internals.

## Context you need

- Today `App.tsx` renders `<Landing/>` when `store.game` is null. `Landing.tsx` is a long web page: sticky header with
  disabled Sign in/Create account, "How it works", hero, starting-life buttons wired to `store.startGame(config)`, a
  personalized-question form wired to `store.generatePersonalized(prompt, numbers)` (returns `{ config, fallback, warnings }`),
  a saved-game block (`store.savedGame`, `loadSavedGame`, `clearSavedGame`), FAQ. Styles in `welcome.css`. It has useful copy;
  it is the wrong first screen.
- Starting lives: `src/data/scenarios.ts` exports `scenarios: GameConfig[]`, `scenarioCards` (`id`, `title`, `description`,
  `focus`), `freshScenario(id)` for a random seed. Archetype ids: `college_student`, `entry_worker`, `professional`,
  `young_family`. Titles: College Student, Entry-Level Worker, Professional, Young Family (browser test clicks buttons by
  those names).
- Reveal: `src/components/reveal/RevealChart.tsx` renders `FinishPayload` (`config`, `finalState`, `policyLog`, `monteCarlo`,
  `explanation?`). It is mounted by App inside `PanelHost title="Your next chapter"` with `onReset={store.resetGame}`.
  Everything it shows comes from `monteCarlo` (`bands[m].p10/median/p90`, `endingNetWorths` sorted, `observedNetWorth`,
  `percentileOfObserved`, `observedHorizonMatches`, `probabilityNegativeNetWorth`, `probabilityLiquidityShortfall`,
  `comparison?.a/b` with `.bands`, `.median`, `pairedMedianDifference`, `probabilityAOutperformsB`, `assumptionsSummary`) plus
  `histogram(endingNetWorths, 20)` from `@/engine`, the only helper allowed. `REVEAL_COLORS` are validated for colour-blind
  separation; keep them. `store.requestExplanation(question)` fills `finishPayload.explanation` asynchronously with
  `{ text, source: 'ai' | 'fallback' }`. Test: `RevealChart.test.tsx`.
- Kit from Agent 2 (`@/components/layout/ui`): `PixelPanel`, `PixelButton`, `PixelInput`, `PixelSelect`, `PixelDialogFrame`,
  `PixelTag`. Art: `docs/art-reference/ART_DIRECTION.md`; backgrounds `public/art/title-bg.png` and `reveal-bg.png` arrive
  from Agent 2 later; until then use a flat `#96c450` background so layout work is not blocked.
- Agent 3 is making the reveal dialog `width="full"` (94 vw) when the title is `Your next chapter`, so the charts get room.
- Browser test `tests/town.browser.ts` currently expects the landing heading `Small choices. A clearer financial future.`,
  a starting-life button `Entry-Level Worker`, and at the end checks results text. You will change the entry screen, so
  you must update those lines in the same commit.

## Tasks, in order

### 1. Title screen (first PR)
- New `src/components/title/TitleScreen.tsx` rendered by App when there is no game (coordinate the one-line change in
  `App.tsx` with Agent 4; they are extracting the HUD and will leave that line for you).
- Full-viewport stage with `title-bg.png` (`object-fit: cover`, `image-rendering: pixelated`, laptop first). Over it:
  - Hanging wooden sign, HTML: two rope lines from the top edge, a wood `PixelPanel variant="wood"` 60% of the width, big
    `FORTUNE VALLEY` in Pixelify Sans 700 (two lines, cream over gold), and vines: an inline SVG of 5-pixel leaf shapes
    along the top edge and down both sides, clearly visible (leaf size ≥ 18 px on a 1440 screen).
  - Three `PixelButton`s in a horizontal row near the bottom: `Play a story`, `Custom story`, `Options`. Keyboard: arrows
    move, Enter activates; focus ring visible.
  - Small `Continue <title> · month n` button appears above the row when `store.savedGame` exists; `Delete save` as text button.
- `Play a story` opens a `PixelDialogFrame` with the four starting lives as cards (title, two-line description, focus tag) and
  `Begin` → `store.startGame(freshScenario(id))`. Keep button accessible names equal to the titles.
- `Options` opens a small frame: fullscreen toggle (`document.documentElement.requestFullscreen`), reduced-motion note,
  "How it works" link that opens the explainer (task 3). Nothing else; it is allowed to be thin.

### 2. Custom story screen
- `Custom story` opens a frame with the existing personalized form (move the logic out of `Landing.tsx`): free-text prompt,
  optional numbers, the privacy note "don't enter real account numbers or names", submit → `store.generatePersonalized`.
  Show loading state (`store.personalizationLoading`), warnings, and a `PixelTag` `Offline draft` when `fallback` is true.
  On success call `store.startGame(result.config)`.

### 3. Fold the old landing into an explainer
- Turn `Landing.tsx` into `HowItWorks.tsx`: the three steps, the five-building guide, the monthly cycle, the 1,000 futures
  explanation, FAQ. Opened from Options and from a small `?` button on the title screen. Drop the fake Sign in / Create
  account controls and the marketing hero. Fix the copy that says time only moves when you click: time advances every 60
  seconds unless paused, and you can press Next month any time.
- Delete `TownIllustration.tsx` and unused `welcome.css` rules when nothing references them.

### 4. Reveal polish (`RevealChart.tsx`)
- Fan chart: hover crosshair with a parchment tooltip showing month, p10, median, p90 and your run; direct end labels
  `Median` and `You` at the right edge instead of a legend row.
- Toggle `Your strategy` / `Default policy` (two `PixelButton`s, `aria-pressed`) switching the band and median between
  `monteCarlo.bands` and `comparison.b.bands`; disabled with a note when `comparison` is absent.
- `Why?` button next to the explanation: `PixelInput` for the player's question, submit → `store.requestExplanation(question)`;
  show loading, then the text with its `source` tag (`AI` or `Offline template`).
- Layout on the full-width dialog: hero number left, four stats right, fan chart full width, histogram and comparison side
  by side at ≥ 1200 px, stacked below. Background `reveal-bg.png` behind a parchment `PixelPanel`.
- Keep the percentile sentence and the "not a grade" wording. Never compute a statistic in the component.

### 5. Tests
- `src/components/title/TitleScreen.test.tsx`: renders three buttons, Play opens the four lives, choosing one calls
  `startGame`, saved-game button shows when `savedGame` is set (mock the store with `useGameStore.setState`).
- Update `RevealChart.test.tsx` for the toggle and Why button (mock `requestExplanation`).
- `tests/town.browser.ts`: replace the landing heading assertion with the title sign text `FORTUNE VALLEY`, click
  `Play a story` then `Entry-Level Worker`, keep everything after that unchanged. Regenerate `docs/screenshots/*-landing.png`
  and `*-results.png` from a passing run.

## Rules
- Game first: no header navigation, no account placeholders, no marketing sections on the first screen.
- Laptop first; 390 px must not overflow horizontally but may stack the three buttons.
- No statistics computed in React; no new npm dependencies.

## Acceptance
- Opening the app shows the title screen with the sign, vines and three buttons over the generated (or stand-in) background.
- Play a story and Custom story both start a game; Continue works when a save exists.
- Reveal has crosshair, direct labels, strategy toggle and Why button, all values from `monteCarlo`.
- Unit and browser tests green with the updated entry flow.
