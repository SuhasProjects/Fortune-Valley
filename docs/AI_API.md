# AI gateway — request / response examples

`POST /api/ai` · JSON · server-side only secrets. Every response is either an `AiResponse` (`kind` matches the request, `source: 'ai'`) or an `AiErrorResponse` (`{ error, code }`). The browser client (`src/services/aiClient.ts`) turns any error into the deterministic offline fallback with `source: 'fallback'`, so UI code never has to special-case failures.

Limits: body ≤ 200 KB; 40 requests per 5 minutes per client IP (429 with `code: 'rate_limited'`). Upstream timeout `AI_TIMEOUT_MS` (default 25 s → 504 `timeout`).

## Environment

| Variable | Meaning |
|---|---|
| `AI_API_KEY` | Provider key (never `VITE_`-prefixed). Missing → 503 `disabled`. |
| `AI_PROVIDER` | `anthropic` (default) or `openai_compatible`. |
| `AI_MODEL` | Anthropic default `claude-opus-5-5`; required for `openai_compatible`. |
| `AI_BASE_URL` | `openai_compatible` only, e.g. `https://router.luminal.cloud`. |
| `AI_AUTH_HEADER` | `bearer` (default) or `api-key` for `openai_compatible`. |
| `AI_ENABLED` | `false` forces 503 `disabled`. |
| `VITE_AI_OFFLINE` | `true` makes the browser skip the network entirely. |

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
`proposal` may be `null` (nothing worth proposing). Convert with `proposalToEvent(proposal, state, source)` and dispatch `enqueue_event`; the engine re-validates every effect against `BOUNDS`.

## 3. explain — results → short educational text

Request: `{ "kind": "explain", "summary": <StateSummary>, "question": "What do these results mean?", "monteCarlo": { "median": 1200, "p10": -8400, "p90": 2000, "probabilityNegativeNetWorth": 0.54, "probabilityLiquidityShortfall": 0.06, "observedNetWorth": -171, "percentileOfObserved": 0.41 } }`

Response (200): `{ "kind": "explain", "source": "ai", "text": "Across 1,000 replays of your strategy …", "warnings": [] }`

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
