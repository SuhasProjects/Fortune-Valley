# Financial Town — architecture & modeling notes (Agent 1)

Static React town; all finance in `src/engine` (pure, deterministic, typed). Store (Zustand) orchestrates; UI renders. AI goes through `/api/ai` only.

## Monthly accounting order (fixed, tested)

1. **Income** — gross = annual salary / 12; illustrative withholding (standard deduction + progressive brackets + flat payroll rate; filing `married_joint` doubles deduction and bracket bounds). Unemployed: benefit = min(cap, replacement × prior monthly gross); re-employment at prior salary when the spell ends. Annual raise every 12 months while employed.
2. **Bills** — housing, essentials, discretionary, then premiums for each active plan.
3. **Debt** — for each debt (highest APR first): interest = balance × APR/12 accrues to the balance **first**, then payment = min(balance, minimum + remaining extra). Extra payment goes to the highest-APR debt first. Student loans with minimum 0 accrue (deferred).
   → **Funding order** if cash < 0 after steps 1–3: `policy.emergencyFundingOrder` (default savings → investments pro-rata → borrow). Borrowing creates/increases a single `overdraft` debt at `assumptions.overdraftApr` with a 3%/\$25 minimum. Money is never invented; a month that needed borrowing is recorded in `shortfallMonths` (the liquidity-shortfall metric).
4. **Contributions** — savings, then investments split by `targetAllocation`, each limited to cash above `minCashBuffer`. Trimmed contributions produce an `info` notification.
5. **Returns** — savings interest at monthly-compounded APY. Asset returns are **lognormal** monthly: `r = exp(μ + σz) − 1`, `σ = annualVol/√12`, `μ = ln(1+expected)/12 − σ²/2`, so returns are bounded above −100%. Correlated normals: ETF and bond shocks are built from the stock shock with `correlation.stockEtf` / `correlation.stockBond`. The ETF is modeled as a diversified equity basket (lower vol than the single-stock basket), not a separate asset class.
6. **Shocks (Type A)** — for each shock kind in fixed order, draw incidence `u` and severity `z` from the **shocks stream** regardless of insurance; a shock occurs iff `u < monthlyIncidence`. Cost is lognormal, clamped to `[costMin, costMax]`. Claims: insured pays deductible, then coinsurance share, capped at `outOfPocketMax`; insurer pays the rest up to `coverageCap`. Out-of-pocket is funded via the funding order. Job-loss is drawn on the **employment stream**.
7. **Alerts** — expire events, push notifications/timeline, record `netWorthHistory[monthIndex+1]`, increment month, finish at the horizon.

Balances and ledger postings are rounded to cents. Purchases and pro-rata liquidations use whole-cent largest-remainder allocation, normalized across accepted weights; ties follow stock/bond/ETF order. This conserves the exact cash amount even for one-cent transfers and allocation sums within tolerance. Configurations, assumptions, incoming events and logged actions are copied to isolate engine state from later caller edits.

Invariant: `netWorth = cash + savings + stock + bond + etf − Σ debts`; ledger entries per account reconcile to balance deltas (tested).

## Randomness

`mulberry32` seeded by `hash(seed, monthIndex, stream)` for streams `market | shocks | employment`. Same seed ⇒ identical run. Changing insurance, allocation or budget can never change which shocks occur or market returns — only money flows. Behavior can change risk only via explicitly modeled exposure (none in MVP).

## Actions & events

`applyAction` clones, validates, applies, logs to `policyLog` + `timeline`, or rejects with the original state. Type B effects are a closed whitelist with bounds in `src/config/defaults.ts#BOUNDS`; AI output is parsed with Zod on the server **and** re-validated in the engine. No LLM output is executed. Enqueued events must be Type B from AI/fallback, target a valid building, carry unique option ids and valid bounded effects, and not already be expired. Creation month is descriptive metadata (fixtures may be reused); expiry is enforced against the active month. Keeping the current policy is logged as a structured `none` effect rather than disappearing from history.

## Monte Carlo ("same strategy, alternate luck")

For `i in 0..N−1`: `createGame({...config, seed: hash(baseSeed,'mc-path',i)})`, replay `policyLog` entries at their original `monthIndex`, then `advanceMonth` — for `months` = months actually played (so the observed marker is on the same horizon). Event-option decisions are replayed as their `resolvedEffect` (the event itself was path-specific). Actions rejected for insufficient funds are skipped and counted in `replayFallbacks`. Metrics: sorted ending net worths, median/p10/p90/mean, P(net worth < 0), P(any overdraft borrowing), per-month bands. `observedNetWorth` is computed from the real final state. Path counts must be integers from 1 to 10,000; horizons must be integers from 1 to 240 months; seeds must be safe integers. Invalid values are rejected before loops begin. In this environment the 1,000-path, 60-month regression takes about one second. `compareStrategies` pairs path seeds so two policy logs face identical luck.

This is a retrospective replay from the initial state, not a forward forecast from today's balances.

## AI gateway (server only)

`api/ai.ts` (Vercel) and `server/aiDevMiddleware.ts` (Vite dev) wrap `api/_lib/handler.ts`: Zod-validate request → if `AI_ENABLED !== 'false'` and `AI_API_KEY` present, call Anthropic Messages API (`AI_MODEL`, default `claude-opus-5-5`) with structured output → Zod-validate the model's JSON → return `source:'ai'`; any failure (timeout, 4xx/5xx, refusal, schema mismatch) returns a typed error response, which the browser converts to a deterministic fallback with `source:'fallback'` and a warning. Three prompts: scenario mapper, Type B director, outcome explainer. Prompts forbid guarantees, invented probabilities, tax/legal advice and PII requests. Free text is never stored server-side. Gateway failures return stable error messages; provider response bodies and arbitrary exception messages are not sent to the browser.

## Visual theme

Pixel-art, Stardew-like. Tokens in `src/styles/pixel-tokens.css`; Agent 4's prototype sheet in `src/styles/town.css`. Charts use the `--ft-series-*` tokens with square caps, stepped lines where sensible and no anti-aliased gradients.

## Configuration validation

`createGame` rejects malformed loaded configurations and invalid dates, rates, correlations, severity intervals, tax brackets, coverage parameters, employment durations and funding sources. Active insurance ids must match the persistent policy. Accepted defaults remain illustrative, not calibrated financial forecasts. Validation bounds guard numerical accounting; they do not imply that an accepted scenario is affordable or advisable.
