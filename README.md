# Fortune Valley

A cozy pixel-art life sim about money, in the browser. Fictional educational simulation; every assumption is illustrative.

**How a game goes:** a Stardew-style title screen (New Story, Custom Story, Continue) → a sunny top-down town built from
tiles and sprites, with five buildings where you make your money decisions (Pine Bank, Town Office, Health House, Your
Home, Market Hall) → time passes month by month (36 months by default, one month every 15 s on auto-time; Type A shocks and AI/offline Type B opportunities
along the way) → **the ending**: the same town at dusk under a parchment ledger showing where 1,000 replays of your
strategy landed, as straight lines from your starting net worth to the 10th percentile ("unlucky"), median ("typical")
and 90th percentile ("lucky") endings plus a gold line for what actually happened, and a **what-if**: change any one of
your past decisions and see the same 1,000 futures (same luck) re-run beside the original.

## Setup

Node 22 (`.nvmrc`; `engines` allows 20+).

```bash
npm install
npm run dev          # http://localhost:5173
```

Copy `.env.example` → `.env` if you want the AI gateway; without a key the game plays fully offline (see Deploy).

## npm scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server; also serves `POST /api/ai` through `server/aiDevMiddleware.ts` |
| `npm run build` | Typecheck (`tsconfig.json`) then production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` for the app and the Node configs |
| `npm run lint` | App typecheck only |
| `npm test` | Vitest: `tests/**/*.test.ts` and `src/**/*.test.tsx` (185 tests at the time of writing, ~3 s) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:browser` | Playwright Chromium, `tests/*.browser.ts`, projects `desktop` (1366×768) and `mobile` (390×844) |
| `npm run art` | Compile every `art-src/**/*.txt` grid to `public/art/**` PNG + JSON, build the ground/water layers, regenerate `src/game/art/manifest.ts` and `src/styles/palette.css` |
| `npm run art:palette` | Regenerate only `src/styles/palette.css` from `art-src/palette.json` |
| `npm run art:extract` | Cut a region of the reference image into a text grid (`-- --rect x,y,w,h [--cell 6.9] [--materials] [--out file]`) |
| `npm run art:clean` | Mechanical cleanup of an extracted grid (`-- file.txt [--keep-largest] [--strip keys] [--replace a=b] [--crop] [--pad N] [--out file]`) |
| `npm run art:preview` | Zoomed PNG of a grid's frames and variants into `.art-preview/` (`-- art-src/…/name.txt [--scale 8]`) |
| `npm run art:compare` | Reference vs. a town screenshot vs. a 50/50 blend, stacked into `.art-preview/compare.png` |

The art pipeline is documented in [docs/ART_PIPELINE.md](docs/ART_PIPELINE.md). Compiled PNGs and the manifest are
committed, so the build never runs the pipeline.

### Browser tests in parallel

`playwright.config.ts` starts `npm run dev` on `FV_PORT` (default 5173) and points the tests at it, so several checkouts
or worktrees can run browser tests at the same time:

```bash
FV_PORT=5181 npm run test:browser
FV_PORT=5182 npx playwright test tests/world.browser.ts --project=desktop
```

Browser tests stub `/api/ai` with a 503, so they never need a key. They rewrite `docs/screenshots/*.png`; do not commit
those changes. Agent 3's panel stress suite has its own config: `npx playwright test -c src/components/panels/playwright.config.ts`
(port 5174).

### Dev routes

| URL | Shows |
|---|---|
| `/?dev=engine` | Plain-text engine harness (`src/dev/EngineHarness.tsx`): run months, apply actions, inspect state |
| `/?dev=ui` | UI kit gallery (`src/ui/dev/UiGallery.tsx`): every `src/ui` component in every state |
| `/src/ui/dev/index.html?scale=4` | Standalone gallery page used by `tests/hud.browser.ts` (scales 3, 4, 6) |

## AI gateway

Copy `.env.example` → `.env` and set `AI_API_KEY` (server-side only; never `VITE_`). `npm run dev` serves `POST /api/ai` through a Vite middleware; on Vercel the same handler runs as `api/ai.ts`. Without a key the app uses clearly labeled offline fallbacks. The example uses Luminal's DeepSeek V4.1 Flash endpoint. `AI_ENABLED=false` forces fallback; `VITE_AI_OFFLINE=true` skips the network entirely in the browser.

Any OpenAI-compatible endpoint works too: set `AI_PROVIDER=openai_compatible`, `AI_BASE_URL`, `AI_MODEL` and `AI_API_KEY`; `AI_AUTH_HEADER=api-key` switches from a bearer token to an `Api-Key` header. Output is still Zod-verified and the engine re-validates every effect.


## Deploy

- **Vercel.** `vercel.json` gives `api/ai.ts` a 30 s max duration; everything else is a static Vite build. Point the
  project at `main`.
- **Server-side env vars** (never `VITE_`-prefixed): `AI_API_KEY`, `AI_MODEL` (default `claude-opus-5-5`), `AI_ENABLED`
  (`false` forces fallback), `AI_TIMEOUT_MS` (default 25000), and for any OpenAI-compatible endpoint `AI_PROVIDER=openai_compatible`,
  `AI_BASE_URL`, `AI_AUTH_HEADER` (`bearer` or `api-key`). Full request/response examples in [docs/AI_API.md](docs/AI_API.md).
- **Offline fallback.** With no key, a disabled gateway or any upstream failure, the browser client (`src/services/aiClient.ts`)
  returns deterministic offline content labelled `source: 'fallback'` (scenario mapping, Type B opportunities, the
  ending explanation). The game is fully playable offline; `VITE_AI_OFFLINE=true` skips the network entirely.
- CI (`.github/workflows/ci.yml`) runs typecheck, unit tests, build and the Chromium browser suite on every push to
  `main` and every PR.

## Where things live

```
src/engine/            pure, deterministic engine: monthly accounting, actions, Monte Carlo, whatIf.ts (+ Web Worker)
src/types/domain.ts    authoritative types
src/config/            assumptions, bounds, archetypes          src/services/   AI client + offline fallbacks
src/stores/            Zustand game store (save/resume, finish)  api/, server/   AI gateway (Vercel fn + Vite middleware)
src/App.tsx            screen router                            src/game/GameScreen.tsx   the town screen
src/game/stage/        GameStage: integer zoom, --px            src/game/world/           TownWorld: ground, sprites, dusk
src/game/art/          Sprite component + generated manifest    src/game/hud/             Hud, ControlBar, StatusTag, HudFooter
src/game/flow/         toasts, timeline, activity, confirm      src/game/settings/, audio/  options, sfx
src/game/title/        TitleScreen, StoryPicker, CustomStoryLetter, GuideWindow
src/game/reveal/       RevealScreen, OutcomeChart, WhatIfSection, ChangeStrip
src/ui/                wood/parchment UI kit                    src/components/panels/    the five building panels
art-src/               text-grid pixel art + palette.json       public/art/               compiled sprites
scripts/art/           the art pipeline                         tests/                    unit, engine and browser tests
docs/agents/           the build plan each agent worked from (kept as written)
```

Docs: [ARCHITECTURE.md](docs/ARCHITECTURE.md) (layers, accounting order, randomness, Monte Carlo, the ending data flow),
[INTEGRATION.md](docs/INTEGRATION.md) (public contracts, accessible names, file ownership), [AI_API.md](docs/AI_API.md),
[ART_PIPELINE.md](docs/ART_PIPELINE.md).
