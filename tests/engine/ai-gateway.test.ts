import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleAiRequest, type HandlerResult, type ModelClient } from '../../api/_lib/handler';
import { makeOpenAiCompatibleClient } from '../../api/_lib/openaiCompatible';
import vercelHandler from '../../api/ai';
import { aiDevMiddleware, readServerEnv } from '../../server/aiDevMiddleware';
import { fixtureState, fixtureConfig } from '@/fixtures';
import { summarizeForAi } from '@/engine';
import { explainOutcome, generateScenario, proposeOpportunity, proposalToEvent, scenarioToConfig } from '@/services/aiClient';
import { createGame, applyAction } from '@/engine';

const fake = (output: unknown, stopReason = 'end_turn'): ModelClient => ({
  async parse({ schema }) {
    const r = schema.safeParse(output);
    return { parsed: r.success ? r.data : null, stopReason };
  },
});
const summary = () => summarizeForAi(fixtureState, fixtureConfig.narrativeFocus, 'entry_worker');

/** Scripted upstream for the OpenAI-compatible provider: a string is a 200 chat completion with that content. */
type Reply = string | { status: number; body?: unknown; raw?: string } | 'hang';
const mockFetch = (replies: Reply[]) => {
  const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
  const impl = ((url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
    calls.push({ url, body: JSON.parse(String(init.body)) as Record<string, unknown>, headers: init.headers as Record<string, string> });
    const r = replies.shift() ?? '{}';
    if (r === 'hang') { init.signal?.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); }); return; }
    if (typeof r === 'string') return resolve(new Response(JSON.stringify({ choices: [{ message: { content: r }, finish_reason: 'stop' }] }), { status: 200 }));
    resolve(new Response(r.raw ?? JSON.stringify(r.body ?? {}), { status: r.status }));
  })) as unknown as typeof fetch;
  return { impl, calls };
};
/** Replays a gateway result to the browser client exactly as the dev server / Vercel would serve it. */
const replay = (r: HandlerResult): typeof fetch => (async () => new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
/** Runs `fn` with every AI_* variable removed from process.env (api/ai.ts reads process.env directly). */
const withCleanAiEnv = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const saved = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('AI_')));
  for (const k of Object.keys(saved)) delete process.env[k];
  try { return await fn(); } finally { Object.assign(process.env, saved); }
};
const scenarioProposal = { baseArchetype: 'entry_worker', title: 'First job, first loan', description: 'Entry-level worker with a student loan.', overrides: { grossAnnualSalary: 55000, housingMonthly: 1300, debts: [{ name: 'Student loan', kind: 'student_loan', balance: 18000, apr: 0.06, minimumPayment: 200 }] }, narrativeFocus: ['debt_payoff', 'emergency_fund'], defaultsApplied: ['essentialsMonthly'] };
const scenarioInput = { freeText: "I'm 24, first job, 1,300 rent, 18k student loan at 6%", grossAnnualIncome: 55000, monthlyRent: 1300, debtBalance: 18000, debtApr: 0.06 };
const scenarioReq = JSON.stringify({ kind: 'scenario', input: scenarioInput });

describe('OpenAI-compatible provider end to end (mocked fetch) → gateway code → browser fallback', () => {
  const env = { AI_PROVIDER: 'openai_compatible', AI_BASE_URL: 'https://flash.example', AI_MODEL: 'test/model', AI_API_KEY: 'k' };
  const client = (impl: typeof fetch, timeoutMs?: number) => makeOpenAiCompatibleClient({ baseUrl: env.AI_BASE_URL, apiKey: 'k', model: env.AI_MODEL, fetchImpl: impl, timeoutMs });

  it('scenario with a car: the input carries car numbers, the prompt asks for car inference, and the reply maps onto config', async () => {
    const carProposal = { ...scenarioProposal, overrides: { ...scenarioProposal.overrides, car: { owned: true, monthlyCost: 300 } }, defaultsApplied: ['essentialsMonthly'] };
    const { impl, calls } = mockFetch([JSON.stringify(carProposal)]);
    const carInput = { ...scenarioInput, freeText: 'I drive to work, rent is 1,300, 18k student loan', car: { owned: true, monthlyCost: 300 } };
    const r = await handleAiRequest(JSON.stringify({ kind: 'scenario', input: carInput }), env, client(impl));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ kind: 'scenario', source: 'ai', proposal: carProposal });
    const messages = calls[0]!.body.messages as { role: string; content: string }[];
    expect(messages[0]!.content).toMatch(/I drive to work.*car\.owned true/);
    expect(messages[1]!.content).toContain('"car":{"owned":true,"monthlyCost":300}');
    const res = await generateScenario(carInput, { fetchImpl: replay(r) });
    expect(res.source).toBe('ai');
    const cfg = scenarioToConfig(res.proposal, 7, res.source);
    expect(cfg.initialState.car).toEqual({ owned: true, valueBand: 'mid' });
    expect(createGame(cfg).car).toEqual({ owned: true, valueBand: 'mid' });
    // A reply with an impossible car band is a schema mismatch, not a crash.
    const bad = mockFetch([JSON.stringify({ ...carProposal, overrides: { car: { owned: true, valueBand: 'none' } } })]);
    expect((await handleAiRequest(JSON.stringify({ kind: 'scenario', input: carInput }), env, client(bad.impl))).body).toMatchObject({ code: 'schema_mismatch' });
  });
  it('scenario success: JSON reply → source:ai proposal that the engine turns into a playable config', async () => {
    const { impl, calls } = mockFetch([JSON.stringify(scenarioProposal)]);
    const r = await handleAiRequest(scenarioReq, env, client(impl));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ kind: 'scenario', source: 'ai', proposal: scenarioProposal, warnings: [] });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body.model).toBe('test/model');
    expect((calls[0]!.body.messages as { role: string }[]).map((m) => m.role)).toEqual(['system', 'user']);
    const res = await generateScenario(scenarioInput, { fetchImpl: replay(r) });
    expect(res.source).toBe('ai');
    expect(createGame(scenarioToConfig(res.proposal, 7, res.source)).status).toBe('setup');
  });

  it('markdown-fenced JSON is repaired on the first attempt (no retry round-trip)', async () => {
    const { impl, calls } = mockFetch(['```json\n' + JSON.stringify(scenarioProposal) + '\n```']);
    const r = await handleAiRequest(scenarioReq, env, client(impl));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ source: 'ai', proposal: { title: 'First job, first loan' } });
    expect(calls).toHaveLength(1);
  });

  it('unparseable output twice → 502 schema_mismatch, and the browser client uses the offline keyword mapping', async () => {
    const { impl, calls } = mockFetch(['Sorry, I cannot produce that.', '{"baseArchetype": "entry_worker", "title": ']);
    const r = await handleAiRequest(scenarioReq, env, client(impl));
    expect(r).toMatchObject({ status: 502, body: { code: 'schema_mismatch' } });
    expect(calls).toHaveLength(2);
    expect(JSON.stringify(calls[1]!.body)).toMatch(/not valid JSON/);
    const res = await generateScenario(scenarioInput, { fetchImpl: replay(r) });
    expect(res.source).toBe('fallback');
    expect(res.proposal.overrides.housingMonthly).toBe(1300);
    expect(res.warnings[0]).toMatch(/offline/);
  });

  it('200 with no choices, or a non-JSON body, is a schema_mismatch rather than a crash', async () => {
    for (const reply of [{ status: 200, body: {} }, { status: 200, raw: '<html>gateway</html>' }]) {
      const { impl } = mockFetch([reply, reply]);
      const r = await handleAiRequest(scenarioReq, env, client(impl));
      expect(r.body).toMatchObject({ code: 'schema_mismatch' });
    }
  });

  it.each([[401, 'upstream_error', 502, 1], [403, 'upstream_error', 502, 1], [429, 'rate_limited', 429, 1], [500, 'upstream_error', 502, 1], [503, 'upstream_error', 502, 2]] as const)(
    'upstream %i → %s (503 gets one retry, provider message not forwarded) and every client call falls back', async (status, code, http, attempts) => {
      const { impl, calls } = mockFetch([{ status, body: { error: { message: 'nope-from-provider' } } }, { status, body: { error: { message: 'nope-from-provider' } } }]);
      const r = await handleAiRequest(scenarioReq, env, client(impl));
      expect(r).toMatchObject({ status: http, body: { code } });
      expect(calls).toHaveLength(attempts);
      expect(JSON.stringify(r.body)).not.toContain('nope-from-provider');
      const s = summary();
      const [a, b, c] = await Promise.all([generateScenario(scenarioInput, { fetchImpl: replay(r) }), proposeOpportunity(s, { fetchImpl: replay(r) }), explainOutcome(s, 'why', undefined, { fetchImpl: replay(r) })]);
      expect([a.source, b.source, c.source]).toEqual(['fallback', 'fallback', 'fallback']);
      expect([a.kind, b.kind, c.kind]).toEqual(['scenario', 'opportunity', 'explain']);
    },
  );

  it('upstream timeout → 504 timeout → fallback; a hung gateway also falls back on the client-side timer', async () => {
    const { impl } = mockFetch(['hang']);
    const r = await handleAiRequest(scenarioReq, env, client(impl, 20));
    expect(r).toMatchObject({ status: 504, body: { code: 'timeout' } });
    expect((await proposeOpportunity(summary(), { fetchImpl: replay(r) })).source).toBe('fallback');
    const { impl: hung } = mockFetch(['hang']);
    const direct = await explainOutcome(summary(), 'why', undefined, { fetchImpl: hung, timeoutMs: 20 });
    expect(direct.source).toBe('fallback');
  });

  it('per-client rate limit: the 41st request in the window is 429 rate_limited and never reaches the model', async () => {
    let modelCalls = 0;
    const counting: ModelClient = { async parse({ schema }) { modelCalls++; return { parsed: schema.parse({ text: 'ok' }), stopReason: 'stop' }; } };
    const meta = { clientKey: `rate-limit-test-${Math.random()}` };
    const body = JSON.stringify({ kind: 'explain', summary: summary(), question: 'why' });
    for (let i = 0; i < 40; i++) expect((await handleAiRequest(body, env, counting, meta)).status).toBe(200);
    const r = await handleAiRequest(body, env, counting, meta);
    expect(r).toMatchObject({ status: 429, body: { code: 'rate_limited', error: expect.stringMatching(/retry in \d+s/) } });
    expect(modelCalls).toBe(40);
    expect((await explainOutcome(summary(), 'why', undefined, { fetchImpl: replay(r) })).source).toBe('fallback');
  });

  it('.env.example (Gemini) drives the real client factory: URL, model and bearer header', async () => {
    const example = Object.fromEntries(readFileSync('.env.example', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
    expect(example).toMatchObject({ AI_PROVIDER: 'openai_compatible', AI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/openai', AI_MODEL: 'gemini-3.5-flash-lite', AI_API_KEY: '', GEMINI_API_KEY: '' });
    expect((await handleAiRequest(scenarioReq, example)).body).toMatchObject({ code: 'disabled' });
    const { impl, calls } = mockFetch([JSON.stringify(scenarioProposal)]);
    vi.stubGlobal('fetch', impl);
    try {
      const r = await handleAiRequest(scenarioReq, { ...example, GEMINI_API_KEY: 'test-key' });
      expect(r.status).toBe(200);
      expect(calls[0]!.url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
      expect(calls[0]!.headers.Authorization).toBe('Bearer test-key');
      expect(calls[0]!.body.model).toBe('gemini-3.5-flash-lite');
      expect(calls[0]!.body.response_format).toEqual({ type: 'json_object' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('AI_BASE_URL may carry a trailing slash or /v1 without doubling the path', async () => {
    for (const baseUrl of ['https://flash.example/', 'https://flash.example/v1', 'https://flash.example/v1/']) {
      const { impl, calls } = mockFetch([JSON.stringify(scenarioProposal)]);
      await handleAiRequest(scenarioReq, env, makeOpenAiCompatibleClient({ baseUrl, apiKey: 'k', model: 'm', fetchImpl: impl }));
      expect(calls[0]!.url, baseUrl).toBe('https://flash.example/v1/chat/completions');
    }
  });
});

describe('dev middleware (npm run dev) serves the same shape as the Vercel function', () => {
  interface Served { status: number; headers: Record<string, string>; body: unknown }
  const serveDev = async (envDir: string, method: string, raw: string): Promise<Served> => {
    let route: ((req: unknown, res: unknown) => unknown) | undefined;
    const server = { config: { mode: 'development', envDir, root: envDir }, middlewares: { use: (path: string, fn: typeof route) => { expect(path).toBe('/api/ai'); route = fn; } }, ssrLoadModule: async () => import('../../api/_lib/handler') };
    (aiDevMiddleware().configureServer as (s: unknown) => void)(server);
    const req = Object.assign(new EventEmitter(), { method, socket: { remoteAddress: `dev-test-${Math.random()}` } });
    const out: Served = { status: 0, headers: {}, body: undefined };
    const done = new Promise<Served>((resolve) => {
      const res = { statusCode: 200, setHeader: (k: string, v: string) => { out.headers[k] = v; }, end: (s: string) => { out.status = res.statusCode; out.body = JSON.parse(s); resolve(out); } };
      void route!(req, res);
    });
    req.emit('data', Buffer.from(raw));
    req.emit('end');
    return done;
  };
  const serveVercel = async (method: string, raw: string): Promise<Served> => {
    const out: Served = { status: 0, headers: {}, body: undefined };
    const res = { status(c: number) { out.status = c; return res; }, json(b: unknown) { out.body = b; }, setHeader(k: string, v: string) { out.headers[k] = v; } };
    await vercelHandler({ method, body: raw, headers: { 'x-forwarded-for': `vercel-test-${Math.random()}` } }, res);
    return out;
  };

  it('405 / 400 / 503 responses are identical through both entry points', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fv-ai-noenv-'));
    await withCleanAiEnv(async () => {
      const cases: [string, string][] = [['GET', ''], ['POST', 'not json'], ['POST', JSON.stringify({ kind: 'opportunity', summary: summary() })]];
      const expected = [405, 400, 503];
      for (const [i, [method, raw]] of cases.entries()) {
        const [dev, vercel] = await Promise.all([serveDev(dir, method, raw), serveVercel(method, raw)]);
        expect(dev.status, method + raw.slice(0, 20)).toBe(expected[i]);
        expect(vercel.status).toBe(dev.status);
        expect(vercel.body).toEqual(dev.body);
        expect(dev.headers['content-type']).toBe('application/json');
        expect(dev.headers['cache-control']).toBe('no-store');
        expect(vercel.headers['cache-control']).toBe('no-store');
      }
    });
  });

  it('reads AI_* from .env files (Vite does not copy them into process.env); shell variables win', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fv-ai-env-'));
    writeFileSync(join(dir, '.env'), 'AI_API_KEY=file-key\nAI_PROVIDER=openai_compatible\nAI_BASE_URL=https://flash.example\nAI_MODEL=file/model\n');
    await withCleanAiEnv(async () => {
      expect(readServerEnv('development', dir, {})).toMatchObject({ AI_API_KEY: 'file-key', AI_MODEL: 'file/model' });
      expect(readServerEnv('development', dir, { AI_MODEL: 'shell/model' }).AI_MODEL).toBe('shell/model');
      const { impl, calls } = mockFetch(['{"text":"Across replays, the typical ending was positive."}']);
      vi.stubGlobal('fetch', impl);
      try {
        const served = await serveDev(dir, 'POST', JSON.stringify({ kind: 'explain', summary: summary(), question: 'why' }));
        expect(served.status).toBe(200);
        expect(served.body).toMatchObject({ kind: 'explain', source: 'ai', text: 'Across replays, the typical ending was positive.', warnings: [] });
        expect(calls[0]!.url).toBe('https://flash.example/v1/chat/completions');
        expect(calls[0]!.headers.Authorization).toBe('Bearer file-key');
        expect(calls[0]!.body.model).toBe('file/model');
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});

describe('OpenAI-compatible provider', () => {
  const env = { AI_PROVIDER: 'openai_compatible', AI_BASE_URL: 'https://router.example', AI_MODEL: 'test/model', AI_API_KEY: 'k' };
  const fakeFetch = (replies: (string | { status: number; body: unknown })[]) => {
    const calls: { url: string; body: unknown; headers: Record<string, string> }[] = [];
    const impl = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
      const r = replies.shift() ?? '{}';
      if (typeof r !== 'string') return new Response(JSON.stringify(r.body), { status: r.status });
      return new Response(JSON.stringify({ choices: [{ message: { content: r }, finish_reason: 'stop' }] }), { status: 200 });
    }) as unknown as typeof fetch;
    return { impl, calls };
  };
  it('requests JSON, validates with Zod, and retries once with the validation error', async () => {
    const { makeOpenAiCompatibleClient } = await import('../../api/_lib/openaiCompatible');
    const { impl, calls } = fakeFetch(['```json\n{"text": 42}\n```', '{"text":"Median ending net worth was fine."}']);
    const client = makeOpenAiCompatibleClient({ baseUrl: env.AI_BASE_URL, apiKey: 'k', model: env.AI_MODEL, fetchImpl: impl });
    const r = await handleAiRequest(JSON.stringify({ kind: 'explain', summary: summary(), question: 'why' }), env, client);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ kind: 'explain', source: 'ai', text: 'Median ending net worth was fine.' });
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toBe('https://router.example/v1/chat/completions');
    expect(calls[0]!.headers.Authorization).toBe('Bearer k');
    expect((calls[0]!.body as { response_format: { type: string } }).response_format.type).toBe('json_object');
    expect(JSON.stringify(calls[1]!.body)).toMatch(/did not validate/);
  });
  it('maps upstream 401/429 to gateway error codes so the client falls back', async () => {
    const { makeOpenAiCompatibleClient } = await import('../../api/_lib/openaiCompatible');
    for (const [status, code] of [[401, 'upstream_error'], [429, 'rate_limited']] as const) {
      const { impl } = fakeFetch([{ status, body: { error: 'Invalid API key' } }]);
      const client = makeOpenAiCompatibleClient({ baseUrl: env.AI_BASE_URL, apiKey: 'k', model: env.AI_MODEL, fetchImpl: impl });
      const r = await handleAiRequest(JSON.stringify({ kind: 'opportunity', summary: summary() }), env, client);
      expect(r.body).toMatchObject({ code });
    }
  });
  it('falls back to no response_format when the server rejects it, and extracts JSON wrapped in prose', async () => {
    const { makeOpenAiCompatibleClient } = await import('../../api/_lib/openaiCompatible');
    const { impl, calls } = fakeFetch([{ status: 400, body: { error: { message: 'response_format is not supported' } } }, 'Sure! Here is the JSON: {"text":"Median ending net worth was fine."} Hope that helps.']);
    const client = makeOpenAiCompatibleClient({ baseUrl: env.AI_BASE_URL, apiKey: 'k', model: env.AI_MODEL, fetchImpl: impl });
    const r = await handleAiRequest(JSON.stringify({ kind: 'explain', summary: summary(), question: 'why' }), env, client);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ text: 'Median ending net worth was fine.' });
    expect(calls).toHaveLength(2);
    expect('response_format' in (calls[0]!.body as object)).toBe(true);
    expect('response_format' in (calls[1]!.body as object)).toBe(false);
  });
  it('refuses to start without AI_BASE_URL / AI_MODEL', async () => {
    const r = await handleAiRequest(JSON.stringify({ kind: 'opportunity', summary: summary() }), { AI_PROVIDER: 'openai_compatible', AI_API_KEY: 'k' });
    expect(r.body).toMatchObject({ code: 'disabled' });
  });
});

describe('AI gateway', () => {
  it('rejects malformed requests with 400 and never calls the model', async () => {
    const r = await handleAiRequest('{"kind":"scenario","input":{"freeText":"x","grossAnnualIncome":-5}}', { AI_API_KEY: 'k' }, fake({}));
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ code: 'invalid_request' });
    const r2 = await handleAiRequest('not json', { AI_API_KEY: 'k' });
    expect(r2.status).toBe(400);
  });
  it('returns disabled when no key / AI_ENABLED=false', async () => {
    const body = JSON.stringify({ kind: 'opportunity', summary: summary() });
    expect((await handleAiRequest(body, {})).body).toMatchObject({ code: 'disabled' });
    expect((await handleAiRequest(body, { AI_API_KEY: 'k', AI_ENABLED: 'false' }, fake({}))).body).toMatchObject({ code: 'disabled' });
  });
  it('schema-invalid model output → schema_mismatch (no crash), and client falls back', async () => {
    const body = JSON.stringify({ kind: 'opportunity', summary: summary() });
    const r = await handleAiRequest(body, { AI_API_KEY: 'k' }, fake({ proposal: { title: 'x', options: [{ label: 'y', effect: { template: 'set_cash', amount: 1e9 } }] } }));
    expect(r.status).toBe(502);
    expect(r.body).toMatchObject({ code: 'schema_mismatch' });
    const fetchImpl = (async () => new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
    const client = await proposeOpportunity(summary(), { fetchImpl });
    expect(client.source).toBe('fallback');
    expect(client.warnings.length).toBeGreaterThan(0);
  });
  it('refusal stop reason → upstream_error', async () => {
    const body = JSON.stringify({ kind: 'explain', summary: summary(), question: 'why' });
    const r = await handleAiRequest(body, { AI_API_KEY: 'k' }, fake({ text: 'hi' }, 'refusal'));
    expect(r.body).toMatchObject({ code: 'upstream_error' });
  });
  it('valid model output passes through as source:ai and engine still validates effects', async () => {
    const proposal = {
      title: 'Side gig', body: 'A weekend gig adds income.', buildingTarget: 'office', learningNote: 'Income vs time.', expiresInMonths: 2,
      options: [
        { label: 'Take it', description: '', effect: { template: 'offer_job', grossAnnualSalary: 60000, title: 'Analyst + gig' } },
        { label: 'No', description: '', effect: { template: 'none' } },
      ],
    };
    const r = await handleAiRequest(JSON.stringify({ kind: 'opportunity', summary: summary() }), { AI_API_KEY: 'k' }, fake({ proposal }));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ kind: 'opportunity', source: 'ai' });
    const ev = proposalToEvent(proposal as never, fixtureState, 'ai')!;
    const applied = applyAction(fixtureState, { type: 'enqueue_event', event: ev });
    expect(applied.ok).toBe(true);
    // An AI proposal with an out-of-bounds effect is rejected by the engine even if it slipped through.
    const bad = { ...ev, id: 'bad', options: [{ id: 'o', label: 'x', description: '', effect: { template: 'loan_choice', principal: 5_000_000, apr: 0.1, termMonths: 12, name: 'huge' } as const }] };
    expect(applyAction(fixtureState, { type: 'enqueue_event', event: bad }).ok).toBe(false);
  });
  it('offline scenario mapping produces a valid, playable config and does not store free text', async () => {
    const res = await generateScenario({ freeText: 'I am a student with a credit card and rent of 700', monthlyRent: 700, debtBalance: 3000, debtApr: 0.25 }, { offline: true });
    expect(res.source).toBe('fallback');
    expect(res.proposal.baseArchetype).toBe('college_student');
    const cfg = scenarioToConfig(res.proposal, 1, 'fallback');
    expect(cfg.initialState.household.housingMonthly).toBe(700);
    expect(cfg.initialState.debts[0]?.apr).toBe(0.25);
    expect(JSON.stringify(cfg)).not.toContain('credit card and rent');
    expect(createGame(cfg).status).toBe('setup');
  });
});

describe('gateway error privacy', () => {
  it('does not return arbitrary exception messages or provider error bodies to the browser', async () => {
    const { UpstreamError } = await import('../../api/_lib/openaiCompatible');
    const body = JSON.stringify({ kind: 'explain', summary: summary(), question: 'why' });
    for (const error of [new Error('private prompt and api-key=secret'), new UpstreamError(500, 'private prompt and api-key=secret')]) {
      const client: ModelClient = { async parse() { throw error; } };
      const response = await handleAiRequest(body, { AI_API_KEY: 'secret' }, client);
      expect(response.status).toBe(502);
      expect(response.body).toMatchObject({ code: 'upstream_error' });
      expect(JSON.stringify(response.body)).not.toMatch(/secret|private prompt/);
    }
  });
});

describe('prompts and schema for the reveal + director', () => {
  const capture = (output: unknown) => {
    const seen: { system: string; user: string }[] = [];
    const client: ModelClient = {
      async parse({ system, user, schema }) {
        seen.push({ system, user });
        const r = schema.safeParse(output);
        return { parsed: r.success ? r.data : null, stopReason: 'end_turn' };
      },
    };
    return { client, seen };
  };
  const mc = { median: 1200, p10: -8400, p90: 2000, probabilityNegativeNetWorth: 0.54, probabilityLiquidityShortfall: 0.06, observedNetWorth: -171, percentileOfObserved: 0.41 };

  it('explain: system prompt frames the straight-line endings, asks for general levers with trade-offs, caps length; user prompt carries the formatted numbers', async () => {
    const { client, seen } = capture({ text: 'ok' });
    const r = await handleAiRequest(JSON.stringify({ kind: 'explain', summary: summary(), question: 'Was my rent too high?', monteCarlo: mc }), { AI_API_KEY: 'k' }, client);
    expect(r.status).toBe(200);
    const { system, user } = seen[0]!;
    expect(system).toMatch(/straight lines/);
    expect(system).toMatch(/unlucky/i);
    expect(system).toMatch(/typical/i);
    expect(system).toMatch(/lucky/i);
    expect(system).toMatch(/NOT a grade/);
    expect(system).toMatch(/110 words/);
    expect(system).toMatch(/never "you should"/i);
    expect(system).toMatch(/trade-off/);
    expect(system).toMatch(/higher bond share usually narrows the spread/);
    expect(system).toMatch(/3–6 months/);
    expect(system).toMatch(/highest-rate debt first/);
    expect(system).toMatch(/what-if panel/);
    expect(system).toMatch(/Never open with "I can't say"/);
    expect(system).toMatch(/at most 8 words/);
    expect(system).toMatch(/guarantee/i);
    expect(system).toMatch(/Plain English/i);
    expect(system).toMatch(/illustrative demo assumptions/);
    expect(user).toContain('Player question: Was my rent too high?');
    expect(user).toContain('Unlucky ending (10th percentile): -$8,400');
    expect(user).toContain('Typical ending (median): $1,200');
    expect(user).toContain('Lucky ending (90th percentile): $2,000');
    expect(user).toContain("Player's actual ending: -$171 (above about 41% of replays; not a grade)");
    expect(user).toContain('negative net worth: 54%');
    expect(user).toContain('emergency borrowing at some point: 6%');
    expect(user).toContain('"monthsOfEssentialsCovered"');
  });

  it('explain without Monte Carlo (mid-game insight) says so instead of inventing endings', async () => {
    const { client, seen } = capture({ text: 'ok' });
    await handleAiRequest(JSON.stringify({ kind: 'explain', summary: summary(), question: 'why' }), { AI_API_KEY: 'k' }, client);
    expect(seen[0]!.user).toMatch(/No Monte Carlo results/);
    expect(seen[0]!.user).not.toMatch(/Unlucky ending/);
  });

  it('opportunity: system prompt demands concrete, varied, focus-tied proposals with a decline option; user prompt names the month and focus', async () => {
    const { client, seen } = capture({ proposal: null });
    const r = await handleAiRequest(JSON.stringify({ kind: 'opportunity', summary: summary() }), { AI_API_KEY: 'k' }, client);
    expect(r.body).toMatchObject({ kind: 'opportunity', proposal: null });
    const { system, user } = seen[0]!;
    expect(system).toMatch(/Be concrete/);
    expect(system).toMatch(/Vary across months/);
    expect(system).toMatch(/narrativeFocus/);
    expect(system).toMatch(/exactly one option whose effect is \{"template":"none"\}/);
    expect(system).toMatch(/health_basic \(\$180\/mo/);
    expect(user).toMatch(/^Month 6 \(/);
    expect(user).toMatch(/archetype entry_worker/);
    expect(user).toMatch(/focus: taxes, insurance, investing_basics, debt_payoff/);
  });

  it('schema accepts the richer proposal shapes (3 options, loan / contribution / housing effects, decline last)', async () => {
    const { OpportunityProposalSchema, OpportunityOutputSchema } = await import('../../api/_lib/schemas');
    const proposals = [
      { title: 'Laptop financing offer', body: 'b', buildingTarget: 'bank', learningNote: 'n', expiresInMonths: 1, options: [
        { label: '24 months at 9%', description: '', effect: { template: 'loan_choice', principal: 2500, apr: 0.09, termMonths: 24, name: 'Laptop financing' } },
        { label: '12 months at 18%', description: '', effect: { template: 'loan_choice', principal: 2500, apr: 0.18, termMonths: 12, name: 'Store card plan' } },
        { label: 'Decline', description: 'No new borrowing.', effect: { template: 'none' } } ] },
      { title: 'Rebalance', body: 'b', buildingTarget: 'market', learningNote: 'n', expiresInMonths: 2, options: [
        { label: 'Split evenly', description: '', effect: { template: 'contribution_choice', savingsContributionPerMonth: 250, investmentContributionPerMonth: 250 } },
        { label: 'Tilt to growth', description: '', effect: { template: 'contribution_choice', savingsContributionPerMonth: 150, investmentContributionPerMonth: 350 } },
        { label: 'Keep current split', description: '', effect: { template: 'none' } } ] },
      { title: 'Lease renewal', body: 'b', buildingTarget: 'home', learningNote: 'n', expiresInMonths: 2, options: [
        { label: 'Renew', description: '', effect: { template: 'change_housing', housingMonthly: 1430, housingKind: 'rent' } },
        { label: 'Move', description: '', effect: { template: 'change_housing', housingMonthly: 1190, housingKind: 'rent' } },
        { label: 'Stay month-to-month', description: '', effect: { template: 'none' } } ] },
      { title: 'Full coverage quote', body: 'b', buildingTarget: 'hospital', learningNote: 'n', expiresInMonths: 2, options: [
        { label: 'Upgrade', description: '', effect: { template: 'change_insurance', line: 'auto', planId: 'auto_full' } },
        { label: 'Drop auto cover', description: '', effect: { template: 'change_insurance', line: 'auto', planId: null } },
        { label: 'Keep liability only', description: '', effect: { template: 'none' } } ] },
    ];
    for (const p of proposals) {
      expect(OpportunityProposalSchema.safeParse(p).success, p.title).toBe(true);
      expect(OpportunityOutputSchema.safeParse({ proposal: p }).success, p.title).toBe(true);
      const ev = proposalToEvent(p as never, fixtureState, 'ai');
      expect(ev, p.title).not.toBeNull();
      expect(applyAction(fixtureState, { type: 'enqueue_event', event: ev! }).ok, p.title).toBe(true);
    }
    expect(OpportunityOutputSchema.safeParse({ proposal: null }).success).toBe(true);
    // Four options or an unknown template are still rejected.
    const four = { ...proposals[0]!, options: [...proposals[0]!.options, { label: 'x', description: '', effect: { template: 'none' } }] };
    expect(OpportunityProposalSchema.safeParse(four).success).toBe(false);
    expect(OpportunityProposalSchema.safeParse({ ...proposals[0]!, options: [{ label: 'x', description: '', effect: { template: 'grant_cash', amount: 5 } }] }).success).toBe(false);
  });

  it('explain output longer than the schema cap is a schema_mismatch, so the client falls back to the template', async () => {
    const { client } = capture({ text: 'x'.repeat(1300) });
    const r = await handleAiRequest(JSON.stringify({ kind: 'explain', summary: summary(), question: 'why', monteCarlo: mc }), { AI_API_KEY: 'k' }, client);
    expect(r.body).toMatchObject({ code: 'schema_mismatch' });
  });
});

describe('provider defaults from bare keys', async () => {
  const { resolveEnv, GEMINI_DEFAULTS, LUMINAL_DEFAULTS } = await import('../../api/_lib/handler');
  const { chatCompletionsUrl } = await import('../../api/_lib/openaiCompatible');
  it('GEMINI_API_KEY alone selects the Gemini OpenAI-compatible defaults and wins over LUMINAL_API_KEY', () => {
    const env = resolveEnv({ GEMINI_API_KEY: 'g', LUMINAL_API_KEY: 'l' });
    expect(env).toMatchObject({ ...GEMINI_DEFAULTS, AI_API_KEY: 'g' });
  });
  it('a Luminal key beside the Gemini key makes Luminal the fallback for quota, outage and timeout errors only', async () => {
    const { withFallback } = await import('../../api/_lib/handler');
    const { UpstreamError } = await import('../../api/_lib/openaiCompatible');
    const calls: string[] = [];
    const failing = (status: number): ModelClient => ({ async parse() { calls.push(`primary:${status}`); throw new UpstreamError(status, 'nope'); } });
    const luminal: ModelClient = { async parse({ schema }) { calls.push('luminal'); const r = schema.safeParse({ text: 'from luminal' }); return { parsed: r.success ? r.data : null, stopReason: 'stop' }; } };
    const schema = (await import('zod')).z.object({ text: (await import('zod')).z.string() });
    for (const status of [429, 503, 504, 404]) {
      const r = await withFallback(failing(status), luminal).parse({ system: '', user: '', schema, maxTokens: 10 });
      expect(r.parsed).toEqual({ text: 'from luminal' });
    }
    await expect(withFallback(failing(401), luminal).parse({ system: '', user: '', schema, maxTokens: 10 })).rejects.toBeInstanceOf(UpstreamError);
    expect(calls.filter((c) => c === 'luminal')).toHaveLength(4);
  });
  it('LUMINAL_API_KEY alone selects the Luminal defaults; explicit AI_* still wins', () => {
    expect(resolveEnv({ LUMINAL_API_KEY: 'l' })).toMatchObject({ ...LUMINAL_DEFAULTS, AI_API_KEY: 'l' });
    expect(resolveEnv({ GEMINI_API_KEY: 'g', AI_MODEL: 'gemini-2.5-pro' }).AI_MODEL).toBe('gemini-2.5-pro');
    expect(resolveEnv({ AI_API_KEY: 'k', GEMINI_API_KEY: 'g' })).toMatchObject({ ...GEMINI_DEFAULTS, AI_API_KEY: 'g' });
    // Stale Luminal settings left on the host must not hijack a Gemini key.
    expect(resolveEnv({ GEMINI_API_KEY: 'g', AI_PROVIDER: 'openai_compatible', AI_BASE_URL: 'https://flash.luminal.cloud', AI_MODEL: 'deepseek-ai/DeepSeek-V4.1-Flash', AI_AUTH_HEADER: 'api-key' })).toMatchObject({ ...GEMINI_DEFAULTS, AI_API_KEY: 'g', AI_AUTH_HEADER: 'bearer' });
    expect(resolveEnv({ AI_API_KEY: 'k', AI_PROVIDER: 'openai_compatible', AI_BASE_URL: 'https://x.test', AI_MODEL: 'm' })).toMatchObject({ AI_API_KEY: 'k', AI_MODEL: 'm' });
  });
  it('builds the chat completions URL for origins, /v1 bases and full prefixes like Gemini', () => {
    expect(chatCompletionsUrl('https://flash.luminal.cloud')).toBe('https://flash.luminal.cloud/v1/chat/completions');
    expect(chatCompletionsUrl('https://flash.luminal.cloud/v1/')).toBe('https://flash.luminal.cloud/v1/chat/completions');
    expect(chatCompletionsUrl(GEMINI_DEFAULTS.AI_BASE_URL)).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(chatCompletionsUrl('https://x.test/v1/chat/completions')).toBe('https://x.test/v1/chat/completions');
  });
});
