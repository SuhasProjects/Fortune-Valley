import { describe, expect, it } from 'vitest';
import { handleAiRequest, type ModelClient } from '../../api/_lib/handler';
import { fixtureState, fixtureConfig } from '@/fixtures';
import { summarizeForAi } from '@/engine';
import { generateScenario, proposeOpportunity, proposalToEvent, scenarioToConfig } from '@/services/aiClient';
import { createGame, applyAction } from '@/engine';

const fake = (output: unknown, stopReason = 'end_turn'): ModelClient => ({
  async parse({ schema }) {
    const r = schema.safeParse(output);
    return { parsed: r.success ? r.data : null, stopReason };
  },
});
const summary = () => summarizeForAi(fixtureState, fixtureConfig.narrativeFocus, 'entry_worker');

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
