/**
 * Typed browser client for the AI gateway (POST /api/ai). Owner: Agent 1.
 * Every call resolves — on any failure it returns the offline fallback with
 * source:'fallback' and a warning, so UI never needs a try/catch to stay usable.
 */
import type { AiErrorResponse, AiRequest, AiResponse, MonteCarloResult, PersonalizedInput, ShockFlavourInput, StateSummary } from '@/types/domain';
import { fallbackExplanation, fallbackFlavour, fallbackOpportunity, fallbackScenario } from './aiFallback';
import { fallbackRecap, fallbackWhatIf } from './aiFallback';
import type { BuildingId, CoachFacts, CoachTurn } from '@/types/domain';
import { fallbackCoach } from './aiFallback';
import { isDemoMode } from '@/demo/demoMode';

export interface AiClientOptions {
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Force offline mode (e.g. VITE_AI_OFFLINE=true, tests). */
  offline?: boolean;
}

const defaultOffline = (): boolean => {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return env?.VITE_AI_OFFLINE === 'true';
  } catch {
    return false;
  }
};

export type ScenarioResult = Extract<AiResponse, { kind: 'scenario' }>;
export type OpportunityResult = Extract<AiResponse, { kind: 'opportunity' }>;
export type ExplainResult = Extract<AiResponse, { kind: 'explain' }>;
export type FlavourResult = Extract<AiResponse, { kind: 'flavour' }>;
export type WhatIfLineResult = Extract<AiResponse, { kind: 'whatif' }>;
export type RecapResult = Extract<AiResponse, { kind: 'recap' }>;
export type CoachResult = Extract<AiResponse, { kind: 'coach' }>;

/** On the /demo route the Sage, the letter and offers stay offline so a recording is deterministic; scenes and the ending still use the model. */
const DEMO_OFFLINE_KINDS: ReadonlySet<AiRequest['kind']> = new Set(['coach', 'scenario', 'opportunity']);

async function call(req: AiRequest, opts: AiClientOptions): Promise<AiResponse | null> {
  if (opts.offline ?? defaultOffline()) return null;
  if (DEMO_OFFLINE_KINDS.has(req.kind) && isDemoMode()) return null;
  const f = opts.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!f) return null;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000) : undefined;
  try {
    const res = await f(opts.endpoint ?? '/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req), signal: ctrl?.signal });
    const body = (await res.json().catch(() => null)) as AiResponse | AiErrorResponse | null;
    if (!res.ok || !body || !('kind' in body) || body.kind !== req.kind) return null;
    return body;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function generateScenario(input: PersonalizedInput, opts: AiClientOptions = {}): Promise<ScenarioResult> {
  const r = await call({ kind: 'scenario', input }, opts);
  if (r && r.kind === 'scenario') return r;
  return { kind: 'scenario', source: 'fallback', proposal: fallbackScenario(input), warnings: ['AI gateway unavailable; used offline keyword mapping.'] };
}

export async function proposeOpportunity(summary: StateSummary, opts: AiClientOptions = {}): Promise<OpportunityResult> {
  const r = await call({ kind: 'opportunity', summary }, opts);
  if (r && r.kind === 'opportunity') return r;
  return { kind: 'opportunity', source: 'fallback', proposal: fallbackOpportunity(summary), warnings: ['AI gateway unavailable; used rule-based opportunity.'] };
}

export async function explainOutcome(summary: StateSummary, question: string, monteCarlo?: MonteCarloResult, opts: AiClientOptions = {}): Promise<ExplainResult> {
  const mc = monteCarlo ? { median: monteCarlo.median, p10: monteCarlo.p10, p90: monteCarlo.p90, probabilityNegativeNetWorth: monteCarlo.probabilityNegativeNetWorth, probabilityLiquidityShortfall: monteCarlo.probabilityLiquidityShortfall, observedNetWorth: monteCarlo.observedNetWorth, percentileOfObserved: monteCarlo.percentileOfObserved } : undefined;
  const r = await call({ kind: 'explain', summary, question, monteCarlo: mc }, opts);
  if (r && r.kind === 'explain') return r;
  return { kind: 'explain', source: 'fallback', text: fallbackExplanation(summary, mc, question), warnings: ['AI gateway unavailable; used template explanation.'] };
}

/** News-wire scene for a shock; `seed` (usually the notification id) picks the offline line. */
export async function describeShock(shock: ShockFlavourInput, seed: number | string, opts: AiClientOptions = {}): Promise<FlavourResult> {
  const r = await call({ kind: 'flavour', shock }, opts);
  if (r && r.kind === 'flavour') return r;
  return { kind: 'flavour', source: 'fallback', ...fallbackFlavour(shock, seed), warnings: ['AI gateway unavailable; used offline scene.'] };
}

/** One caveman-logic sentence for a what-if comparison; falls back to the sign-based template. */
export async function explainWhatIf(comparison: Extract<AiRequest, { kind: 'whatif' }>['comparison'], opts: AiClientOptions = {}): Promise<WhatIfLineResult> {
  const r = await call({ kind: 'whatif', comparison }, opts);
  if (r && r.kind === 'whatif') return r;
  return { kind: 'whatif', source: 'fallback', text: fallbackWhatIf(comparison), warnings: ['AI gateway unavailable; used template what-if line.'] };
}

/** Three news-wire sentences recapping a finished run; falls back to the template recap. */
export async function recapRun(recap: Extract<AiRequest, { kind: 'recap' }>['recap'], opts: AiClientOptions = {}): Promise<RecapResult> {
  const r = await call({ kind: 'recap', recap }, opts);
  if (r && r.kind === 'recap') return r;
  return { kind: 'recap', source: 'fallback', text: fallbackRecap(recap), warnings: ['AI gateway unavailable; used template recap.'] };
}

/** Coach chat: one ELI5 answer (≤ 70 words) to a short question; the last 4 turns give the model context. */
export async function askCoach(summary: StateSummary, question: string, history: CoachTurn[] = [], openBuilding: BuildingId | null = null, facts?: CoachFacts, opts: AiClientOptions = {}): Promise<CoachResult> {
  const q = question.trim().slice(0, 300);
  const turns = history.slice(-4).map((t) => ({ role: t.role, text: t.text.slice(0, 600) }));
  const r = await call({ kind: 'coach', summary, question: q, history: turns, openBuilding, facts }, opts);
  if (r && r.kind === 'coach') return r;
  return { kind: 'coach', source: 'fallback', text: fallbackCoach(summary, q, openBuilding, facts), warnings: ['AI gateway unavailable; used offline coach answer.'] };
}

export { scenarioToConfig, proposalToEvent } from './scenarioMapper';
