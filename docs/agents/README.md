# Fortune Valley — team plan for the final stretch

Five agents, five branches, no shared files. Each agent has one doc in this folder with everything it needs; it should
not need to explore the repo beyond the files it owns.

| Agent | Doc | One-line job |
|---|---|---|
| 1 | [AGENT_1.md](AGENT_1.md) | Integrator: merges everyone, hardens the engine, verifies live AI, gets the deploy right |
| 2 | [AGENT_2.md](AGENT_2.md) | Art and UI kit: puts the reference image and generated art in, builds the parchment/wood component kit |
| 3 | [AGENT_3.md](AGENT_3.md) | Panels: re-skins the five building dialogs with the kit, keeps every number engine-backed |
| 4 | [AGENT_4.md](AGENT_4.md) | Town screen and flow: the image-backed town, HUD and controls over it, toasts, saving and finishing feedback |
| 5 | [AGENT_5.md](AGENT_5.md) | Title screen and reveal: game-first entry with the hanging sign, custom-story flow, results polish |

## Plain-English summary (for the humans)

- **Agent 1** is the referee. Nobody else merges. It also writes the last engine tests, runs the AI gateway against a real
  key once we have one, writes the exact deploy checklist for whoever owns Vercel, and keeps the docs truthful.
- **Agent 2** makes the game look like the reference picture. It ships the picture itself as the town background, generates
  the title and results backgrounds in the same style, and builds the shared buttons, panels, inputs and toasts so every
  other agent uses one visual language instead of inventing their own.
- **Agent 3** owns the five building dialogs (Bank, Office, Home, Health House, Market). Their logic is finished and
  tested; the job now is to dress them in Agent 2's kit without changing a single number, and make the help and preview
  areas read well on parchment.
- **Agent 4** owns the screen you play on. It replaces the current town art with the reference image, lines up the clickable
  buildings, rebuilds the HUD and the bottom controls as HTML that sits exactly where the picture's HUD is, and finishes the
  small flow items: decision toasts first, a "computing 1,000 futures" state, a saved indicator, a reset confirmation.
- **Agent 5** owns the first and last thing the player sees. The first screen becomes a proper game title screen (hanging
  "Fortune Valley" sign with vines, three wooden buttons) instead of a web landing page, the custom-story question flow gets
  its own screen, and the results screen gets the hover crosshair, labels, strategy toggle and "Why?" button.

## Facts everyone needs

- Repo `SuhasProjects/financegamething`. Branch from **current `main`** (`git fetch origin && git switch -c <branch> origin/main`).
  Never merge an old `main` into your branch; three times today that reverted other people's work.
- Node 22. On the Mac that ran today's integration Node lives in a conda env:
  `export PATH=/Users/akhilesh/miniconda3/envs/fintown/bin:$PATH`. Elsewhere any Node 22 works (`.nvmrc`).
- Commands: `npm install`, `npm run dev` (http://127.0.0.1:5173), `npm run typecheck`, `npm test` (Vitest, ~117 tests),
  `npm run test:browser` (Playwright Chromium, desktop 1366×768 and mobile 390×844, ~10 tests), `npm run build`.
- Before every push: `npm run typecheck && npm test && npm run test:browser`. If a dialog or panel changes what it shows,
  update `tests/town.browser.ts` in the same commit. Do not delete another agent's test or file; retarget stale tests.
- No financial math in UI code. Every number comes from `@/engine` or the store. If a number is missing, ask Agent 1.
- Keep PRs small. Tell Agent 1 the branch name when it is ready. CI (`.github/workflows/ci.yml`) runs typecheck, tests,
  build and browser tests on every PR.
- Path alias `@/` means `src/`. React 19, TypeScript, Vite, Zustand store, Recharts, Tailwind available but mostly plain CSS.

## File ownership (exclusive; touching someone else's files needs their OK in the PR)

| Agent | Owns |
|---|---|
| 1 | `src/engine/**`, `src/types/domain.ts`, `src/config/**`, `src/fixtures/**`, `src/services/**`, `api/**`, `server/**`, `tests/engine/**`, `.github/**`, `vercel.json`, `vite.config.ts`, `package.json`, `docs/*.md` (top level), `README.md` |
| 2 | `public/art/**`, `src/components/layout/ui/**`, `src/styles/pixel-tokens.css`, `src/components/layout/PixelArt.tsx`, `docs/art-reference/**`, `docs/TOWN_HANDOFF.md` |
| 3 | `src/components/panels/**`, `src/components/town/PanelHost.tsx` |
| 4 | `src/components/town/TownScene.tsx`, `src/components/town/buildings.ts`, `src/components/flow/**`, `src/components/layout/FullscreenGameView.tsx`, `src/components/layout/GameShell.tsx`, `src/hooks/**`, `src/stores/**`, `src/styles/game-viewport.css`, `src/styles/world.css`, `src/App.tsx` |
| 5 | `src/components/landing/**`, `src/components/title/**` (new), `src/components/reveal/**`, `src/styles/welcome.css`, `src/data/scenarios.ts`, `src/main.tsx` |

Shared, edit sparingly and only the lines you need: `tests/town.browser.ts`, `src/styles/index.css` (imports only),
`docs/screenshots/**` (regenerate only from a passing browser run).

## Merge order (Agent 1 runs this)

1. Agent 2's kit API PR (component names and props, basic styling) within the first two hours, so 3, 4 and 5 can import it.
2. Agent 4's town stage and HUD. 3. Agent 3's panel re-skin. 4. Agent 5's title and reveal. 5. Agent 2's generated images
and polish. 6. Agent 1's engine tests and deploy docs, continuously.

## Art direction

Everything visual follows `docs/art-reference/ART_DIRECTION.md` and the reference image next to it. Read it before any UI work.
