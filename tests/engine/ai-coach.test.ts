import { describe, expect, it } from 'vitest';
import { handleAiRequest, type ModelClient } from '../../api/_lib/handler';
import { makeOpenAiCompatibleClient } from '../../api/_lib/openaiCompatible';
import * as coach from '../../api/_lib/kinds/coach';
import { AiRequestSchema } from '../../api/_lib/schemas';
import { fixtureConfig, fixtureState } from '@/fixtures';
import { summarizeForAi } from '@/engine';
import { askCoach } from '@/services/aiClient';
import { classifyCoachQuestion, fallbackCoach, type CoachTopic } from '@/services/coachFallback';
import type { CoachFacts, StateSummary } from '@/types/domain';

const summary = (): StateSummary => summarizeForAi(fixtureState, fixtureConfig.narrativeFocus, 'entry_worker');
const facts: CoachFacts = {
  savingsApy: 0.04,
  debts: [{ name: 'Credit card', kind: 'credit_card', balance: 2351, apr: 0.24, minimumPayment: 60 }, { name: 'Student loan', kind: 'student_loan', balance: 23000, apr: 0.06, minimumPayment: 240 }],
  insurance: [{ line: 'health', name: 'Basic Health (high deductible)', monthlyPremium: 180, deductible: 4000, coinsurance: 0.3 }],
};
const env = { AI_PROVIDER: 'openai_compatible', AI_BASE_URL: 'https://flash.example', AI_MODEL: 'test/model', AI_API_KEY: 'k' };
const body = (extra: Record<string, unknown> = {}) => JSON.stringify({ kind: 'coach', summary: summary(), question: 'Pay the card or save?', history: [], facts, ...extra });
const words = (t: string) => t.trim().split(/\s+/).length;
const replay = (status: number, b: unknown): typeof fetch => (async () => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;

describe('coach gateway', () => {
  it('validates the request, builds a user message with the question, rates and digest, and returns source:ai text', async () => {
    const seen: { system: string; user: string }[] = [];
    const client: ModelClient = { async parse({ system, user, schema }) { seen.push({ system, user }); return { parsed: schema.parse({ text: 'Your card charges 24%. Your savings earn 4%.' }), stopReason: 'stop' }; } };
    const r = await handleAiRequest(body({ openBuilding: 'bank', history: [{ role: 'user', text: 'hi' }, { role: 'coach', text: 'Hello.' }] }), env, client);
    expect(r).toEqual({ status: 200, body: { kind: 'coach', source: 'ai', text: 'Your card charges 24%. Your savings earn 4%.', warnings: [] } });
    expect(seen[0]!.system).toBe(coach.system);
    const u = seen[0]!.user;
    expect(u).toMatch(/^Player question: Pay the card or save\?/);
    expect(u).toContain('bank window open');
    expect(u).toContain('- Player: hi');
    expect(u).toContain('- Sage: Hello.');
    expect(u).toContain('"Credit card" (credit card): $2,351 at 24% APR');
    expect(u).toContain('savings earn 4% a year');
    expect(u).toContain('$180/mo premium, $4,000 deductible');
    expect(u).toContain('State summary (JSON):');
  });

  it('rejects over-long questions, too many turns, unknown buildings and bad facts with 400', async () => {
    const never: ModelClient = { async parse() { throw new Error('must not be called'); } };
    for (const bad of [
      { question: 'x'.repeat(301) },
      { question: '' },
      { history: Array.from({ length: 5 }, () => ({ role: 'user', text: 'q' })) },
      { openBuilding: 'castle' },
      { facts: { ...facts, savingsApy: 2 } },
      { facts: { ...facts, extra: 1 } },
    ]) {
      const r = await handleAiRequest(body(bad), env, never);
      expect(r, JSON.stringify(bad).slice(0, 60)).toMatchObject({ status: 400, body: { code: 'invalid_request' } });
    }
    expect(AiRequestSchema.safeParse(JSON.parse(body())).success).toBe(true);
    expect(AiRequestSchema.safeParse({ kind: 'coach', summary: summary(), question: 'ok' }).success).toBe(true); // history defaults to []
  });

  it('the system prompt carries the style rules: ELI5, ≤ 70 words, no "you should", answer first, no fragment pattern', () => {
    expect(coach.system).toMatch(/twelve/);
    expect(coach.system).toMatch(/At most 70 words/);
    expect(coach.system).toMatch(/Never say "you should"/);
    expect(coach.system).toMatch(/Answer the question in the first sentence/);
    expect(coach.system).toMatch(/can't decide/);
    expect(coach.system).toMatch(/two-word fragments/);
    expect(coach.system).toMatch(/Never invent rates/);
    expect(coach.system).toMatch(/You are the Sage/);
    expect(coach.system).toMatch(/At most ONE short exclamation/);
    expect(coach.system).toMatch(/more than two exclamation marks/);
    expect(coach.system).toMatch(/Never repeat a greeting/);
    expect(coach.responseSchema.safeParse({ text: 'x'.repeat(601) }).success).toBe(false);
  });

  it('over-long or invalid model output → 502 schema_mismatch, and the browser client falls back to the offline coach', async () => {
    const replies = ['{"text": "' + 'word '.repeat(200) + '"}', 'not json'];
    const impl = ((_: string, init: RequestInit) => {
      void init;
      return Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: replies.shift() }, finish_reason: 'stop' }] }), { status: 200 }));
    }) as unknown as typeof fetch;
    const r = await handleAiRequest(body(), env, makeOpenAiCompatibleClient({ baseUrl: env.AI_BASE_URL, apiKey: 'k', model: env.AI_MODEL, fetchImpl: impl }));
    expect(r).toMatchObject({ status: 502, body: { code: 'schema_mismatch' } });
    const res = await askCoach(summary(), 'Pay the card or save?', [], null, facts, { fetchImpl: replay(r.status, r.body) });
    expect(res).toMatchObject({ kind: 'coach', source: 'fallback' });
    expect(res.text).toContain('24%');
    expect(res.warnings[0]).toMatch(/offline/);
  });

  it('client trims the question to 300 chars and sends only the last 4 turns', async () => {
    let sent: Record<string, unknown> = {};
    const impl = (async (_: string, init: RequestInit) => { sent = JSON.parse(String(init.body)); return new Response(JSON.stringify({ kind: 'coach', source: 'ai', text: 'ok', warnings: [] }), { status: 200 }); }) as unknown as typeof fetch;
    const history = Array.from({ length: 7 }, (_, i) => ({ role: i % 2 ? 'coach' as const : 'user' as const, text: `t${i}` }));
    const res = await askCoach(summary(), 'q'.repeat(400), history, 'market', facts, { fetchImpl: impl });
    expect(res.source).toBe('ai');
    expect((sent.question as string).length).toBe(300);
    expect((sent.history as unknown[]).length).toBe(4);
    expect((sent.history as { text: string }[])[0]!.text).toBe('t3');
    expect(sent.openBuilding).toBe('market');
  });
});

describe('offline coach', () => {
  const QUESTIONS: Record<CoachTopic, string[]> = {
    save_vs_debt: ['Pay the card or save?', 'Should I pay down debt or save first', 'save or pay off my loan'],
    insurance: ['What does this insurance do?', 'Is the deductible worth it', 'do I need renters insurance'],
    allocation: ['Should I invest in stocks?', 'What is a good stock bond mix', 'is my portfolio too risky'],
    emergency_fund: ['How big should my emergency fund be', 'how much cash should I keep as a cushion', 'how many months of savings do I need'],
    budget: ['Is my rent too high', 'where can I cut spending', 'can I afford this'],
    job_loss: ['what if I lose my job', 'what happens when I am unemployed', 'I got laid off'],
    loans: ['what is APR', 'how does interest work', 'is a consolidation loan a good idea'],
    what_if: ['What happens if I save more?', 'what if I invest more each month', 'what would happen if I spend less'],
    general: ['hello', 'why is the sky blue', ''],
  };
  it('classifies the common questions by keyword, and the open building breaks ties', () => {
    for (const [topic, qs] of Object.entries(QUESTIONS) as [CoachTopic, string[]][]) for (const q of qs) expect(classifyCoachQuestion(q), q).toBe(topic);
    expect(classifyCoachQuestion('what about this?', 'hospital')).toBe('insurance');
    expect(classifyCoachQuestion('what about this?', 'market')).toBe('allocation');
    expect(classifyCoachQuestion('what about this?', 'bank')).toBe('emergency_fund');
    expect(classifyCoachQuestion('what about this?', 'home')).toBe('budget');
    expect(classifyCoachQuestion('what about this?', 'office')).toBe('job_loss');
  });

  it('every answer is ≤ 70 words, flowing sentences, no advice verbs, no guarantees, only the summary\'s own numbers', () => {
    const s = summary();
    for (const qs of Object.values(QUESTIONS)) for (const q of qs) {
      for (const f of [facts, undefined]) {
        const t = fallbackCoach(s, q, null, f);
        expect(words(t), `${q}: ${words(t)} words`).toBeLessThanOrEqual(70);
        expect(t).not.toMatch(/you should|I recommend|my advice|guarantee|will definitely|can't decide|cannot decide|It depends/i);
        expect(t).not.toMatch(/\b[A-Z][a-z]+ [a-z]+\. [A-Z][a-z]+ [a-z]+\./); // no "Card wins. Savings lose." fragments
        expect(t).not.toMatch(/NaN|\$-|undefined/);
        expect(t.split(/(?<=[.!?])\s+/).length).toBeGreaterThanOrEqual(3);
        expect((t.match(/!/g) ?? []).length, `${q}: exclamation marks`).toBeLessThanOrEqual(2); // the Sage is warm, not yappy
        expect(t).not.toMatch(/you've got this|welcome|hello/i);
      }
    }
  });

  it('save-vs-debt quotes the card APR and savings rate, cause → effect, with the player\'s cushion', () => {
    const t = fallbackCoach(summary(), 'Pay the card or save?', null, facts);
    expect(t).toMatch(/credit card charges 24%/);
    expect(t).toMatch(/savings earn 4%/);
    expect(t).toMatch(/\$100 .*saves about 2 dollars a month/);
    expect(t).toMatch(/earns about 0\.33/);
    expect(t).toMatch(/covers .* months? of essentials/);
  });

  it('insurance and job-loss answers use the plan and the months of cover from the summary', () => {
    const s = { ...summary(), insurance: { health: 'health_basic', auto: null, renters: null }, employmentStatus: 'unemployed' as const };
    expect(fallbackCoach(s, 'What does this insurance do?')).toMatch(/\$180 a month, .*\$4,000 deductible/);
    expect(fallbackCoach({ ...s, insurance: { health: null, auto: null, renters: null } }, 'What does this insurance do?')).toMatch(/no health plan/);
    expect(fallbackCoach(s, 'what if I lose my job')).toMatch(/With no pay coming in/);
    expect(fallbackCoach({ ...s, employmentStatus: 'employed' as const }, 'what if I lose my job')).toMatch(/If your pay stopped/);
    expect(fallbackCoach({ ...s, debtTotal: 0 }, 'Pay the card or save?', null, { ...facts, debts: [] })).toMatch(/no debt right now/);
  });
});
