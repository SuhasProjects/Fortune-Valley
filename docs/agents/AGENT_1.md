# Agent 1 — Integrator, engine, AI gateway, deployment readiness

Branch name: `agent1-integration`. You are the only one who merges to `main`.

## What you own
`src/engine/**`, `src/types/domain.ts`, `src/config/**`, `src/fixtures/**`, `src/services/**`, `api/**`, `server/**`,
`tests/engine/**`, `.github/**`, `vercel.json`, `vite.config.ts`, `package.json`, top-level `docs/*.md`, `README.md`.

## Context you need (so you do not have to read the repo)

- Engine public API is `src/engine/index.ts`. Key exports: `createGame`, `advanceMonth`, `applyAction`, `runMonteCarlo`,
  `compareStrategies`, `previewMonth`, `previewHorizon`, `selectPaySummary`, `settleClaim`, `validateAllocation`,
  `histogram`, `parseSave`, `serializeSave`, `netWorthOf`. Contracts and the accounting order are in `docs/INTEGRATION.md`
  and `docs/ARCHITECTURE.md`. Money is in cents-conserving dollars via `round2` and largest-remainder allocation.
- Monte Carlo: 1,000 paths replaying `policyLog` from month 0 with alternate luck; paired `comparison` against the default
  policy; `observedNetWorth` is computed from the real state, never inserted. Bounds: paths 1–10,000, months 1–240.
- Save: one slot in `localStorage` under `SAVE_STORAGE_KEY`, `SAVE_SCHEMA_VERSION`, validated by `parseSave`.
- AI gateway: `api/ai.ts` (Vercel function) and `server/aiDevMiddleware.ts` (Vite dev). Shared code in `api/_lib/`:
  `handler.ts`, `prompts.ts` (scenario mapper, Type B director, outcome explainer), `schemas.ts` (Zod for request and
  model output), `rateLimit.ts`, `openaiCompatible.ts`. Env (server only): `AI_API_KEY`, `AI_MODEL`
  (default `claude-opus-5-5`), `AI_ENABLED`, `AI_TIMEOUT_MS`, and for OpenAI-compatible hosts `AI_PROVIDER=openai_compatible`,
  `AI_BASE_URL`, `AI_AUTH_HEADER`. Browser falls back to `src/services/aiFallback.ts` on any failure.
- The Luminal key we were given authenticates on `images.luminal.cloud` only. Every text endpoint rejected it. Agent 2 uses
  it for image generation. Text AI needs an Anthropic key or a text-enabled Luminal key.
- Tests: `tests/engine/*.test.ts` (accounting boundaries, events, preview compare, config validation, gateway against a fake
  server, ESM import of the API). `src/stores/useGameStore.test.ts` is Agent 4's.
- Live site `financegamething.vercel.app` was still serving an old build at 19:53 and its `/api/ai` returns 500. Nobody on the
  team currently has access to the Vercel project; evidence suggests it is connected to the fork
  `randyphantom21-commits/financegamething`. The fix for the 500 (`34aa7d8`, Node ESM import) is on `main`.
- Build warns about a large bundle. Recharts is only used by the reveal.

## Tasks, in order

### 1. Integration duty (continuous)
- Merge PRs in this order: Agent 2 kit API → Agent 4 town stage/HUD → Agent 3 panels → Agent 5 title/reveal → Agent 2
  images and polish. Rebase or ask for a rebase when a PR is behind `main`; never merge a branch that is 20+ commits behind
  without checking `git diff origin/main...branch --stat` for deletions of other people's files.
- After each merge: `npm run typecheck && npm test && npm run test:browser && npm run build` on `main`. Fix or revert
  within the hour.
- Conflicts in `src/App.tsx` (Agent 4 HUD vs Agent 5 entry screen) and `tests/town.browser.ts` are yours to resolve.
- Delete merged branches: `agent3-market-finish`, `agent5-expanded-landing`, `agent5-landing`, `fullscreen-game-v2`,
  `fullscreen-game`, `agent1-core`, `agent4-flow`, `agent3-panels`, `Financial-Engine`. Do not merge `agent4-fullscreen`
  or `frontendpixelart` (both 50 commits behind; the only thing of value there is Agent 2's canvas renderer idea, now superseded
  by the reference image).

### 2. Engine hardening tests (new files under `tests/engine/`)
- `conservation.property.test.ts`: for 500 random states and transfers/allocations, `cash + savings + investments − debts`
  changes only by the documented flows; allocation weights that sum to 1 produce cent-exact splits (`round2`).
- `parse-save.fuzz.test.ts`: `parseSave` must return a rejection, never throw, for malformed JSON, wrong schema version,
  `NaN`/`Infinity` numbers, negative months, 100k-element arrays, prototype-pollution keys, and truncated strings. Also
  round-trip: `parseSave(serializeSave(state))` deep-equals the state for the four archetypes after 24 months.
- `narrative-schema-parity.test.ts`: the engine's narrative validation (`src/engine/validation.ts` → `validateEffect` and the
  enqueue path in `actions.ts`) and `api/_lib/schemas.ts` must accept and reject the same 20 fixtures (valid templates,
  unknown effect kind, out-of-bounds amounts, wrong building, expired month, duplicate option ids).
- Keep each file under 200 lines; use `@/fixtures` for states.

### 3. Live AI verification (as soon as any text key exists)
- Put the key in a local `.env` (never commit). Run `npm run dev` and `curl` the three prompt kinds against
  `http://127.0.0.1:5173/api/ai` using the request bodies in `docs/AI_API.md`. Verify Zod accepts the real model output
  for scenario mapper, Type B director, and explainer. Record provider, model, latency and any schema mismatches in
  `docs/AI_API.md` under a new "Live results" section. If a mismatch appears, fix the prompt or widen the schema with a
  test, never by loosening validation of effects.

### 4. Deployment readiness (you prepare, a human with Vercel access executes)
- Write `docs/DEPLOY.md`: connect Vercel to `SuhasProjects/financegamething`, production branch `main`, framework Vite,
  build `npm run build`, output `dist`, functions in `api/`. Env vars list with which are server-only. Smoke test: open the
  site, start a story, `POST /api/ai` returns 200 or a clean 503 `{"code":"disabled"}`, offline fallback works with no key.
  Include how to read the deployed commit SHA from the Vercel dashboard and how to verify it equals `origin/main`.
- Add `GET /api/health` returning `{ ok: true, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev', aiConfigured: boolean }`
  so anyone can check which build is live. Add it to the dev middleware too and a test in `tests/engine/`.

### 5. Bundle split
- Lazy-load the reveal (`React.lazy` around `RevealChart` in whatever file Agent 5 ends with; coordinate) so Recharts is not in
  the first bundle. Target: main chunk under 300 kB gzipped. Check with `npm run build`.

### 6. Docs refresh (last)
- Rewrite `docs/NEXT_STEPS.md` to match reality after merges (it still lists the unused clock and MISSING.md).
- Update `README.md` with the game name Fortune Valley, the title-screen flow, and the three commands.

## Acceptance
- `main` green on CI after every merge; no branch merged with another agent's files deleted.
- Three new engine test files passing; live AI results recorded or the blocker named in `docs/AI_API.md`.
- `docs/DEPLOY.md` exists and `/api/health` works locally.
- Main bundle under 300 kB gzipped.
