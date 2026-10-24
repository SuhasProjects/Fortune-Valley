/**
 * Typed browser client for the AI gateway (POST /api/ai). Owner: Agent 1.
 * Every call resolves — on any failure it returns the offline fallback with
 * source:'fallback' and a warning, so UI never needs a try/catch to stay usable.
 */
import type { AiErrorResponse, AiRequest, AiResponse, MonteCarloResult, PersonalizedInput, StateSummary } from '@/types/domain';
import { fallbackExplanation, fallbackOpportunity, fallbackScenario } from './aiFallback';

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

async function call(req: AiRequest, opts: AiClientOptions): Promise<AiResponse | null> {
  if (opts.offline ?? defaultOffline()) return null;
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
  return { kind: 'explain', source: 'fallback', text: fallbackExplanation(summary, mc), warnings: ['AI gateway unavailable; used template explanation.'] };
}

export { scenarioToConfig, proposalToEvent } from './scenarioMapper';
