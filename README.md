# Financial Town

Browser-based pixel-art town that teaches personal finance through interconnected monthly choices. Fictional educational simulation; all assumptions are illustrative.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173  (add ?dev=engine for the plain-text engine harness)
npm run typecheck
npm test
npm run build
```

Requires Node 20+ (`.nvmrc` pins 22). CI (`.github/workflows/ci.yml`) runs typecheck, unit tests, build and the Chromium browser smoke on every PR.

## AI gateway

Copy `.env.example` → `.env` and set `AI_API_KEY` (server-side only; never `VITE_`). `npm run dev` serves `POST /api/ai` through a Vite middleware; on Vercel the same handler runs as `api/ai.ts`. Without a key the app uses clearly labeled offline fallbacks. `AI_MODEL` defaults to `claude-opus-5-5`; `AI_ENABLED=false` forces fallback; `VITE_AI_OFFLINE=true` skips the network entirely in the browser.

Any OpenAI-compatible endpoint works too: set `AI_PROVIDER=openai_compatible`, `AI_BASE_URL` (e.g. `https://router.luminal.cloud`), `AI_MODEL` (an id from `GET /v1/models`) and `AI_API_KEY`; `AI_AUTH_HEADER=api-key` switches from a bearer token to an `Api-Key` header. Output is still Zod-verified and the engine re-validates every effect.

## What's in the build

- Four starting lives + personalized scenario (AI gateway or labeled offline mapping).
- Deterministic monthly engine (documented accounting order), Type A shocks with insurance claim math, Type B opportunities (AI director or rule-based fallback) with whitelisted, engine-validated effects.
- Five store-driven building panels, notifications, timeline, activity history.
- One-slot save/resume (schema-versioned, validated on load; Continue button on the landing page).
- Reveal: 1,000-path "same strategy, alternate luck" Monte Carlo with fan chart, histogram, observed marker, paired "same luck, no changes" comparison, assumptions, and an AI/offline explanation.
- Dev harness at `?dev=engine`.

## Layout

See `docs/INTEGRATION.md` (import map, signatures, who-owns-what) and `docs/ARCHITECTURE.md` (accounting order, randomness, Monte Carlo, AI guardrails).

```
src/types/domain.ts        authoritative types (Agent 1)
src/config/*               assumptions, archetypes (Agent 1)
src/engine/*               deterministic engine + Monte Carlo (Agent 1)
src/services/*             AI client + offline fallbacks (Agent 1)
api/, server/              AI gateway (Agent 1)
src/stores/, src/data/, src/components/flow/   store, scenarios, notifications/timeline (Agent 4)
src/components/town/, layout/   town scene (Agent 2)
src/components/panels/     building panels (Agent 3)
src/components/reveal/     Monte Carlo reveal (Agent 5)
tests/engine/              engine invariants
```

Branches: `agent1-core`, `agent2-town`, `agent3-panels`, `agent4-flow`, `agent5-reveal`; small PRs into `main`.
