# AI gateway — request / response examples

`POST /api/ai` · JSON · server-side only secrets. Every response is either an `AiResponse` (`kind` matches the request, `source: 'ai'`) or an `AiErrorResponse` (`{ error, code }`). The browser client (`src/services/aiClient.ts`) turns any error into the deterministic offline fallback with `source: 'fallback'`, so UI code never has to special-case failures.

Limits: body ≤ 200 KB; 40 requests per 5 minutes per client IP (429 with `code: 'rate_limited'`). Upstream timeout `AI_TIMEOUT_MS` (default 25 s → 504 `timeout`).

## Environment

| Variable | Meaning |
|---|---|
| `AI_API_KEY` | Provider key (never `VITE_`-prefixed). Missing → 503 `disabled`. |
| `AI_PROVIDER` | `anthropic` (default) or `openai_compatible`. |
| `AI_MODEL` | Anthropic default `claude-opus-5-5`; required for `openai_compatible`. |
| `AI_BASE_URL` | `openai_compatible` only: the provider origin, e.g. `https://flash.luminal.cloud`. The gateway appends `/v1/chat/completions`; a trailing `/` or `/v1` is tolerated. |
| `AI_AUTH_HEADER` | `bearer` (default) or `api-key` for `openai_compatible`. |
| `AI_TIMEOUT_MS` | Upstream timeout, default 25000 (→ 504 `timeout`). Keep below Vercel's 30 s `maxDuration` in `vercel.json`. |
| `AI_ENABLED` | `false` forces 503 `disabled`. |
| `VITE_AI_OFFLINE` | `true` makes the browser skip the network entirely. |

Where they come from: under `npm run dev`, `server/aiDevMiddleware.ts` reads `.env` / `.env.local` / `.env.development*` from the project root (`loadEnv`, all prefixes) and merges `process.env` on top, so `cp .env.example .env` + a key is enough; Vite itself never copies `.env` into `process.env`. On Vercel, `api/ai.ts` reads `process.env`, so set the same names as project environment variables. Nothing is ever read from `import.meta.env` on the server, and no `AI_*` value reaches the client bundle.

Current default (`.env.example`): Luminal's DeepSeek endpoint, which is an OpenAI-compatible chat-completions API → `AI_PROVIDER=openai_compatible`, `AI_BASE_URL=https://flash.luminal.cloud`, `AI_MODEL=deepseek-ai/DeepSeek-V4.1-Flash`. `tests/engine/ai-gateway.test.ts` parses `.env.example` and asserts the resulting request URL, model and `Authorization: Bearer` header, so changing the example without the code (or vice versa) fails the unit tests.

## 1. scenario — personalized prompt → ScenarioProposal

Request:
```json
{ "kind": "scenario", "input": { "freeText": "I'm 24, first job, 1,300 rent, 18k student loan at 6%", "grossAnnualIncome": 55000, "monthlyRent": 1300, "debtBalance": 18000, "debtApr": 0.06 } }
```
Response (200):
```json
{ "kind": "scenario", "source": "ai", "warnings": [],
  "proposal": { "baseArchetype": "entry_worker", "title": "First job, first loan", "description": "Mapped to the entry-level worker mechanics …",
    "overrides": { "grossAnnualSalary": 55000, "housingMonthly": 1300, "debts": [{ "name": "Student loan", "kind": "student_loan", "balance": 18000, "apr": 0.06, "minimumPayment": 200 }] },
    "narrativeFocus": ["debt_payoff", "emergency_fund"], "defaultsApplied": ["essentialsMonthly", "discretionaryMonthly", "savings", "insurance"] } }
```
Then `scenarioToConfig(proposal, seed, source)` builds a validated `GameConfig`.

## 2. opportunity — StateSummary → Type B event or null

Request: `{ "kind": "opportunity", "summary": <StateSummary from summarizeForAi(state, focus, archetype)> }`

Response (200):
```json
{ "kind": "opportunity", "source": "ai", "warnings": [],
  "proposal": { "title": "Open enrollment", "body": "…", "buildingTarget": "hospital", "learningNote": "Insurance trades a certain premium for a cap on uncertain costs.",
    "options": [ { "label": "Enroll in Basic Health", "description": "$180/mo", "effect": { "template": "change_insurance", "line": "health", "planId": "health_basic" } },
                 { "label": "Stay uninsured", "description": "", "effect": { "template": "none" } } ],
    "expiresInMonths": 2 } }
```
`proposal` may be `null` (nothing worth proposing). Proposals carry 2–3 options, exactly one of which is a decline with `effect: { template: 'none' }` (`proposalToEvent` appends one if a model forgets). The user message (`buildOpportunityUser`) leads with month, archetype, complexity, narrativeFocus and recent shocks so the director can vary offers across months and tie the lesson to the focus. Convert with `proposalToEvent(proposal, state, source)` and dispatch `enqueue_event`; the engine re-validates every effect against `BOUNDS`.

Offline fallback (`fallbackOpportunity`): 18 templates across all five buildings (return-to-work, tight month, open enrollment, competitor offer, side gig, annual review, four-day week, lease renewal, smaller place, lifestyle choice, renters flyer, health plan switch, auto coverage, savings nudge, rebalance split, start investing, laptop financing, consolidation). Urgent states (unemployed, an uncovered shock, a buffer under 1.5 months every third month) pick a matching template directly; otherwise the eligible templates rotate by month with an archetype-specific offset, focus-relevant ones first, so replays are stable and consecutive months differ. Every output passes `OpportunityProposalSchema`, `proposalToEvent` and `validateNarrativeEvent` (tests/engine/fallback-opportunity.test.ts).

## 3. explain — results → short educational text

Request: `{ "kind": "explain", "summary": <StateSummary>, "question": "What do these results mean?", "monteCarlo": { "median": 1200, "p10": -8400, "p90": 2000, "probabilityNegativeNetWorth": 0.54, "probabilityLiquidityShortfall": 0.06, "observedNetWorth": -171, "percentileOfObserved": 0.41 } }`

Response (200): `{ "kind": "explain", "source": "ai", "text": "Across 1,000 replays of your strategy …", "warnings": [] }`

Framing (system prompt): the reveal draws straight lines from the start to the unlucky (p10), typical (median) and lucky (p90) endings plus the player's actual ending; the percentile is "not a grade". The prompt requires plain English, ≤ 110 words, only the numbers provided, and this shape: (a) one sentence on what happened, (b) two or three generally-true educational levers relevant to this run, each stated as a principle with its trade-off (e.g. "a higher bond share usually narrows the spread but lowers the typical ending", "an emergency fund of 3–6 months cuts forced borrowing at the cost of idle cash", "paying the highest-rate debt first lowers interest"), (c) one sentence naming a change the what-if panel can test, then a closing note of at most 8 words ("Demo figures are illustrative, not personal advice."). Follow-up questions ("what is the best way to be less volatile") are answered directly with the principle and trade-off; the model must never open with "I can't say" / "I can't decide for you". No "you should", no guarantees. The user message (`buildExplainUser`) renders the Monte Carlo numbers as formatted dollars/percentages ahead of the raw summary JSON; without `monteCarlo` (mid-game `requestInsight`) it says so explicitly. `text` is capped at 1,200 chars by `ExplainOutputSchema`; longer output is a `schema_mismatch` and the client falls back.

Offline fallback (`fallbackExplanation(summary, monteCarlo?, question?)`): 4–7 sentences in the same shape, keyed on the question (`classifyQuestion` → savings | debt | investing | insurance | spending | advice | general): the three endings and the actual ending with its percentile plus the two probabilities, two or three lever sentences (principle + trade-off) built from the summary's cash/savings/debt/spending/policy/coverage, one what-if pointer, then the 7-word note. A topic question puts its levers first; "what should I do" lists the buffer, highest-rate-debt and steadier-mix levers with their trade-offs instead of refusing. No arithmetic beyond formatting.

## 4. whatif — one plain-cause-and-effect line under the what-if tiles

Module: `api/_lib/kinds/whatif.ts` (self-contained: `requestSchema`, `responseSchema`, `system`, `user(req)`, `maxTokens`). Registered by one line each in `schemas.ts` (union member) and `handler.ts` (dispatch via `kinds/index.ts` `runKind`).

Request: the `WhatIfResult` the ending computed, trimmed to what the sentence needs.
```json
{ "kind": "whatif", "comparison": { "decisionLabel": "Save $300/month", "alternativeLabel": "Keep what you had before",
  "original": { "p10": -15000, "median": -13000, "p90": -10000, "yourEvents": -12000 }, "changed": { "p10": -16200, "median": -12400, "p90": -8300, "yourEvents": -11700 },
  "delta": { "p10": -1200, "median": 600, "p90": 1700, "yourEvents": 300, "spread": 2900 }, "startNetWorth": -14000, "months": 24 } }
```
Response (200): `{ "kind": "whatif", "source": "ai", "text": "Keeping the cash each month makes the typical ending a bit better but risks a bigger drop.", "warnings": [] }`

Prompt: ELI5 cause → effect about the ALTERNATIVE (the user message states every delta is "alternative minus actual"; the first draft without that line described the player's own choice and got the direction backwards). One sentence, ≤ 18 words, everyday words, no numbers unless essential, no "X. Y." fragments, no advice. `responseSchema` caps at 160 chars, 20 words and exactly one sentence; anything else is `schema_mismatch` (after the provider's one corrective retry) and the client falls back. `maxTokens` is 1500 because DeepSeek spends most of the budget on hidden reasoning (with 300 the visible content came back empty).

UI (`src/game/reveal/useWhatIfLine.tsx` → `ChangeStrip` `line` prop): the sign-based `changeSentence` shows instantly as `data-source="fallback"`, the request is debounced 400 ms, cached per `(decision, alternative)` for the life of the screen, and a selection change aborts the in-flight fetch (the hook passes a `fetchImpl` that injects its own `AbortSignal`, so `aiClient` is unchanged).

Offline fallback (`fallbackWhatIf`): nine sign-combination sentences (typical up/down/flat × spread narrower/wider/same), each ≤ 18 words with no digits, e.g. "This choice puts a little more aside each month, so the ending grows and bad months hurt less."

## 5. recap — three news-wire sentences at the top of the reveal

Module: `api/_lib/kinds/recap.ts`. Input is `summarizeTimeline(state)` (`src/services/summarizeTimeline.ts`): ≤ 25 lines `{ month, label: "YYYY-MM", event, amount? }` built from `policyLog` (every action described in past tense, `apply_event_option` as `Chose "<label>"`), `realizedShocks` (kind, gross cost, insurer paid, out of pocket; job loss as "Job loss cut the paycheck to unemployment benefits") and the notable engine notifications (`Back to work`, `Paid off`, `Cash ran short`, `Emergency fund`, `Annual raise`). Priority when trimming: shocks, then decisions, then notifications; sorted by month.

Request:
```json
{ "kind": "recap", "recap": { "months": 24, "startNetWorth": -23300, "endNetWorth": -17567, "timeline": [
  { "month": 4, "label": "2026-05", "event": "Job loss cut the paycheck to unemployment benefits" },
  { "month": 6, "label": "2026-07", "event": "Set savings to $300 and investing to $200 a month" },
  { "month": 10, "label": "2026-11", "event": "Medical bill of $11,404, insurer paid $5,183, out of pocket $6,221", "amount": 6221 } ] } }
```
Response (200): `{ "kind": "recap", "source": "ai", "text": "In July 2026 the player set savings at $300 monthly, investing at $200, and took a $52,000 role. A May 2026 job loss cut pay to unemployment benefits, and a November medical bill cost $6,221 out of pocket. A second job loss in June 2027 led to $2,423 drawn from savings, and net worth ended at -$17,567 versus -$23,300.", "warnings": [] }`

Prompt: plain news-wire reporting (the system prompt quotes a wire excerpt as the register): concrete, past tense, short declarative sentences, specific months and amounts, no piled adjectives, no moralising, banned words `journey / resilient / navigate / rollercoaster / testament`, no exclamation marks, no fragments. Exactly three sentences, ≤ 60 words, each under 22 words. `responseSchema`: ≤ 480 chars, ≤ 70 words, 2–4 sentences, no `!`. `maxTokens` 2000 (reasoning budget).

UI (`src/game/reveal/RecapLine.tsx`, under the headline): the template recap shows at once with a "Recap" tag; when the gateway answers with `source:'ai'` the text and tag ("AI recap") swap in. Unmount aborts the fetch.

Offline fallback (`fallbackRecap`): the same three beats from the same timeline: opening net worth and the first decision ("The run opened at -$23,300, and in July 2026 the player set the investment mix."), up to two named shocks plus a count of the rest ("A job loss in May 2026 cut pay to benefits, and a medical bill in November 2026 cost $6,221 out of pocket; 3 more hard months followed."), then the ending versus the start. ≤ 60 words, no exclamation marks (tests/engine/fallback-whatif-recap.test.ts).

Adding another kind: copy `api/_lib/kinds/whatif.ts`, then one line each in `schemas.ts`, `handler.ts`, `src/types/domain.ts` (request and response union members), `aiClient.ts` (one function) and `aiFallback.ts` (one function). `kinds/index.ts` `runKind` turns a refusal into `upstream_error` and an invalid output into `schema_mismatch`.

## Smoke test with a real key (about 2 minutes)

The whole path is unit-tested with a mocked upstream (`tests/engine/ai-gateway.test.ts`: success, fenced/invalid JSON, 401/403/429/500/503, timeout, rate limit, `.env` loading, dev-middleware = Vercel parity), but only a live call proves the key, endpoint and model name. Steps for someone holding the key:

1. `cp .env.example .env` and paste the key after `AI_API_KEY=`. `.env` is git-ignored; never commit it or paste the key anywhere else.
2. Terminal 1: `npm run dev -- --host 127.0.0.1 --port 5195`
3. Terminal 2, scenario:
   ```sh
   curl -s http://127.0.0.1:5195/api/ai -H 'content-type: application/json' -d '{"kind":"scenario","input":{"freeText":"I am 24, first job, 1,300 rent, 18k student loan at 6%","grossAnnualIncome":55000,"monthlyRent":1300,"debtBalance":18000,"debtApr":0.06}}'
   ```
   Expect HTTP 200 and `{"kind":"scenario","source":"ai","proposal":{"baseArchetype":"entry_worker",…},"warnings":[]}`.
4. Opportunity and explain share one `StateSummary` (this one is `summarizeForAi(fixtureState, …)`, month 6, just lost a job):
   ```sh
   cat > /tmp/fv-summary.json <<'EOF'
   {"monthIndex":6,"monthLabel":"2026-07","archetype":"entry_worker","netWorth":-19452.1,"cash":1999.55,"savings":3046.99,"investmentsTotal":852.53,"debtTotal":25351.17,"grossAnnualSalary":58000,"employmentStatus":"unemployed","housingKind":"rent","housingMonthly":1350,"essentialsMonthly":900,"discretionaryMonthly":450,"insurance":{"health":"health_basic","auto":"auto_liability","renters":null},"policy":{"savingsContributionPerMonth":300,"investmentContributionPerMonth":200,"targetAllocation":{"stock":0.1,"bond":0.3,"etf":0.6},"extraDebtPaymentPerMonth":0},"recentShocks":["job_loss"],"monthsOfEssentialsCovered":2.2,"narrativeFocus":["taxes","insurance","investing_basics","debt_payoff"],"complexityLevel":2}
   EOF
   curl -s http://127.0.0.1:5195/api/ai -H 'content-type: application/json' -d "{\"kind\":\"opportunity\",\"summary\":$(cat /tmp/fv-summary.json)}"
   curl -s http://127.0.0.1:5195/api/ai -H 'content-type: application/json' -d "{\"kind\":\"explain\",\"summary\":$(cat /tmp/fv-summary.json),\"question\":\"What do these results mean?\",\"monteCarlo\":{\"median\":1200,\"p10\":-8400,\"p90\":2000,\"probabilityNegativeNetWorth\":0.54,\"probabilityLiquidityShortfall\":0.06,\"observedNetWorth\":-171,\"percentileOfObserved\":0.41}}"
   ```
   Expect `{"kind":"opportunity","source":"ai","proposal":{…2–3 options, one with "template":"none"}}` (or `"proposal":null`) and `{"kind":"explain","source":"ai","text":"…"}` of at most ~110 words: what happened, 2–3 general levers with trade-offs, a what-if pointer, a short note.
   whatif and recap take the comparison / condensed timeline shown in sections 4 and 5:
   ```sh
   curl -s http://127.0.0.1:5195/api/ai -H 'content-type: application/json' -d '{"kind":"whatif","comparison":{"decisionLabel":"Save $300/month","alternativeLabel":"Keep what you had before","original":{"p10":-15000,"median":-13000,"p90":-10000,"yourEvents":-12000},"changed":{"p10":-16200,"median":-12400,"p90":-8300,"yourEvents":-11700},"delta":{"p10":-1200,"median":600,"p90":1700,"yourEvents":300,"spread":2900},"startNetWorth":-14000,"months":24}}'
   curl -s http://127.0.0.1:5195/api/ai -H 'content-type: application/json' -d '{"kind":"recap","recap":{"months":24,"startNetWorth":-23300,"endNetWorth":-17567,"timeline":[{"month":4,"label":"2026-05","event":"Job loss cut the paycheck to unemployment benefits"},{"month":6,"label":"2026-07","event":"Set savings to $300 and investing to $200 a month"},{"month":10,"label":"2026-11","event":"Medical bill of $11,404, insurer paid $5,183, out of pocket $6,221","amount":6221}]}}'
   ```
   Expect one sentence ≤ 18 words about the alternative, and three past-tense sentences ≤ 60 words.
5. Negative checks (each should take under a second): empty `AI_API_KEY` → 503 `{"code":"disabled"}`; a wrong key → 502 `{"error":"AI credentials rejected","code":"upstream_error"}`; `curl -X GET` → 405. Any of these in the browser becomes `source:'fallback'` and `aiStatus:'offline'` in the store.
6. In the app (same dev server): write a custom story on the title screen, then play to the ending; `useGameStore` sets `aiStatus: 'online'` only when the gateway answered with `source:'ai'`.

| Date | Kind | HTTP | source | Notes |
|---|---|---|---|---|
| 2026-10-24 | whatif / recap | 200 | ai | Luminal DeepSeek-V4.1-Flash via `npx vite --port 5241`. whatif: "Keeping the cash each month makes the typical ending a bit better but risks a bigger drop." / "Dropping coverage saves each month, so the typical ending rises, but one bad bill can wipe that out." recap: see section 5. First prompt draft inverted the direction (described the player's choice, not the alternative); fixed by labelling deltas "alternative minus actual". `maxTokens` 300 returned empty content (reasoning ate the budget) → 1500 / 2000. |
| 2026-10-24 | scenario / opportunity / explain | — | — | Not run: no key in the integration environment. Endpoint reachability checked without a key: `POST https://flash.luminal.cloud/v1/chat/completions` → 401 (path exists). Fill this row in after the steps above. |

## Error codes

| HTTP | code | Meaning |
|---|---|---|
| 400 | `invalid_request` | Body not JSON or fails the Zod request schema |
| 413 | `invalid_request` | Body over 200 KB |
| 429 | `rate_limited` | Client or upstream rate limit |
| 502 | `upstream_error` | Provider error, credentials rejected, or model refusal |
| 502 | `schema_mismatch` | Model output failed Zod verification (after one corrective retry on `openai_compatible`) |
| 503 | `disabled` | No key / `AI_ENABLED=false` / missing provider config |
| 504 | `timeout` | Upstream timeout |

## Guardrails

Prompts (`api/_lib/prompts.ts`) forbid guarantees, invented probabilities, tax/legal advice, PII requests and commentary on the player's motives. Free text is used for one request and never stored. Effects are a closed whitelist (`offer_job, change_housing, change_insurance, budget_choice, loan_choice, contribution_choice, none`) with bounds enforced twice: Zod on the server, `validateEffect` in the engine.
