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
import { EXPLAIN_SYSTEM, OPPORTUNITY_SYSTEM, SCENARIO_SYSTEM, buildExplainUser, buildOpportunityUser } from './prompts.js';
import { AiRequestSchema, ExplainOutputSchema, OpportunityOutputSchema, ScenarioProposalSchema } from './schemas.js';
import { makeOpenAiCompatibleClient, UpstreamError } from './openaiCompatible.js';
import { allowRequest, MAX_BODY_BYTES } from './rateLimit.js';
import { recap, runKind, whatif } from './kinds/index.js';

export interface HandlerResult { status: number; body: AiResponse | AiErrorResponse }
export interface HandlerEnv {
  AI_API_KEY?: string;
  /** Luminal's own variable name; used when AI_API_KEY is unset and implies the Luminal OpenAI-compatible defaults. */
  LUMINAL_API_KEY?: string;
  AI_MODEL?: string;
  AI_ENABLED?: string;
  AI_TIMEOUT_MS?: string;
  /** 'anthropic' (default) or 'openai_compatible' (e.g. Luminal router, vLLM). */
  AI_PROVIDER?: string;
  /** Base URL for openai_compatible, e.g. https://router.luminal.cloud */
  AI_BASE_URL?: string;
  /** 'bearer' (default) or 'api-key' for openai_compatible. */
  AI_AUTH_HEADER?: string;
}

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

export const LUMINAL_DEFAULTS = { AI_PROVIDER: 'openai_compatible', AI_BASE_URL: 'https://flash.luminal.cloud', AI_MODEL: 'deepseek-ai/DeepSeek-V4.1-Flash' } as const;

/** Resolve the key and provider: AI_* wins; a bare LUMINAL_API_KEY selects the Luminal defaults. */
export function resolveEnv(env: HandlerEnv): HandlerEnv {
  if (env.AI_API_KEY || !env.LUMINAL_API_KEY) return env;
  return { ...LUMINAL_DEFAULTS, ...Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== '')), AI_API_KEY: env.LUMINAL_API_KEY };
}

export function makeClientFromEnv(rawEnv: HandlerEnv): ModelClient | { error: HandlerResult } {
  const env = resolveEnv(rawEnv);
  if (!env.AI_API_KEY) return { error: err(503, 'disabled', 'AI_API_KEY is not configured') };
  if ((env.AI_PROVIDER ?? 'anthropic') === 'openai_compatible') {
    if (!env.AI_BASE_URL) return { error: err(503, 'disabled', 'AI_BASE_URL is required for AI_PROVIDER=openai_compatible') };
    if (!env.AI_MODEL) return { error: err(503, 'disabled', 'AI_MODEL is required for AI_PROVIDER=openai_compatible') };
    return makeOpenAiCompatibleClient({ baseUrl: env.AI_BASE_URL, apiKey: env.AI_API_KEY, model: env.AI_MODEL, authHeader: env.AI_AUTH_HEADER === 'api-key' ? 'api-key' : 'bearer', timeoutMs: Number(env.AI_TIMEOUT_MS) || 25_000 });
  }
  return makeAnthropicClient(env);
}

export interface RequestMeta { clientKey?: string }

export async function handleAiRequest(rawBody: string, env: HandlerEnv, client?: ModelClient, meta: RequestMeta = {}): Promise<HandlerResult> {
  if (rawBody.length > MAX_BODY_BYTES) return err(413, 'invalid_request', 'Request body too large');
  if (meta.clientKey) {
    const gate = allowRequest(meta.clientKey);
    if (!gate.ok) return err(429, 'rate_limited', `Too many AI requests; retry in ${gate.retryAfterSec}s`);
  }
  let json: unknown;
  try {
    json = JSON.parse(rawBody || '{}');
  } catch {
    return err(400, 'invalid_request', 'Body must be JSON');
  }
  const parsed = AiRequestSchema.safeParse(json);
  if (!parsed.success) return err(400, 'invalid_request', `Invalid request: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ').slice(0, 400)}`);
  if (env.AI_ENABLED === 'false') return err(503, 'disabled', 'AI is disabled on this deployment (AI_ENABLED=false)');
  let model: ModelClient;
  if (client) model = client;
  else {
    const made = makeClientFromEnv(env);
    if ('error' in made) return made.error;
    model = made;
  }
  const req = parsed.data;

  try {
    if (req.kind === 'scenario') {
      const r = await model.parse({ system: SCENARIO_SYSTEM, user: JSON.stringify(req.input), schema: ScenarioProposalSchema, maxTokens: 2000 });
      if (r.stopReason === 'refusal') return err(502, 'upstream_error', 'Model declined the request');
      if (!r.parsed) return err(502, 'schema_mismatch', 'Model output did not match the scenario schema');
      return { status: 200, body: { kind: 'scenario', source: 'ai', proposal: r.parsed, warnings: [] } };
    }
    if (req.kind === 'opportunity') {
      const r = await model.parse({ system: OPPORTUNITY_SYSTEM, user: buildOpportunityUser(req), schema: OpportunityOutputSchema, maxTokens: 2000 });
      if (r.stopReason === 'refusal') return err(502, 'upstream_error', 'Model declined the request');
      if (!r.parsed) return err(502, 'schema_mismatch', 'Model output did not match the opportunity schema');
      return { status: 200, body: { kind: 'opportunity', source: 'ai', proposal: r.parsed.proposal, warnings: [] } };
    }
    if (req.kind === 'whatif') { const k = await runKind(model, whatif, req); return k.ok ? { status: 200, body: { kind: 'whatif', source: 'ai', text: k.parsed.text, warnings: [] } } : err(502, k.code, k.error); }
    if (req.kind === 'recap') { const k = await runKind(model, recap, req); return k.ok ? { status: 200, body: { kind: 'recap', source: 'ai', text: k.parsed.text, warnings: [] } } : err(502, k.code, k.error); }
    const r = await model.parse({ system: EXPLAIN_SYSTEM, user: buildExplainUser(req), schema: ExplainOutputSchema, maxTokens: 800 });
    if (r.stopReason === 'refusal') return err(502, 'upstream_error', 'Model declined the request');
    if (!r.parsed) return err(502, 'schema_mismatch', 'Model output did not match the explain schema');
    return { status: 200, body: { kind: 'explain', source: 'ai', text: r.parsed.text, warnings: [] } };
  } catch (e) {
    if (e instanceof UpstreamError) {
      if (e.status === 429) return err(429, 'rate_limited', 'Model rate limited');
      if (e.status === 504) return err(504, 'timeout', 'Model request timed out');
      if (e.status === 401 || e.status === 403) return err(502, 'upstream_error', 'AI credentials rejected');
      return err(502, 'upstream_error', `Model error ${e.status}`);
    }
    if (e instanceof Anthropic.RateLimitError) return err(429, 'rate_limited', 'Model rate limited');
    if (e instanceof Anthropic.APIConnectionTimeoutError) return err(504, 'timeout', 'Model request timed out');
    if (e instanceof Anthropic.AuthenticationError) return err(502, 'upstream_error', 'AI credentials rejected');
    if (e instanceof Anthropic.APIError) return err(502, 'upstream_error', `Model error ${e.status ?? ''}`.trim());
    return err(502, 'upstream_error', 'Model request failed');
  }
}
