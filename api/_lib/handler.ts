/**
 * Platform-agnostic AI gateway handler. Owner: Agent 1.
 * Wrapped by api/ai.ts (Vercel) and server/aiDevMiddleware.ts (Vite dev).
 *
 * Contract: returns `source:'ai'` responses only. On any failure it returns an
 * AiErrorResponse with a code; the browser client (src/services/aiClient.ts)
 * then produces the deterministic offline fallback. No secrets, no PII storage.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import type { AiErrorResponse, AiResponse } from '../../src/types/domain';
import { EXPLAIN_SYSTEM, OPPORTUNITY_SYSTEM, SCENARIO_SYSTEM } from './prompts';
import { AiRequestSchema, ExplainOutputSchema, OpportunityOutputSchema, ScenarioProposalSchema } from './schemas';

export interface HandlerResult { status: number; body: AiResponse | AiErrorResponse }
export interface HandlerEnv { AI_API_KEY?: string; AI_MODEL?: string; AI_ENABLED?: string; AI_TIMEOUT_MS?: string }

export const DEFAULT_MODEL = 'claude-opus-5-5';
const err = (status: number, code: AiErrorResponse['code'], error: string): HandlerResult => ({ status, body: { error, code } });

/** Minimal client surface so tests can inject a fake. */
export interface ModelClient {
  parse<T>(args: { system: string; user: string; schema: z.ZodType<T>; maxTokens: number }): Promise<{ parsed: T | null; stopReason: string | null }>;
}

export function makeAnthropicClient(env: HandlerEnv): ModelClient {
  const client = new Anthropic({ apiKey: env.AI_API_KEY, timeout: Number(env.AI_TIMEOUT_MS) || 25_000, maxRetries: 1 });
  const model = env.AI_MODEL || DEFAULT_MODEL;
  return {
    async parse({ system, user, schema, maxTokens }) {
      const res = await client.messages.parse({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: { format: zodOutputFormat(schema), effort: 'low' },
      });
      return { parsed: res.parsed_output ?? null, stopReason: res.stop_reason };
    },
  };
}

export async function handleAiRequest(rawBody: string, env: HandlerEnv, client?: ModelClient): Promise<HandlerResult> {
  let json: unknown;
  try {
    json = JSON.parse(rawBody || '{}');
  } catch {
    return err(400, 'invalid_request', 'Body must be JSON');
  }
  const parsed = AiRequestSchema.safeParse(json);
  if (!parsed.success) return err(400, 'invalid_request', `Invalid request: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ').slice(0, 400)}`);
  if (env.AI_ENABLED === 'false') return err(503, 'disabled', 'AI is disabled on this deployment (AI_ENABLED=false)');
  if (!client && !env.AI_API_KEY) return err(503, 'disabled', 'AI_API_KEY is not configured');
  const model = client ?? makeAnthropicClient(env);
  const req = parsed.data;

  try {
    if (req.kind === 'scenario') {
      const r = await model.parse({ system: SCENARIO_SYSTEM, user: JSON.stringify(req.input), schema: ScenarioProposalSchema, maxTokens: 2000 });
      if (r.stopReason === 'refusal') return err(502, 'upstream_error', 'Model declined the request');
      if (!r.parsed) return err(502, 'schema_mismatch', 'Model output did not match the scenario schema');
      return { status: 200, body: { kind: 'scenario', source: 'ai', proposal: r.parsed, warnings: [] } };
    }
    if (req.kind === 'opportunity') {
      const r = await model.parse({ system: OPPORTUNITY_SYSTEM, user: JSON.stringify(req.summary), schema: OpportunityOutputSchema, maxTokens: 2000 });
      if (r.stopReason === 'refusal') return err(502, 'upstream_error', 'Model declined the request');
      if (!r.parsed) return err(502, 'schema_mismatch', 'Model output did not match the opportunity schema');
      return { status: 200, body: { kind: 'opportunity', source: 'ai', proposal: r.parsed.proposal, warnings: [] } };
    }
    const r = await model.parse({ system: EXPLAIN_SYSTEM, user: JSON.stringify({ summary: req.summary, question: req.question, monteCarlo: req.monteCarlo ?? null }), schema: ExplainOutputSchema, maxTokens: 1500 });
    if (r.stopReason === 'refusal') return err(502, 'upstream_error', 'Model declined the request');
    if (!r.parsed) return err(502, 'schema_mismatch', 'Model output did not match the explain schema');
    return { status: 200, body: { kind: 'explain', source: 'ai', text: r.parsed.text, warnings: [] } };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return err(429, 'rate_limited', 'Model rate limited');
    if (e instanceof Anthropic.APIConnectionTimeoutError) return err(504, 'timeout', 'Model request timed out');
    if (e instanceof Anthropic.AuthenticationError) return err(502, 'upstream_error', 'AI credentials rejected');
    if (e instanceof Anthropic.APIError) return err(502, 'upstream_error', `Model error ${e.status ?? ''}`.trim());
    return err(502, 'upstream_error', e instanceof Error ? e.message.slice(0, 200) : 'Unknown error');
  }
}
