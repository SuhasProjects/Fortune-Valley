/**
 * The ending: straight-line outcome summaries and "what if I had chosen differently?" re-runs.
 *
 * - outcomeLines: endpoints for the ending chart, read from an existing MonteCarloResult.
 * - listDecisions: the player's logged decisions in plain English, each with replayable alternatives.
 * - runWhatIf: re-runs the finish Monte Carlo with ONE decision changed, on the same path seeds (same
 *   luck), and replays the player's own game seed for the "your exact events" line.
 *
 * Owner: Agent 1. The UI does no arithmetic on these results; every delta is computed here.
 */
import type {
  Allocation, DecisionAlternative, DecisionChoice, EventEffect, GameAction, GameConfig, GameState, MonteCarloResult,
  OutcomeLines, PolicyLogEntry, WhatIfInput, WhatIfResult,
} from '@/types/domain';
import { BOUNDS } from '@/config/defaults';
import { round2 } from './accounting';
import { advanceMonth } from './advanceMonth';
import { createGame } from './createGame';
import { describeEffect, hasCar } from './events';
import { describeCar, carRunningCost } from './car';
import { CAR_VALUE_BANDS, type CarValueBand } from '@/types/domain';
import { hasPolicyDecisions, replayEntry, replayPath, runPaths, summarize } from './monteCarlo';

export function outcomeLines(mc: MonteCarloResult, startNetWorth: number): OutcomeLines {
  return {
    months: mc.months,
    start: round2(startNetWorth),
    p10: round2(mc.p10),
    median: round2(mc.median),
    p90: round2(mc.p90),
    yourEvents: round2(mc.observedNetWorth),
    spread: round2(mc.p90 - mc.p10),
  };
}

// ── Labels ──────────────────────────────────────────────────────────────────

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${Math.round(n * 100)}%`;

function describeAllocation(a: Allocation): string {
  const parts = ([['etf', 'ETF'], ['bond', 'bonds'], ['stock', 'stocks']] as const)
    .filter(([k]) => a[k] > 0)
    .map(([k, name]) => `${pct(a[k])} ${name}`);
  return parts.join(' · ') || 'nothing';
}

function planName(config: GameConfig, planId: string | null): string {
  if (planId === null) return 'no coverage';
  return config.assumptions.insurancePlans.find((p) => p.id === planId)?.name ?? planId;
}

function debtName(s: GameState, debtId: string): string {
  return s.debts.find((d) => d.id === debtId)?.name ?? 'a debt';
}

/** Plain-English description of an action, given the state just before it. */
function describeAction(config: GameConfig, before: GameState, a: GameAction): string {
  switch (a.type) {
    case 'set_contributions': {
      const savings = a.savingsContributionPerMonth !== before.policy.savingsContributionPerMonth;
      const invest = a.investmentContributionPerMonth !== before.policy.investmentContributionPerMonth;
      if (savings && !invest) return `Save ${usd(a.savingsContributionPerMonth)}/month`;
      if (invest && !savings) return `Invest ${usd(a.investmentContributionPerMonth)}/month`;
      return `Save ${usd(a.savingsContributionPerMonth)}/month, invest ${usd(a.investmentContributionPerMonth)}/month`;
    }
    case 'set_budget': return `Spend ${usd(a.discretionaryMonthly)}/month on lifestyle`;
    case 'set_allocation': return `Invest as ${describeAllocation(a.allocation)}`;
    case 'set_insurance': return a.planId === null ? `Drop ${a.line} coverage` : `Switch ${a.line} plan to ${planName(config, a.planId)}`;
    case 'set_housing': return `Change housing to ${usd(a.housingMonthly)}/month`;
    case 'set_car': return a.owned ? `Own a ${describeCar({ owned: true, valueBand: a.valueBand }).toLowerCase()}, ${usd(carRunningCost(a.valueBand))}/month to run` : 'Go without a car';
    case 'set_extra_debt_payment': return `Pay ${usd(a.amount)}/month extra on debt`;
    case 'set_min_cash_buffer': return `Keep a ${usd(a.amount)} cash buffer`;
    case 'make_extra_payment': return `Pay ${usd(a.amount)} extra on ${debtName(before, a.debtId)}`;
    case 'transfer': return `Move ${usd(a.amount)} from ${a.from} to ${a.to}`;
    default: return a.type.replaceAll('_', ' ');
  }
}

// ── Decisions and alternatives ──────────────────────────────────────────────

/** Replay the log on the game's own seed until just before entry `index` (same month, earlier entries applied). */
function stateBeforeEntry(config: GameConfig, policyLog: PolicyLogEntry[], index: number): GameState {
  const target = policyLog[index]!;
  let s = createGame(config);
  s.durationMonths = Math.max(config.durationMonths, target.monthIndex + 1);
  let i = 0;
  for (let m = 0; m <= target.monthIndex; m++) {
    // Entries are logged in month order; apply this month's earlier entries, then advance.
    for (; i < index && policyLog[i]!.monthIndex <= m; i++) {
      if (policyLog[i]!.monthIndex === m) s = replayEntry(s, policyLog[i]!).state;
    }
    if (m < target.monthIndex) s = advanceMonth(s, { lean: true, inPlace: true });
  }
  return s;
}

/** A replacement for one log entry: `entry: null` removes it. */
interface Replacement { id: string; label: string; entry: PolicyLogEntry | null }

const clampMoney = (n: number, max: number) => round2(Math.min(Math.max(n, 0), max));

function scaled(entry: PolicyLogEntry, action: GameAction): PolicyLogEntry {
  return { ...entry, action };
}

function replacementsFor(config: GameConfig, before: GameState, entry: PolicyLogEntry): Replacement[] {
  const a = entry.action;
  const out: Replacement[] = [];
  const undo = (label: string) => out.push({ id: 'undo', label, entry: null });
  switch (a.type) {
    case 'set_contributions': {
      const p = before.policy;
      undo(`Keep saving ${usd(p.savingsContributionPerMonth)}/month and investing ${usd(p.investmentContributionPerMonth)}/month`);
      const savingsChanged = a.savingsContributionPerMonth !== p.savingsContributionPerMonth;
      const investChanged = a.investmentContributionPerMonth !== p.investmentContributionPerMonth;
      for (const [id, k] of [['half', 0.5], ['double', 2]] as const) {
        const next = {
          ...a,
          savingsContributionPerMonth: savingsChanged || !investChanged ? clampMoney(a.savingsContributionPerMonth * k, BOUNDS.contributionMax) : a.savingsContributionPerMonth,
          investmentContributionPerMonth: investChanged ? clampMoney(a.investmentContributionPerMonth * k, BOUNDS.contributionMax) : a.investmentContributionPerMonth,
        };
        if (next.savingsContributionPerMonth !== a.savingsContributionPerMonth || next.investmentContributionPerMonth !== a.investmentContributionPerMonth) {
          out.push({ id, label: describeAction(config, before, next), entry: scaled(entry, next) });
        }
      }
      break;
    }
    case 'set_car': {
      undo(before.car.owned ? `Keep the ${describeCar(before.car).toLowerCase()}` : 'Keep going without a car');
      const financed = before.debts.some((d) => d.kind === 'auto_loan' && d.balance > 0);
      for (const band of CAR_VALUE_BANDS) {
        const next = band === 'none' ? { ...a, owned: false, valueBand: band } : { ...a, owned: true, valueBand: band };
        if (next.owned === a.owned && next.valueBand === a.valueBand) continue;
        if (!next.owned && financed) continue;
        out.push({ id: `car:${band}`, label: describeAction(config, before, next), entry: scaled(entry, next) });
      }
      break;
    }
    case 'set_budget': {
      undo(`Keep spending ${usd(before.household.discretionaryMonthly)}/month on lifestyle`);
      for (const [id, k] of [['half', 0.5], ['double', 2]] as const) {
        const v = clampMoney(a.discretionaryMonthly * k, BOUNDS.monthlySpendMax);
        if (v !== a.discretionaryMonthly) out.push({ id, label: `Spend ${usd(v)}/month on lifestyle`, entry: scaled(entry, { ...a, discretionaryMonthly: v }) });
      }
      break;
    }
    case 'set_allocation': {
      undo(`Keep investing as ${describeAllocation(before.policy.targetAllocation)}`);
      const presets: [string, string, Allocation][] = [
        ['all-etf', 'Put everything in the diversified ETF', { stock: 0, bond: 0, etf: 1 }],
        ['all-bonds', 'Put everything in bonds', { stock: 0, bond: 1, etf: 0 }],
        ['60-40', 'Use a 60% ETF / 40% bonds mix', { stock: 0, bond: 0.4, etf: 0.6 }],
      ];
      for (const [id, label, allocation] of presets) {
        if ((['stock', 'bond', 'etf'] as const).every((k) => Math.abs(allocation[k] - a.allocation[k]) < 1e-9)) continue;
        out.push({ id, label, entry: scaled(entry, { ...a, allocation }) });
      }
      break;
    }
    case 'set_insurance': {
      undo(`Keep ${planName(config, before.insurance[a.line] ?? null)}`);
      const plans = config.assumptions.insurancePlans.filter((p) => p.line === a.line && p.id !== a.planId && p.id !== (before.insurance[a.line] ?? null));
      for (const plan of plans) out.push({ id: `plan:${plan.id}`, label: `Choose ${plan.name}`, entry: scaled(entry, { ...a, planId: plan.id }) });
      break;
    }
    case 'make_extra_payment': {
      undo("Don't make this payment");
      out.push({ id: 'double', label: `Pay ${usd(a.amount * 2)} instead`, entry: scaled(entry, { ...a, amount: round2(a.amount * 2) }) });
      break;
    }
    case 'set_extra_debt_payment':
    case 'set_min_cash_buffer': {
      undo(a.type === 'set_extra_debt_payment' ? `Keep paying ${usd(before.policy.extraDebtPaymentPerMonth)}/month extra` : `Keep a ${usd(before.policy.minCashBuffer)} cash buffer`);
      for (const [id, k] of [['half', 0.5], ['double', 2]] as const) {
        const v = clampMoney(a.amount * k, BOUNDS.contributionMax);
        if (v !== a.amount) out.push({ id, label: describeAction(config, before, { ...a, amount: v }), entry: scaled(entry, { ...a, amount: v }) });
      }
      break;
    }
    case 'set_housing':
      undo(`Keep housing at ${usd(before.household.housingMonthly)}/month`);
      break;
    case 'transfer':
      undo("Don't make this transfer");
      break;
    case 'apply_event_option':
    case 'dismiss_event':
    case 'enqueue_event': {
      for (const alt of entry.alternatives ?? []) {
        out.push({
          id: `option:${alt.optionId}`,
          label: `Choose "${alt.label}" instead`,
          entry: alt.effect.template === 'none' ? null : { ...entry, action: { type: 'apply_event_option', eventId: a.type === 'apply_event_option' ? a.eventId : '', optionId: alt.optionId }, resolvedEffect: structuredClone(alt.effect), label: alt.label, alternatives: undefined },
        });
      }
      // Without recorded alternatives (older saves) the only replayable alternative is not taking it.
      if (!out.some((r) => r.entry === null)) undo('Turn it down');
      break;
    }
    default:
      undo('Skip this decision');
  }
  return out;
}

function isDecision(entry: PolicyLogEntry): boolean {
  return hasPolicyDecisions([entry]);
}

function entryLabel(config: GameConfig, before: GameState, entry: PolicyLogEntry): string {
  const a = entry.action;
  if (a.type === 'apply_event_option' || a.type === 'dismiss_event' || a.type === 'enqueue_event') {
    return entry.label ?? `Event choice: ${describeEffect(entry.resolvedEffect as EventEffect)}`;
  }
  return describeAction(config, before, a);
}

const ALL_ID = 'all';
const DEFAULTS_ID = 'defaults';
const DEFAULTS_LABEL = 'Never change anything (default plan)';

// ── Hypotheticals: "what if, from the start" choices, offered even when the player changed nothing ──

/** Ids of hypothetical decisions start with this; the UI may group them separately. */
export const HYPOTHETICAL_PREFIX = 'hyp:';

interface Hypothetical { choice: DecisionChoice; entries: Map<string, PolicyLogEntry> }

/** Month-0 policy changes a player could have made from day one, relative to the archetype's starting plan. */
function hypotheticals(config: GameConfig): Hypothetical[] {
  const s = createGame(config);
  const p = s.policy;
  const out: Hypothetical[] = [];
  const at0 = (action: GameAction): PolicyLogEntry => ({ monthIndex: 0, action });
  const add = (id: string, label: string, options: [string, string, PolicyLogEntry | null][]) => {
    const entries = new Map<string, PolicyLogEntry>();
    const alternatives: DecisionAlternative[] = [];
    for (const [altId, altLabel, entry] of options) {
      if (!entry) continue;
      entries.set(altId, entry);
      alternatives.push({ id: altId, label: altLabel });
    }
    if (alternatives.length) out.push({ choice: { id: `${HYPOTHETICAL_PREFIX}${id}`, logIndex: null, monthIndex: 0, label: `From the start · ${label}`, alternatives }, entries });
  };

  add('save', 'Save more each month', ([100, 250, 500] as const).map((more) => {
    const v = clampMoney(p.savingsContributionPerMonth + more, BOUNDS.contributionMax);
    return [`plus${more}`, `Save ${usd(more)}/month more (${usd(v)}/month)`, v === p.savingsContributionPerMonth ? null : at0({ type: 'set_contributions', savingsContributionPerMonth: v, investmentContributionPerMonth: p.investmentContributionPerMonth })];
  }));
  add('invest', 'Invest more each month', ([50, 150, 300] as const).map((more) => {
    const v = clampMoney(p.investmentContributionPerMonth + more, BOUNDS.contributionMax);
    return [`plus${more}`, `Invest ${usd(more)}/month more (${usd(v)}/month)`, v === p.investmentContributionPerMonth ? null : at0({ type: 'set_contributions', savingsContributionPerMonth: p.savingsContributionPerMonth, investmentContributionPerMonth: v })];
  }));
  const spend = s.household.discretionaryMonthly;
  add('spend', 'Spend less on lifestyle', ([10, 25, 50] as const).map((cut) => {
    const v = clampMoney(spend * (1 - cut / 100), BOUNDS.monthlySpendMax);
    return [`cut${cut}`, `Spend ${cut}% less (${usd(v)}/month)`, v === spend ? null : at0({ type: 'set_budget', discretionaryMonthly: v })];
  }));
  const same = (a: Allocation) => (['stock', 'bond', 'etf'] as const).every((k) => Math.abs(a[k] - p.targetAllocation[k]) < 1e-9);
  add('allocation', 'Invest differently', ([
    ['all-stock', 'Put everything in the tech stock basket', { stock: 1, bond: 0, etf: 0 }],
    ['all-etf', 'Put everything in the S&P 500 index ETF', { stock: 0, bond: 0, etf: 1 }],
    ['60-40', 'Use a 60% ETF / 40% bonds mix', { stock: 0, bond: 0.4, etf: 0.6 }],
    ['all-bonds', 'Put everything in bonds', { stock: 0, bond: 1, etf: 0 }],
  ] as [string, string, Allocation][]).map(([id, label, allocation]) => [id, label, same(allocation) ? null : at0({ type: 'set_allocation', allocation })]));
  const current = s.insurance.health ?? null;
  add('insurance', 'Pick a different health plan', config.assumptions.insurancePlans.filter((plan) => plan.line === 'health' && plan.id !== current)
    .map((plan) => [`plan:${plan.id}`, `Choose ${plan.name}`, at0({ type: 'set_insurance', line: 'health', planId: plan.id })]));
  const financed = s.debts.some((d) => d.kind === 'auto_loan' && d.balance > 0);
  add('car', s.car.owned ? 'Drive a different car' : 'Own a car', CAR_VALUE_BANDS
    .filter((band): band is CarValueBand => band !== s.car.valueBand && !(band === 'none' && financed))
    .map((band): [string, string, PolicyLogEntry | null] => band === 'none'
      ? ['car:none', 'Go without a car (no running costs, no repairs, no auto cover)', at0({ type: 'set_car', owned: false, valueBand: 'none' })]
      : [`car:${band}`, `Own a ${describeCar({ owned: true, valueBand: band }).toLowerCase()} at ${usd(carRunningCost(band))}/month`, at0({ type: 'set_car', owned: true, valueBand: band })]));
  if (hasCar(s)) {
    const auto = s.insurance.auto ?? null;
    add('auto', 'Insure the car differently', [
      ...config.assumptions.insurancePlans.filter((plan) => plan.line === 'auto' && plan.id !== auto)
        .map((plan): [string, string, PolicyLogEntry | null] => [`plan:${plan.id}`, `Choose ${plan.name}`, at0({ type: 'set_insurance', line: 'auto', planId: plan.id })]),
      ['plan:none', 'Go without auto coverage', auto === null ? null : at0({ type: 'set_insurance', line: 'auto', planId: null })],
    ]);
  }
  return out;
}

export function listDecisions(config: GameConfig, policyLog: PolicyLogEntry[]): DecisionChoice[] {
  const out: DecisionChoice[] = [];
  policyLog.forEach((entry, i) => {
    if (!isDecision(entry)) return;
    const before = stateBeforeEntry(config, policyLog, i);
    const alternatives: DecisionAlternative[] = replacementsFor(config, before, entry).map(({ id, label }) => ({ id, label }));
    out.push({ id: String(i), logIndex: i, monthIndex: entry.monthIndex, label: `Month ${entry.monthIndex} · ${entryLabel(config, before, entry)}`, alternatives });
  });
  if (out.length > 0) out.unshift({ id: ALL_ID, logIndex: null, monthIndex: null, label: 'All my decisions', alternatives: [{ id: DEFAULTS_ID, label: DEFAULTS_LABEL }] });
  for (const h of hypotheticals(config)) out.push(h.choice);
  return out;
}

/** The policy log with one decision replaced (or every decision dropped for 'all'/'defaults', or a hypothetical added at month 0). */
export function changedPolicyLog(config: GameConfig, policyLog: PolicyLogEntry[], decisionId: string, alternativeId: string): { log: PolicyLogEntry[]; decisionLabel: string; alternativeLabel: string } {
  if (decisionId === ALL_ID) {
    if (alternativeId !== DEFAULTS_ID) throw new Error(`Unknown alternative ${alternativeId}`);
    return { log: [], decisionLabel: 'All my decisions', alternativeLabel: DEFAULTS_LABEL };
  }
  if (decisionId.startsWith(HYPOTHETICAL_PREFIX)) {
    const h = hypotheticals(config).find((x) => x.choice.id === decisionId);
    const entry = h?.entries.get(alternativeId);
    const alternative = h?.choice.alternatives.find((a) => a.id === alternativeId);
    if (!h || !entry || !alternative) throw new Error(`Unknown hypothetical ${decisionId}/${alternativeId}`);
    // The hypothetical applies from day one; the player's later decisions still happen after it.
    return { log: [entry, ...policyLog], decisionLabel: h.choice.label, alternativeLabel: alternative.label };
  }
  const index = Number(decisionId);
  const entry = policyLog[index];
  if (!Number.isInteger(index) || !entry || !isDecision(entry)) throw new Error(`Unknown decision ${decisionId}`);
  const before = stateBeforeEntry(config, policyLog, index);
  const replacement = replacementsFor(config, before, entry).find((r) => r.id === alternativeId);
  if (!replacement) throw new Error(`Unknown alternative ${alternativeId}`);
  const log = policyLog.slice();
  if (replacement.entry) log[index] = replacement.entry;
  else log.splice(index, 1);
  return { log, decisionLabel: `Month ${entry.monthIndex} · ${entryLabel(config, before, entry)}`, alternativeLabel: replacement.label };
}

// ── Running a what-if ───────────────────────────────────────────────────────

/** Replays within this many dollars of the observed ending count as reproducing the player's game. */
const REPLAY_TOLERANCE = 1;

export function runWhatIf(input: WhatIfInput): WhatIfResult {
  const { config, policyLog, finishMonteCarlo: mc, startNetWorth, observedNetWorth } = input;
  const { log, decisionLabel, alternativeLabel } = changedPolicyLog(config, policyLog, input.decisionId, input.alternativeId);

  const original = outcomeLines(mc, startNetWorth);
  // Same base seed, path count and horizon as the finish run: identical luck in every path.
  const outcomes = runPaths(config, log, mc.seed, mc.pathsRequested, mc.months);
  const summary = summarize(outcomes, mc.months);

  // The player's own game: same seed as the game they played, so the same returns, shocks and job events.
  const replayOriginal = replayPath(config, policyLog, config.seed, mc.months, { asPlayed: true }).ending;
  const replayChanged = replayPath(config, log, config.seed, mc.months, { asPlayed: true }).ending;
  const yourEventsDelta = round2(replayChanged - replayOriginal);
  const yourEventsComparable = Math.abs(replayOriginal - observedNetWorth) <= REPLAY_TOLERANCE;

  const changed: OutcomeLines = {
    months: mc.months,
    start: original.start,
    p10: round2(summary.p10),
    median: round2(summary.median),
    p90: round2(summary.p90),
    // Anchor on what really happened, moved by the decision's effect alone; replay error never leaks into the delta.
    yourEvents: round2(original.yourEvents + yourEventsDelta),
    spread: round2(summary.p90 - summary.p10),
  };
  return {
    decisionLabel,
    alternativeLabel,
    original,
    changed,
    delta: {
      p10: round2(changed.p10 - original.p10),
      median: round2(changed.median - original.median),
      p90: round2(changed.p90 - original.p90),
      yourEvents: yourEventsDelta,
      spread: round2(changed.spread - original.spread),
    },
    yourEventsComparable,
    replayFallbacks: outcomes.reduce((a, o) => a + o.fallbacks, 0),
  };
}

// ── Async (Web Worker) wrapper ──────────────────────────────────────────────

const cache = new WeakMap<PolicyLogEntry[], Map<string, WhatIfResult>>();

function abortError(): Error {
  const e = new Error('What-if run aborted');
  e.name = 'AbortError';
  return e;
}

/**
 * runWhatIf off the main thread. Uses a module Web Worker in the browser and a yielded main-thread run where
 * workers are unavailable (tests). Results are cached per policy log, so switching back to a previous choice is instant.
 */
export function runWhatIfAsync(input: WhatIfInput, signal?: AbortSignal): Promise<WhatIfResult> {
  const key = `${input.finishMonteCarlo.seed}:${input.finishMonteCarlo.pathsRequested}:${input.finishMonteCarlo.months}:${input.decisionId}:${input.alternativeId}`;
  const perLog = cache.get(input.policyLog) ?? new Map<string, WhatIfResult>();
  cache.set(input.policyLog, perLog);
  const hit = perLog.get(key);
  if (hit) return Promise.resolve(hit);
  if (signal?.aborted) return Promise.reject(abortError());

  return new Promise<WhatIfResult>((resolve, reject) => {
    const done = (result: WhatIfResult) => { perLog.set(key, result); resolve(result); };
    if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
      const worker = new Worker(new URL('./whatIf.worker.ts', import.meta.url), { type: 'module' });
      const stop = () => { worker.terminate(); reject(abortError()); };
      signal?.addEventListener('abort', stop, { once: true });
      worker.onmessage = (event: MessageEvent<{ ok: true; result: WhatIfResult } | { ok: false; message: string }>) => {
        signal?.removeEventListener('abort', stop);
        worker.terminate();
        if (event.data.ok) done(event.data.result);
        else reject(new Error(event.data.message));
      };
      worker.onerror = (event) => { signal?.removeEventListener('abort', stop); worker.terminate(); reject(new Error(event.message || 'What-if worker failed')); };
      worker.postMessage(input);
      return;
    }
    const timer = setTimeout(() => {
      try { done(runWhatIf(input)); } catch (e) { reject(e); }
    }, 0);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(abortError()); }, { once: true });
  });
}
