/**
 * Monte Carlo: "same strategy, alternate luck". Owner: Agent 1.
 *
 * Each path restarts from the ORIGINAL config (not the final balances), with an
 * independently derived seed, and replays the player's logged decisions at the same
 * monthIndex they were made. The observed marker is the actual engine state's net
 * worth — never inserted artificially. See docs/ARCHITECTURE.md §Monte Carlo.
 *
 * Replay fallbacks (documented):
 *  - apply_event_option / dismiss_event / enqueue_event: path-specific events don't exist in
 *    other paths, so the option's `resolvedEffect` is applied directly as a policy change.
 *    Entries with no resolvedEffect are skipped (they had no financial effect).
 *  - make_extra_payment / transfer rejected for insufficient funds: skipped, counted in
 *    `replayFallbacks`. The persistent policy (contributions etc.) continues as-is.
 */
import type { GameConfig, GameState, MonteCarloComparison, MonteCarloResult, MonteCarloSummary, PolicyLogEntry } from '@/types/domain';
import { DEFAULT_MONTE_CARLO_PATHS } from '@/config/defaults';
import { netWorthOf } from './accounting';
import { applyAction } from './actions';
import { advanceMonth } from './advanceMonth';
import { createGame } from './createGame';
import { applyEffect } from './events';
import { pathSeed } from './rng';

export interface MonteCarloOptions {
  paths?: number;
  /** Base seed for path derivation; defaults to config.seed. */
  seed?: number;
  /** Horizon override; defaults to observed months played (or config duration if none). */
  months?: number;
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * (pos - lo);
}

interface PathOutcome { ending: number; shortfall: boolean; history: number[]; fallbacks: number }

function replayPath(config: GameConfig, policyLog: PolicyLogEntry[], seed: number, months: number): PathOutcome {
  let s: GameState = createGame({ ...config, seed });
  s.durationMonths = Math.max(months, 1);
  let fallbacks = 0;
  const byMonth = new Map<number, PolicyLogEntry[]>();
  for (const e of policyLog) {
    const arr = byMonth.get(e.monthIndex) ?? [];
    arr.push(e);
    byMonth.set(e.monthIndex, arr);
  }
  for (let m = 0; m < months; m++) {
    for (const entry of byMonth.get(m) ?? []) {
      const a = entry.action;
      if (a.type === 'apply_event_option' || a.type === 'dismiss_event' || a.type === 'enqueue_event') {
        if (entry.resolvedEffect) {
          const err = applyEffect(s, entry.resolvedEffect, true);
          if (err) fallbacks += 1;
        }
        continue;
      }
      if (a.type === 'advance_month' || a.type === 'pause' || a.type === 'resume' || a.type === 'finish' || a.type === 'mark_notifications_read') continue;
      const r = applyAction(s, a);
      if (r.ok) s = r.state;
      else fallbacks += 1;
    }
    s = advanceMonth(s, { lean: true, inPlace: true });
  }
  return { ending: netWorthOf(s), shortfall: s.shortfallMonths.length > 0, history: s.netWorthHistory, fallbacks };
}

function summarize(outcomes: PathOutcome[], months: number): MonteCarloSummary {
  const endings = outcomes.map((o) => o.ending).sort((a, b) => a - b);
  const n = endings.length;
  const bands: MonteCarloSummary['bands'] = [];
  for (let m = 0; m <= months; m++) {
    const col = outcomes.map((o) => o.history[m] ?? o.ending).sort((a, b) => a - b);
    bands.push({ monthIndex: m, p10: quantile(col, 0.1), median: quantile(col, 0.5), p90: quantile(col, 0.9) });
  }
  return {
    endingNetWorths: endings,
    median: quantile(endings, 0.5),
    p10: quantile(endings, 0.1),
    p90: quantile(endings, 0.9),
    mean: n ? endings.reduce((a, b) => a + b, 0) / n : NaN,
    probabilityNegativeNetWorth: n ? endings.filter((x) => x < 0).length / n : NaN,
    probabilityLiquidityShortfall: n ? outcomes.filter((o) => o.shortfall).length / n : NaN,
    bands,
  };
}

function runPaths(config: GameConfig, policyLog: PolicyLogEntry[], baseSeed: number, paths: number, months: number): PathOutcome[] {
  const out: PathOutcome[] = [];
  for (let i = 0; i < paths; i++) out.push(replayPath(config, policyLog, pathSeed(baseSeed, i), months));
  return out;
}

export function assumptionsSummary(config: GameConfig): string[] {
  const a = config.assumptions;
  return [
    a.disclaimer,
    ...(['stock', 'bond', 'etf'] as const).map((c) => `${a.assets[c].label}: ${(a.assets[c].expectedAnnualReturn * 100).toFixed(1)}%/yr expected, ${(a.assets[c].annualVolatility * 100).toFixed(0)}% volatility (lognormal monthly)`),
    `Savings APY ${(a.savingsApy * 100).toFixed(1)}%`,
    `Shocks per month: ${a.shocks.map((s) => `${s.label} ${(s.monthlyIncidence * 100).toFixed(1)}%`).join(', ')}; job loss ${(a.employment.jobLossMonthlyIncidence * 100).toFixed(1)}%`,
    `Insurance changes what you pay after a shock, never whether it happens`,
    a.tax.note,
  ];
}

/**
 * runMonteCarlo(config, policyLog, observedState, options)
 * Horizon = months the player actually played (so the observed marker is comparable);
 * pass options.months to override — then observedHorizonMatches is false and no percentile is given.
 */
export function runMonteCarlo(config: GameConfig, policyLog: PolicyLogEntry[], observedState: GameState, options: MonteCarloOptions = {}): MonteCarloResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const paths = Math.max(1, Math.floor(options.paths ?? DEFAULT_MONTE_CARLO_PATHS));
  const seed = options.seed ?? config.seed;
  const playedMonths = observedState.monthIndex;
  const months = options.months ?? (playedMonths > 0 ? playedMonths : config.durationMonths);
  const outcomes = runPaths(config, policyLog, seed, paths, months);
  const summary = summarize(outcomes, months);
  const observedNetWorth = netWorthOf(observedState);
  const observedHorizonMatches = months === playedMonths && playedMonths > 0;
  const below = summary.endingNetWorths.filter((x) => x < observedNetWorth).length;
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    ...summary,
    seed,
    pathsRequested: paths,
    pathsCompleted: outcomes.length,
    months,
    observedNetWorth,
    percentileOfObserved: observedHorizonMatches ? below / outcomes.length : undefined,
    observedHorizonMatches,
    replayFallbacks: outcomes.reduce((a, o) => a + o.fallbacks, 0),
    assumptionsSummary: assumptionsSummary(config),
    elapsedMs: Math.round(t1 - t0),
  };
}

/** Paired comparison: same path seeds (same exogenous luck), two different policy logs. */
export function compareStrategies(
  config: GameConfig,
  logA: PolicyLogEntry[],
  logB: PolicyLogEntry[],
  labels: { a: string; b: string },
  options: MonteCarloOptions & { months: number },
): MonteCarloComparison {
  const paths = Math.max(1, Math.floor(options.paths ?? DEFAULT_MONTE_CARLO_PATHS));
  const seed = options.seed ?? config.seed;
  const oa = runPaths(config, logA, seed, paths, options.months);
  const ob = runPaths(config, logB, seed, paths, options.months);
  const diffs = oa.map((o, i) => o.ending - (ob[i]?.ending ?? 0)).sort((x, y) => x - y);
  return {
    labelA: labels.a,
    labelB: labels.b,
    a: summarize(oa, options.months),
    b: summarize(ob, options.months),
    pairedMedianDifference: quantile(diffs, 0.5),
    probabilityAOutperformsB: diffs.filter((d) => d > 0).length / diffs.length,
  };
}
