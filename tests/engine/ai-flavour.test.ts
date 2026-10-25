import { describe, expect, it } from 'vitest';
import { handleAiRequest, type HandlerResult, type ModelClient } from '../../api/_lib/handler';
import { requestSchema, responseSchema, system, user } from '../../api/_lib/kinds/flavour';
import { describeShock } from '@/services/aiClient';
import { fallbackFlavour } from '@/services/aiFallback';
import { FLAVOUR_TABLE, pickFlavour } from '@/services/flavourTable';
import type { ShockFlavourInput, ShockKind } from '@/types/domain';

const fake = (output: unknown, stopReason = 'end_turn'): ModelClient => ({
  async parse({ schema }) {
    const r = schema.safeParse(output);
    return { parsed: r.success ? r.data : null, stopReason };
  },
});
const replay = (r: HandlerResult): typeof fetch => (async () => new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
const env = { AI_API_KEY: 'k' };
const shock: ShockFlavourInput = { kind: 'auto', amount: 1800, monthLabel: '2026-11', archetype: 'entry_worker', housingKind: 'rent', hasCar: true, employment: 'employed' };
const body = (s: ShockFlavourInput = shock) => JSON.stringify({ kind: 'flavour', shock: s });
const KINDS: Exclude<ShockKind, 'life'>[] = ['medical', 'auto', 'home', 'job_loss'];

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const sentences = (s: string) => s.split(/(?<=[.?])\s+/).filter((x) => x.trim().length > 0);
/** News-wire style lint shared by the table and the live prompt's own limits. */
const lintScene = (scene: string, headline: string) => {
  expect(scene).not.toContain('!');
  expect(headline).not.toContain('!');
  expect(words(scene)).toBeLessThanOrEqual(32);
  expect(sentences(scene).length).toBeLessThanOrEqual(2);
  expect(words(headline)).toBeGreaterThanOrEqual(2);
  expect(words(headline)).toBeLessThanOrEqual(5);
  expect(scene).toMatch(/\b(you|your)\b/i); // it happened to the player, so the scene says so
  expect(scene).toMatch(/[.?]$/);
};

describe('flavour kind: gateway', () => {
  it('returns headline + scene with source:ai and the request validated', async () => {
    const r = await handleAiRequest(body(), env, fake({ headline: 'Limb hits windshield', scene: 'A tree limb came down on the car overnight. The windshield repair cost $1,800.' }));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ kind: 'flavour', source: 'ai', headline: 'Limb hits windshield', warnings: [] });
    const res = await describeShock(shock, 'N_1', { fetchImpl: replay(r) });
    expect(res.source).toBe('ai');
    expect(res.scene).toContain('$1,800');
  });

  it('rejects malformed shocks and over-long output', async () => {
    expect((await handleAiRequest(JSON.stringify({ kind: 'flavour', shock: { ...shock, kind: 'flood' } }), env, fake({}))).status).toBe(400);
    expect((await handleAiRequest(JSON.stringify({ kind: 'flavour', shock: { ...shock, amount: -5 } }), env, fake({}))).status).toBe(400);
    const long = await handleAiRequest(body(), env, fake({ headline: 'x'.repeat(61), scene: 'ok.' }));
    expect(long.body).toMatchObject({ code: 'schema_mismatch' });
    const refused = await handleAiRequest(body(), env, fake({ headline: 'a b c', scene: 'x.' }, 'refusal'));
    expect(refused.body).toMatchObject({ code: 'upstream_error' });
    expect(requestSchema.safeParse({ kind: 'flavour', shock }).success).toBe(true);
    expect(responseSchema.safeParse({ headline: 'Water heater quits', scene: 'It quit.' }).success).toBe(true);
  });

  it('browser client falls back to the table on any gateway error, keeping the amount', async () => {
    const r = await handleAiRequest(body(), {}, undefined);
    expect(r.status).toBe(503);
    const res = await describeShock(shock, 'N_7', { fetchImpl: replay(r) });
    expect(res.source).toBe('fallback');
    expect(res.scene).toContain('$1,800');
    expect(res.warnings.length).toBeGreaterThan(0);
    const offline = await describeShock(shock, 'N_7', { offline: true });
    expect(offline).toMatchObject({ source: 'fallback', headline: res.headline, scene: res.scene });
  });

  it('accepts life events with a signed amount (gift > 0, cost < 0), prompts gift vs cost, and falls back to the life table', async () => {
    const gift: ShockFlavourInput = { ...shock, kind: 'life', amount: 120, hasCar: false };
    const cost: ShockFlavourInput = { ...shock, kind: 'life', amount: -45, archetype: 'college_student' };
    expect(requestSchema.safeParse({ kind: 'flavour', shock: gift }).success).toBe(true);
    expect(requestSchema.safeParse({ kind: 'flavour', shock: cost }).success).toBe(true);
    expect(requestSchema.safeParse({ kind: 'flavour', shock: { ...shock, amount: -45 } }).success).toBe(false); // insured shocks stay non-negative
    expect(user({ kind: 'flavour', shock: gift })).toMatch(/Life event: gift[^\n]*\nAmount: \$120/);
    expect(user({ kind: 'flavour', shock: cost })).toMatch(/Life event: cost[^\n]*\nAmount: \$45/);
    expect(user({ kind: 'flavour', shock: cost })).not.toContain('-$');
    expect(system).toMatch(/life event/i);
    const r = await handleAiRequest(body(gift), env, fake({ headline: 'Grandfather sends a cheque', scene: 'Your grandfather mailed a birthday card with a cheque inside. You deposited the $120 on Monday.' }));
    expect(r.status).toBe(200);
    const res = await describeShock(gift, 'N_g', { fetchImpl: replay(r) });
    expect(res).toMatchObject({ source: 'ai', headline: 'Grandfather sends a cheque' });
    const offline = await describeShock(cost, 'N_c', { offline: true });
    expect(offline.source).toBe('fallback');
    expect(offline.scene).toContain('$45');
    expect(offline.scene).toMatch(/\b(you|your)\b/i);
    lintScene(offline.scene, offline.headline);
  });

  it('prompt quotes the amount once as given and asks for no amount on job loss', () => {
    expect(user({ kind: 'flavour', shock })).toContain('Amount: $1,800');
    expect(user({ kind: 'flavour', shock: { ...shock, kind: 'job_loss', amount: 0 } })).toContain('Amount: none');
    expect(system).toMatch(/no exclamation marks/);
    expect(system).toMatch(/32 words/);
  });
});

describe('flavour fallback table', () => {
  it('covers every shock kind with 2–3 news-style scenes that pass the style lint', () => {
    for (const kind of KINDS) {
      const rows = FLAVOUR_TABLE[kind];
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows.length).toBeLessThanOrEqual(3);
      for (const row of rows) {
        const scene = row.scene.replace('{amount}', '$4,200');
        lintScene(scene, row.headline);
        if (kind === 'job_loss') expect(row.scene).not.toContain('{amount}');
        else expect(row.scene).toContain('{amount}');
      }
    }
  });

  it('is deterministic by seed, substitutes the engine amount and never invents one', () => {
    const input: ShockFlavourInput = { ...shock, kind: 'medical', amount: 4200 };
    const a = pickFlavour(input, 'N_abc_3_1');
    expect(pickFlavour(input, 'N_abc_3_1')).toEqual(a);
    expect(a.scene).toContain('$4,200');
    expect(a.scene.match(/\$[\d,]+/g)).toHaveLength(1);
    expect(fallbackFlavour(input, 'N_abc_3_1')).toEqual(a);
    const picks = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((s) => pickFlavour(input, s).headline));
    expect(picks.size).toBeGreaterThan(1);
    const job = pickFlavour({ ...input, kind: 'job_loss', amount: 0 }, 'x');
    expect(job.scene).not.toContain('$');
  });
});
