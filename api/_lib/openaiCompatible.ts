/**
 * OpenAI-compatible chat-completions provider (Luminal router, vLLM, etc.).
 * Enabled with AI_PROVIDER=openai_compatible + AI_BASE_URL + AI_API_KEY + AI_MODEL.
 * JSON is requested via response_format and the system prompt, then verified
 * with Zod; one corrective retry on invalid JSON. Owner: Agent 1.
 */
import { z } from 'zod';
import type { ModelClient } from './handler';

export interface OpenAiCompatibleOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 'bearer' → Authorization: Bearer <key>; 'api-key' → Api-Key: <key> */
  authHeader?: 'bearer' | 'api-key';
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class UpstreamError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const stripFences = (s: string): string => {
  const t = s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  if (t.startsWith('{')) return t;
  // Models sometimes wrap JSON in prose; take the outermost object.
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  return first >= 0 && last > first ? t.slice(first, last + 1) : t;
};

/**
 * Accepts an origin (`https://flash.luminal.cloud`), a base already ending in `/v1`, or a full OpenAI-compatible prefix
 * such as Gemini's `https://generativelanguage.googleapis.com/v1beta/openai` (anything whose last segment is not a bare origin).
 */
export const chatCompletionsUrl = (baseUrl: string): string => {
  const base = baseUrl.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  if (/\/v1$/.test(base)) return `${base}/chat/completions`;
  if (/^https?:\/\/[^/]+$/.test(base)) return `${base}/v1/chat/completions`;
  return `${base}/chat/completions`;
};

export function makeOpenAiCompatibleClient(o: OpenAiCompatibleOptions): ModelClient {
  const f = o.fetchImpl ?? fetch;
  const url = chatCompletionsUrl(o.baseUrl);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  // Gemini's OpenAI-compatible endpoint spends the output budget on hidden "thinking" unless told not to; our outputs are
  // small structured JSON, so turn it off there (other providers would reject the unknown field).
  const gemini = /generativelanguage\.googleapis\.com/.test(url);
  // Lite models have no thinking and reject the field with 400; we also drop it after any 400 that mentions the argument.
  let providerExtras: Record<string, unknown> = gemini && !/lite/i.test(o.model) ? { extra_body: { google: { thinking_config: { thinking_budget: 0 } } } } : {};
  if (o.authHeader === 'api-key') headers['Api-Key'] = o.apiKey; else headers['Authorization'] = `Bearer ${o.apiKey}`;

  /** Some OpenAI-compatible servers reject `response_format`; remember that and stop sending it. */
  let supportsResponseFormat = true;

  async function chat(messages: { role: 'system' | 'user' | 'assistant'; content: string }[], maxTokens: number): Promise<{ text: string; finish: string | null }> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 25_000);
    try {
      const send = (withFormat: boolean) => f(url, { method: 'POST', headers, signal: ctrl.signal, body: JSON.stringify({ model: o.model, max_tokens: maxTokens, temperature: 0.2, ...providerExtras, ...(withFormat ? { response_format: { type: 'json_object' } } : {}), messages }) });
      type Body = { choices?: { message?: { content?: string | null }; finish_reason?: string | null }[]; error?: { message?: string } | string } | null;
      // Gemini wraps errors in a one-element array; unwrap so the message survives.
      const readBody = async (r: Response): Promise<Body> => { const j: unknown = await r.json().catch(() => null); return (Array.isArray(j) ? j[0] : j) as Body; };
      let res = await send(supportsResponseFormat);
      let body = await readBody(res);
      if (res.status === 400 && Object.keys(providerExtras).length > 0) {
        providerExtras = {};
        res = await send(supportsResponseFormat);
        body = await readBody(res);
      }
      if (res.status === 400 && supportsResponseFormat && /response_format|json_object/i.test(JSON.stringify(body ?? ''))) {
        supportsResponseFormat = false;
        res = await send(false);
        body = await readBody(res);
      }
      if (res.status === 503) {
        // Busy upstream (Gemini "high demand"): one short pause and one more try before giving up.
        await new Promise((resolve) => setTimeout(resolve, 600));
        res = await send(supportsResponseFormat);
        body = await readBody(res);
      }
      if (!res.ok) {
        const message = typeof body?.error === 'string' ? body.error : body?.error?.message ?? `HTTP ${res.status}`;
        // Server log only (Vercel function logs / dev terminal); the browser never sees provider bodies.
        console.error(`[ai] upstream ${res.status} from ${url} model=${o.model}: ${message.slice(0, 300)}`);
        throw new UpstreamError(res.status, message);
      }
      const choice = body?.choices?.[0];
      return { text: choice?.message?.content ?? '', finish: choice?.finish_reason ?? null };
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw new UpstreamError(504, 'timeout');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async parse({ system, user, schema, maxTokens }) {
      const jsonSchema = JSON.stringify(z.toJSONSchema(schema as z.ZodType));
      const sys = `${system}\n\nReturn ONLY a JSON object (no prose, no code fences) that validates against this JSON Schema:\n${jsonSchema}`;
      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [{ role: 'system', content: sys }, { role: 'user', content: user }];
      for (let attempt = 0; attempt < 2; attempt++) {
        const { text, finish } = await chat(messages, maxTokens);
        if (finish === 'content_filter') return { parsed: null, stopReason: 'refusal' };
        let candidate: unknown;
        try { candidate = JSON.parse(stripFences(text)); } catch { candidate = undefined; }
        const r = candidate === undefined ? null : schema.safeParse(candidate);
        if (r?.success) return { parsed: r.data, stopReason: finish };
        const issues = r ? r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : 'response was not valid JSON';
        if (process.env.AI_DEBUG) console.error(`[ai] attempt ${attempt + 1} did not validate: ${issues.slice(0, 800)}\n[ai] raw: ${text.slice(0, 1500)}`);
        messages.push({ role: 'assistant', content: text.slice(0, 4000) }, { role: 'user', content: `That did not validate (${issues.slice(0, 600)}). Return only a corrected JSON object.` });
      }
      return { parsed: null, stopReason: 'schema_mismatch' };
    },
  };
}
