# Agent 5 handoff

Branch `agent5-finish` (base `agent5-integrate`). The title and ending are routed directly by `App.tsx`; the landing
and fan-chart shims are gone.

## Public components

- `TitleScreen()` (`src/game/title/TitleScreen.tsx`): menu, story picker, custom-story letter, Guide, Options.
- `GuideWindow({ onClose })`: kit `Modal` named `Guide` with kit `Tabs` (How to play, The town, Controls, FAQ, About).
- `RevealScreen({ payload, onPlayAgain })` (`src/game/reveal/RevealScreen.tsx`): ledger `Board` over `TownWorld timeOfDay="dusk"`.
- `OutcomeChart({ lines, yDomain, title, highlightLabel? })`: hand-drawn SVG, straight lines from engine endpoints only.
- `WhatIfSection`: `listDecisions` + `runWhatIfAsync`; decisions whose id starts with `hyp:` are grouped under
  "What if, from the start" (an `<optgroup>` select mirroring the kit's `Select` markup, since `Select` has no groups).
  The empty card only shows when `listDecisions` returns nothing.

## Materials

Everything comes from `src/ui` (`Button`, `Board`, `Modal`, `Tabs`, `Field`, `Select`, `Inset`, `Plaque`, `Tag`, `Icon`).
`src/game/title/contracts.tsx` only holds the stage wrapper, scale hook, click sound, reduced-motion flag and the Options
modal. No `.pixel-*` classes remain in these folders.

Known cross-ownership issue: `src/game/world/world.css` defines `.fv-plaque { position:absolute … }` for building name
plates, which collides with the kit's `.fv-plaque` (window titles). `title.css` restores the kit look inside our windows;
Agents 1 and 2 should rename one of them.

## Scene

Agent 1 is rebuilding `TitleScene.tsx` and the scene-layer grids in `art-src/title/` (sky, mountains, forest, meadow,
path, flowers, cottages). Agent 5 keeps the sign, vines, ropes (`sign.txt`, `sign-small.txt`, `vine-*.txt`, `.fv-sign*`,
`.fv-vine*`, `.fv-ropes`), portraits, favicon, menus and the ending. The scene CSS still in `title.css`
(`.fv-valley`, `.fv-sky-band`, `.fv-mountains*`, `.fv-haze*`, `.fv-forest`, `.fv-meadow`, `.fv-valley-path`,
`.fv-cottage*`, `.fv-flowers`) can be moved or replaced by Agent 1.

## Tests

- `tests/helpers.ts`: `openTitle`, `expectOnTitle`, `startStory` (clicks **New Story**, then the life card),
  `expectReveal` (`main` named `Simulation results` containing `Same strategy, 1,000 futures`), `leaveReveal`.
- `tests/title.browser.ts` includes a card-overlap assertion and a plain (non-forced) click on each of the four cards.
- `tests/reveal.browser.ts` "finishing without decisions explains how to unlock comparisons" expects the empty card;
  once the engine returns `hyp:` decisions for an empty log, change it to expect the grouped select instead.
- Screenshots: `node scripts/dev/shots.mjs <outDir>` (needs a dev server on `FV_PORT`, default 5181;
  `FV_VIEWPORT=1280x720` for the laptop size).
