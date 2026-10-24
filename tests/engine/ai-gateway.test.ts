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

  it('explain: system prompt frames the straight-line endings, forbids advice, caps length; user prompt carries the formatted numbers', async () => {
    const { client, seen } = capture({ text: 'ok' });
    const r = await handleAiRequest(JSON.stringify({ kind: 'explain', summary: summary(), question: 'Was my rent too high?', monteCarlo: mc }), { AI_API_KEY: 'k' }, client);
    expect(r.status).toBe(200);
    const { system, user } = seen[0]!;
    expect(system).toMatch(/straight lines/);
    expect(system).toMatch(/unlucky/i);
    expect(system).toMatch(/typical/i);
    expect(system).toMatch(/lucky/i);
    expect(system).toMatch(/NOT a grade/);
    expect(system).toMatch(/120 words/);
    expect(system).toMatch(/No advice/i);
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
