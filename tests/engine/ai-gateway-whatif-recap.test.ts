import { describe, expect, it } from 'vitest';
import { handleAiRequest, type HandlerResult, type ModelClient } from '../../api/_lib/handler';
import { makeOpenAiCompatibleClient } from '../../api/_lib/openaiCompatible';
import * as whatif from '../../api/_lib/kinds/whatif';
import * as recap from '../../api/_lib/kinds/recap';
import { explainWhatIf, recapRun } from '@/services/aiClient';
import { summarizeTimeline } from '@/services/summarizeTimeline';
import { fixtureFinishedState } from '@/fixtures';

const fake = (output: unknown, stopReason = 'end_turn'): ModelClient => ({
  async parse({ schema }) { const r = schema.safeParse(output); return { parsed: r.success ? r.data : null, stopReason }; },
});
const replay = (r: HandlerResult): typeof fetch => (async () => new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
const env = { AI_API_KEY: 'k' };

const comparison = {
  decisionLabel: 'Save $300/month', alternativeLabel: 'Keep what you had before',
  original: { p10: -15000, median: -13000, p90: -10000, yourEvents: -12000 },
  changed: { p10: -14000, median: -11760, p90: -11000, yourEvents: -12310 },
  delta: { p10: 1000, median: 1240, p90: -1000, yourEvents: -310, spread: -2000 },
  startNetWorth: -14000, months: 24,
};
const whatifReq = JSON.stringify({ kind: 'whatif', comparison });
const recapReq = () => JSON.stringify({ kind: 'recap', recap: summarizeTimeline(fixtureFinishedState) });

describe('whatif kind', () => {
  it('validates the request and returns the one-sentence line', async () => {
    const r = await handleAiRequest(whatifReq, env, fake({ text: 'Saving more each month means less cash now but a fatter cushion when a shock hits.' }));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ kind: 'whatif', source: 'ai', warnings: [] });
    const res = await explainWhatIf(comparison, { fetchImpl: replay(r) });
    expect(res.source).toBe('ai');
    expect(res.text.split(/\s+/).length).toBeLessThanOrEqual(whatif.MAX_WORDS);
  });
  it('rejects long or multi-sentence output as schema_mismatch and the client falls back', async () => {
    const long = await handleAiRequest(whatifReq, env, fake({ text: Array.from({ length: 25 }, () => 'word').join(' ') + '.' }));
    expect(long.status).toBe(502); expect(long.body).toMatchObject({ code: 'schema_mismatch' });
    const two = await handleAiRequest(whatifReq, env, fake({ text: 'More saved. Less risk.' }));
    expect(two.status).toBe(502);
    const res = await explainWhatIf(comparison, { fetchImpl: replay(two) });
    expect(res.source).toBe('fallback');
    expect(res.text).toMatch(/hurt less/);
  });
  it('rejects malformed comparisons (400) and refusals (502 upstream_error)', async () => {
    const bad = await handleAiRequest(JSON.stringify({ kind: 'whatif', comparison: { ...comparison, months: 0 } }), env, fake({ text: 'x.' }));
    expect(bad.status).toBe(400);
    const refused = await handleAiRequest(whatifReq, env, fake({ text: 'x.' }, 'refusal'));
    expect(refused.body).toMatchObject({ code: 'upstream_error' });
  });
  it('user message names both labels and the direction of the typical ending', () => {
    const u = whatif.user(JSON.parse(whatifReq));
    expect(u).toContain('Save $300/month'); expect(u).toContain('Keep what you had before'); expect(u).toContain('better'); expect(u).toContain('narrower');
  });
  it('schema accepts up to 20 words and exactly one terminal period', () => {
    expect(whatif.responseSchema.safeParse({ text: 'A b c d e f g h i j k l m n o p q r s t.' }).success).toBe(true);
    expect(whatif.responseSchema.safeParse({ text: 'One. Two.' }).success).toBe(false);
  });
});

describe('recap kind', () => {
  const three = 'The run opened in January 2026 with the default plan. In July 2026 a job loss cut the paycheck for three months. It ended in December 2027 at $4,200, up from the start.';
  it('validates the condensed timeline and returns three sentences', async () => {
    const r = await handleAiRequest(recapReq(), env, fake({ text: three }));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ kind: 'recap', source: 'ai', text: three });
    const res = await recapRun(summarizeTimeline(fixtureFinishedState), { fetchImpl: replay(r) });
    expect(res.source).toBe('ai');
  });
  it('rejects exclamation marks, one-sentence and over-long output; client falls back to the template recap', async () => {
    for (const text of ['Great run! It ended well. Nice.', 'Only one sentence here.', Array.from({ length: 80 }, () => 'word').join(' ') + '. Two. Three.']) {
      const r = await handleAiRequest(recapReq(), env, fake({ text }));
      expect(r.status).toBe(502); expect(r.body).toMatchObject({ code: 'schema_mismatch' });
    }
    const res = await recapRun(summarizeTimeline(fixtureFinishedState), { fetchImpl: replay(await handleAiRequest(recapReq(), env, fake({ text: 'x!' }))) });
    expect(res.source).toBe('fallback');
    expect((res.text.match(/\.(\s|$)/g) ?? []).length).toBe(3);
  });
  it('caps the timeline at 25 lines (400 beyond)', async () => {
    const r = summarizeTimeline(fixtureFinishedState);
    const line = { month: 0, label: '2026-01', event: 'Set x' };
    const bad = await handleAiRequest(JSON.stringify({ kind: 'recap', recap: { ...r, timeline: Array.from({ length: recap.MAX_TIMELINE_LINES + 1 }, () => line) } }), env, fake({ text: three }));
    expect(bad.status).toBe(400);
  });
  it('user message lists every timeline line with its month label and amount', () => {
    const r = summarizeTimeline(fixtureFinishedState);
    const u = recap.user({ kind: 'recap', recap: r });
    for (const t of r.timeline) expect(u).toContain(`(${t.label}): ${t.event}`);
    expect(u).toContain(`Run length: ${r.months} months`);
  });
  it('OpenAI-compatible provider: an invalid first reply gets one corrective retry', async () => {
    const replies = [JSON.stringify({ text: 'Too short.' }), JSON.stringify({ text: three })];
    let calls = 0;
    const impl = (async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: replies.shift() }, finish_reason: 'stop' }] }), { status: 200 }); }) as unknown as typeof fetch;
    const client = makeOpenAiCompatibleClient({ baseUrl: 'https://x.example', apiKey: 'k', model: 'm', fetchImpl: impl });
    const r = await handleAiRequest(recapReq(), env, client);
    expect(calls).toBe(2); expect(r.status).toBe(200);
  });
});
