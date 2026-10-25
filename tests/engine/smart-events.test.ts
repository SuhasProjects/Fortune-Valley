/**
 * Smart life events: a per-run household profile (birthday, pet, relatives, hobby, commute), life-event
 * templates with eligibility and cadence rules (annual / once / cooldown), shock variants without
 * immediate repeats, offline scenes drawn without replacement and species-consistent, and the
 * `flavour` request carrying the profile + template + previous headlines (mocked fetch, no live AI).
 */
import { describe, expect, it } from 'vitest';
import { handleAiRequest, type HandlerResult, type ModelClient } from '../../api/_lib/handler';
import { requestSchema, user } from '../../api/_lib/kinds/flavour';
import { archetypeConfig } from '@/config/archetypes';
import { DEFAULT_LIFE_EVENTS } from '@/config/defaults';
import { advanceMonth, createGame, parseSave, runMonteCarlo, serializeSave } from '@/engine';
import { SHOCK_VARIANTS, chooseShockVariant, lifeEventNet } from '@/engine/events';
import { deriveHouseholdProfile, drawPet } from '@/engine/household';
import { LIFE_EVENT_TEMPLATES, LIFE_TEMPLATE_BY_ID, calendarMonth, eligibilityContext, fitsHousehold, lifeEventLabel, monthsSinceLast } from '@/engine/lifeEvents';
import { describeShock } from '@/services/aiClient';
import { LIFE_SCENES, pickFlavour } from '@/services/flavourTable';
import { lifeLine, summarizeTimeline } from '@/services/summarizeTimeline';
import { flavourInput } from '@/stores/useGameStore';
import type { ArchetypeId, GameConfig, GameState, HouseholdProfile, ShockFlavourInput } from '@/types/domain';

const ARCHETYPES: ArchetypeId[] = ['college_student', 'entry_worker', 'professional', 'young_family'];
const config = (a: ArchetypeId, seed: number, months = 24): GameConfig => archetypeConfig(a, seed, { durationMonths: months });
const play = (c: GameConfig): GameState => {
  let s = createGame(c);
  while (s.status !== 'finished') s = advanceMonth(s);
  return s;
};
const words = (x: string) => x.trim().split(/\s+/).filter(Boolean).length;

describe('household profile', () => {
  it('is derived deterministically from seed + archetype, names-free, with kids/car/commute from the config', () => {
    for (const a of ARCHETYPES) {
      const p1 = deriveHouseholdProfile(config(a, 11));
      const p2 = deriveHouseholdProfile(config(a, 11));
      expect(p2).toEqual(p1);
      expect(p1.birthMonth).toBeGreaterThanOrEqual(1);
      expect(p1.birthMonth).toBeLessThanOrEqual(12);
      expect(['none', 'cat', 'dog']).toContain(p1.pet);
      expect(p1.hasKids).toBe(a === 'young_family');
      expect(p1.commute).toBe(a === 'college_student' ? p1.commute : 'car'); // workers and families own a car
      if (a === 'college_student') expect(['transit', 'bike']).toContain(p1.commute);
      expect(p1.circle.length).toBeGreaterThanOrEqual(1);
      expect(p1.circle.length).toBeLessThanOrEqual(2);
      expect(p1.archetype).toBe(a);
      expect(JSON.stringify(p1)).not.toMatch(/[A-Z][a-z]+ [A-Z]/); // no proper names
      if (a === 'young_family') expect(p1.circle[1]).toBe('partner');
    }
    expect(deriveHouseholdProfile(config('entry_worker', 1))).not.toEqual(deriveHouseholdProfile(config('entry_worker', 2)));
    expect(createGame(config('professional', 5)).householdProfile).toEqual(deriveHouseholdProfile(config('professional', 5)));
  });

  it('pet odds: students mostly have none; others ~40/30/30', () => {
    const tally = (a: ArchetypeId) => {
      const n = { none: 0, cat: 0, dog: 0 };
      for (let i = 0; i < 1000; i++) n[drawPet((i + 0.5) / 1000, a)] += 1;
      return n;
    };
    const st = tally('college_student');
    expect(st.none / 1000).toBeCloseTo(0.85, 1);
    const w = tally('entry_worker');
    expect(w.none / 1000).toBeCloseTo(0.4, 1);
    expect(w.cat / 1000).toBeCloseTo(0.3, 1);
    expect(w.dog / 1000).toBeCloseTo(0.3, 1);
  });

  it('old saves without a profile load and get one derived from the config', () => {
    const s = play(config('entry_worker', 8, 6));
    const raw = JSON.parse(serializeSave(config('entry_worker', 8, 6), s));
    delete raw.state.householdProfile;
    for (const e of raw.state.lifeEvents) delete e.templateId;
    const parsed = parseSave(JSON.stringify(raw));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.save.state.householdProfile).toEqual(s.householdProfile);
    raw.state.householdProfile = { birthMonth: 13 };
    expect(parseSave(JSON.stringify(raw)).ok).toBe(false);
  });
});

describe('life-event templates: eligibility and cadence', () => {
  it('a college student never gets pet, kid, car or employer templates; vet visits need a pet; parking needs a car', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = play(config('college_student', seed));
      const ids = new Set(s.lifeEvents.map((e) => e.templateId));
      for (const banned of ['kid_cost', 'childcare_rebate', 'parking_ticket', 'expense_claim']) expect(ids.has(banned)).toBe(false);
      if (s.householdProfile.pet === 'none') expect(ids.has('vet_visit')).toBe(false); // most students: no pet, no vet
      expect(s.lifeEvents.every((e) => e.templateId && LIFE_TEMPLATE_BY_ID.has(e.templateId))).toBe(true);
    }
    for (const a of ['entry_worker', 'professional', 'young_family'] as const) {
      for (let seed = 1; seed <= 30; seed++) {
        const s = play(config(a, seed));
        const ids = s.lifeEvents.map((e) => e.templateId);
        if (s.householdProfile.pet === 'none') expect(ids).not.toContain('vet_visit');
        if (!s.householdProfile.hasKids) { expect(ids).not.toContain('kid_cost'); expect(ids).not.toContain('childcare_rebate'); }
        expect(ids).not.toContain('commute_cost'); // these lives own a car
        expect(ids).not.toContain('student_cost');
        expect(ids).not.toContain('bursary_topup');
      }
    }
    const student: HouseholdProfile = { archetype: 'college_student', birthMonth: 3, pet: 'none', hobby: 'music', hasKids: false, commute: 'bike', circle: ['aunt'] };
    const fits = LIFE_EVENT_TEMPLATES.filter((t) => fitsHousehold(t, { profile: student, hasCar: false })).map((t) => t.id);
    expect(fits).toEqual(expect.arrayContaining(['birthday_gift', 'back_to_school', 'student_cost', 'commute_cost', 'small_cost', 'small_gift']));
    expect(fits).not.toContain('relative_help'); // no peer in a one-person circle
    expect(fits).not.toContain('vet_visit');
    expect(fits).not.toContain('back_to_school'.replace('back_to_school', 'kid_cost'));
  });

  it('annual templates fire at most once per 12 months and only in their month (birthday, December, March/April, August)', () => {
    let birthdays = 0;
    let holidays = 0;
    let taxes = 0;
    let school = 0;
    for (const a of ARCHETYPES) {
      for (let seed = 1; seed <= 25; seed++) {
        const c = config(a, seed, 36);
        const s = play(c);
        const annuals = ['birthday_gift', 'holiday_gift', 'tax_refund', 'back_to_school'];
        for (const id of annuals) {
          const months = s.lifeEvents.filter((e) => e.templateId === id).map((e) => e.monthIndex);
          for (let i = 1; i < months.length; i++) expect(months[i]! - months[i - 1]!).toBeGreaterThanOrEqual(12);
          for (const m of months) {
            const cal = calendarMonth(c.startMonth, m);
            if (id === 'birthday_gift') { expect(cal).toBe(s.householdProfile.birthMonth); birthdays += 1; }
            if (id === 'holiday_gift') { expect(cal).toBe(12); holidays += 1; }
            if (id === 'tax_refund') { expect([3, 4]).toContain(cal); taxes += 1; }
            if (id === 'back_to_school') { expect(cal).toBe(8); expect(a === 'college_student' || a === 'young_family').toBe(true); school += 1; }
          }
        }
      }
    }
    expect(birthdays).toBeGreaterThan(20);
    expect(holidays).toBeGreaterThan(20);
    expect(taxes).toBeGreaterThan(20);
    expect(school).toBeGreaterThan(5);
  });

  it('once templates fire at most once per run; cooldown templates keep their spacing (vet ≥ 6, parking ≥ 4)', () => {
    let vets = 0;
    let parking = 0;
    for (const a of ARCHETYPES) {
      for (let seed = 1; seed <= 25; seed++) {
        const s = play(config(a, seed, 36));
        for (const t of LIFE_EVENT_TEMPLATES) {
          const months = s.lifeEvents.filter((e) => e.templateId === t.id).map((e) => e.monthIndex);
          if (t.cadence.kind === 'once') expect(months.length).toBeLessThanOrEqual(1);
          if (t.cadence.kind === 'cooldown') for (let i = 1; i < months.length; i++) expect(months[i]! - months[i - 1]!).toBeGreaterThanOrEqual(t.cadence.months);
          if (t.id === 'vet_visit') vets += months.length;
          if (t.id === 'parking_ticket') parking += months.length;
        }
      }
    }
    expect(vets).toBeGreaterThan(0);
    expect(parking).toBeGreaterThan(0);
    const ctx = eligibilityContext({ ...createGame(config('entry_worker', 1)), monthIndex: 10, lifeEvents: [{ monthIndex: 6, amountSigned: -50, eventId: 'x', templateId: 'vet_visit' }] }, true);
    expect(monthsSinceLast(LIFE_TEMPLATE_BY_ID.get('vet_visit')!, ctx)).toBe(4);
    expect(monthsSinceLast(LIFE_TEMPLATE_BY_ID.get('parking_ticket')!, ctx)).toBe(Infinity);
  });

  it('keeps the net-zero clamp, incidence and amount bounds; Monte Carlo and replays are deterministic', () => {
    let total = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const s = play(config('young_family', seed));
      expect(Math.abs(lifeEventNet(s))).toBeLessThanOrEqual(DEFAULT_LIFE_EVENTS.netCap);
      total += lifeEventNet(s);
      for (const e of s.lifeEvents) {
        expect(Math.abs(e.amountSigned)).toBeGreaterThanOrEqual(1);
        expect(Math.abs(e.amountSigned)).toBeLessThanOrEqual(DEFAULT_LIFE_EVENTS.amountMax);
        const t = LIFE_TEMPLATE_BY_ID.get(e.templateId!)!;
        expect(Math.sign(e.amountSigned)).toBe(t.sign);
      }
    }
    expect(Math.abs(total / 100)).toBeLessThan(40);
    const c = config('professional', 77);
    const a = play(c);
    const b = play(c);
    expect(a.lifeEvents).toEqual(b.lifeEvents);
    expect(a.realizedShocks).toEqual(b.realizedShocks);
    const mc1 = runMonteCarlo(c, a.policyLog, a, { paths: 100 });
    const mc2 = runMonteCarlo(c, a.policyLog, a, { paths: 100 });
    expect(mc1.endingNetWorths).toEqual(mc2.endingNetWorths);
    const off = { ...c, assumptions: { ...c.assumptions, lifeEvents: { ...DEFAULT_LIFE_EVENTS, monthlyIncidence: 0 } } };
    const mcOff = runMonteCarlo(off, a.policyLog, { ...a, assumptions: off.assumptions }, { paths: 300 });
    const mcOn = runMonteCarlo(c, a.policyLog, a, { paths: 300 });
    expect(Math.abs(mcOn.median - mcOff.median)).toBeLessThan(150);
  });

  it('notifications and the recap carry the template: label, id and amount agree', () => {
    const s = play(config('young_family', 21));
    expect(s.lifeEvents.length).toBeGreaterThan(0);
    for (const e of s.lifeEvents) {
      const n = s.notifications.find((x) => x.eventId === e.eventId)!;
      expect(n.templateId).toBe(e.templateId);
      const label = lifeEventLabel(e.templateId, s.householdProfile, e.amountSigned);
      expect(n.summary.toLowerCase()).toContain(label.toLowerCase());
      expect(label).not.toMatch(/[{}]/);
      if (e.templateId === 'vet_visit') expect(label).toBe(`vet visit for your ${s.householdProfile.pet}`);
      if (e.templateId === 'birthday_gift') expect(label).toBe(`birthday gift from your ${s.householdProfile.circle[0]}`);
    }
    const r = summarizeTimeline(s);
    const lines = r.timeline.filter((l) => l.event.startsWith('Life event: '));
    expect(lines.length).toBeGreaterThan(0);
    expect(lifeLine('birthday_gift', { birthMonth: 1, pet: 'none', hobby: 'music', hasKids: false, commute: 'bike', circle: ['grandmother'] }, 120)).toBe('Life event: birthday gift from your grandmother, $120 received');
    expect(lifeLine(undefined, undefined, -45)).toBe('Life event: small unplanned cost, $45 paid');
  });
});

describe('shock variants', () => {
  it('each variant of a kind is used once before any repeats, never twice in a row, and insurance cannot change it', () => {
    const s = createGame(config('entry_worker', 3, 60));
    const seen: string[] = [];
    for (let m = 0; m < 12; m++) {
      const v = chooseShockVariant({ ...s, monthIndex: m }, 'medical');
      expect(SHOCK_VARIANTS.medical).toContain(v);
      if (seen.length > 0) expect(v).not.toBe(seen[seen.length - 1]);
      seen.push(v);
      s.realizedShocks.push({ monthIndex: m, shock: { kind: 'medical', variant: v, grossCost: 1, insurerPaid: 0, outOfPocket: 1, planId: null, fundedFrom: [] } });
    }
    expect(new Set(seen.slice(0, 5)).size).toBe(5);
    for (let seed = 1; seed <= 20; seed++) {
      const a = play(config('professional', seed, 48));
      const none = { health: null, auto: null, renters: null };
      const init = config('professional', seed).initialState;
      const b = play({ ...config('professional', seed, 48), initialState: { ...init, insurance: none, policy: { ...init.policy, insurancePlanIds: none } } });
      expect(a.realizedShocks.map((r) => [r.monthIndex, r.shock.kind, r.shock.variant])).toEqual(b.realizedShocks.map((r) => [r.monthIndex, r.shock.kind, r.shock.variant]));
      for (const r of a.realizedShocks) {
        expect(r.shock.variant).toBeTruthy();
        const n = a.notifications.find((x) => x.shockKind === r.shock.kind && x.monthIndex === r.monthIndex)!;
        expect(n.variant).toBe(r.shock.variant);
      }
    }
  });
});

describe('offline scenes', () => {
  it('every template has ≥ 6 scenes (≥ 10 for cooldown templates), news-wire style, with the profile slots filled', () => {
    for (const t of LIFE_EVENT_TEMPLATES) {
      const rows = LIFE_SCENES[t.id]!;
      expect(rows, t.id).toBeDefined();
      expect(rows.length, t.id).toBeGreaterThanOrEqual(t.cadence.kind === 'cooldown' ? 10 : 6);
      expect(rows.length).toBeLessThanOrEqual(20);
      expect(new Set(rows.map((r) => r.scene)).size).toBe(rows.length);
      for (const r of rows) {
        expect(r.templateId).toBe(t.id);
        if (t.id === 'vet_visit') expect(r.scene).toContain('{pet}');
        if (t.id === 'birthday_gift') { expect(r.scene).toContain('{elder}'); expect(r.scene.toLowerCase()).toContain('birthday'); }
        if (t.id === 'holiday_gift') expect(r.scene.toLowerCase()).toMatch(/holiday/);
        if (t.id === 'relative_help') expect(r.scene).toContain('{peer}');
        expect(r.scene).not.toMatch(/\b(dog|cat)\b/); // species only via {pet}
      }
    }
  });

  it('no scene repeats across a 24-month run for 50 seeds; the pet species never changes; amounts come from the engine', () => {
    for (const a of ARCHETYPES) {
      for (let seed = 1; seed <= 50; seed++) {
        const c = config(a, seed);
        const s = play(c);
        const scenes = new Set<string>();
        for (const n of s.notifications) {
          if (!n.shockKind) continue;
          const input = flavourInput(s, c.archetype, n);
          const f = pickFlavour(input, n.id);
          expect(f.scene).not.toMatch(/[{}]/);
          expect(words(f.scene)).toBeLessThanOrEqual(32);
          expect(f.scene).not.toContain('!');
          expect(f.scene).toMatch(/\b(you|your)\b/i);
          if (n.shockKind !== 'job_loss') expect(f.scene).toContain(`$${Math.round(Math.abs(n.amountSigned ?? 0)).toLocaleString('en-US')}`);
          const other = s.householdProfile.pet === 'cat' ? /\bdog\b/ : /\bcat\b/;
          if (s.householdProfile.pet !== 'none') expect(f.scene).not.toMatch(other);
          else expect(f.scene).not.toMatch(/\b(your (cat|dog))\b/);
          expect(scenes.has(f.scene), `${a} seed ${seed}: repeat "${f.headline}"`).toBe(false);
          scenes.add(f.scene);
        }
      }
    }
  });

  it('draw is deterministic and walks the pool without replacement; legacy inputs without a template still work', () => {
    const profile: HouseholdProfile = { archetype: 'entry_worker', birthMonth: 5, pet: 'dog', hobby: 'running', hasKids: false, commute: 'car', circle: ['grandfather', 'roommate'] };
    const base: ShockFlavourInput = { kind: 'life', amount: -90, monthLabel: '2026-05', archetype: 'entry_worker', housingKind: 'rent', hasCar: true, employment: 'employed', templateId: 'vet_visit', household: profile, runSeed: 42 };
    const n = LIFE_SCENES.vet_visit!.length;
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) {
      const f = pickFlavour({ ...base, occurrence: i }, `N_${i}`);
      expect(f.scene).toMatch(/your dog/i);
      expect(f.scene).toContain('$90');
      expect(pickFlavour({ ...base, occurrence: i }, 'other-id')).toEqual(f); // the notification id does not matter once the run seed is known
      seen.add(f.scene);
    }
    expect(seen.size).toBe(n);
    expect(pickFlavour({ ...base, occurrence: n }, 'x')).toEqual(pickFlavour({ ...base, occurrence: 0 }, 'x')); // wraps only after the pool is used up
    expect(pickFlavour({ ...base, runSeed: 43, occurrence: 0 }, 'x').scene).not.toBe(pickFlavour({ ...base, occurrence: 0 }, 'x').scene);
    const legacy = pickFlavour({ kind: 'life', amount: -45, monthLabel: '2026-11', housingKind: 'rent', hasCar: false, employment: 'employed' }, 'N_1');
    expect(legacy.scene).toContain('$45');
    const shock = pickFlavour({ kind: 'medical', amount: 4200, monthLabel: '2026-11', housingKind: 'rent', hasCar: false, employment: 'employed', variant: 'dental', occurrence: 0, runSeed: 1 }, 'N_2');
    expect(shock.scene).toMatch(/molar|root canal/);
  });
});

describe('flavour gateway with the new fields (mocked model, no live AI)', () => {
  const fake = (output: unknown): ModelClient => ({ async parse({ schema }) { const r = schema.safeParse(output); return { parsed: r.success ? r.data : null, stopReason: 'end_turn' }; } });
  const replay = (r: HandlerResult): typeof fetch => (async () => new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
  const env = { AI_API_KEY: 'k' };
  const s = play(config('young_family', 13));
  const giftNote = s.notifications.find((n) => n.shockKind === 'life' && (n.amountSigned ?? 0) > 0)!;
  const input = flavourInput(s, 'young_family', giftNote);

  it('the store builds a request with household, templateId, occurrence and ≤ 6 previous headlines that passes the schema', () => {
    expect(input.household).toEqual(s.householdProfile);
    expect(input.templateId).toBe(giftNote.templateId);
    expect(input.runSeed).toBe(s.seed);
    expect(input.occurrence).toBeGreaterThanOrEqual(0);
    expect(input.previousScenes!.length).toBeLessThanOrEqual(6);
    expect(requestSchema.safeParse({ kind: 'flavour', shock: input }).success).toBe(true);
    expect(requestSchema.safeParse({ kind: 'flavour', shock: { ...input, household: { ...input.household, pet: 'parrot' } } }).success).toBe(false);
    expect(requestSchema.safeParse({ kind: 'flavour', shock: { ...input, previousScenes: Array(7).fill('x') } }).success).toBe(false);
    expect(requestSchema.safeParse({ kind: 'flavour', shock: { ...input, templateId: 'Drop Table' } }).success).toBe(false);
    const shockNote = s.notifications.find((n) => n.shockKind && n.shockKind !== 'life' && n.shockKind !== 'job_loss');
    if (shockNote) {
      const si = flavourInput(s, 'young_family', shockNote);
      expect(si.variant).toBe(shockNote.variant);
      expect(requestSchema.safeParse({ kind: 'flavour', shock: si }).success).toBe(true);
    }
  });

  it('the prompt names the template and its cadence, the pet, the relatives and the previous scenes', () => {
    const withPrev: ShockFlavourInput = { ...input, templateId: 'birthday_gift', household: { ...s.householdProfile, pet: 'cat', circle: ['grandmother', 'partner'] }, previousScenes: ['Vet bill paid', 'Parking ticket issued'] };
    const u = user({ kind: 'flavour', shock: withPrev } as never);
    expect(u).toContain('Event: birthday gift from an elder relative (annual: your birthday)');
    expect(u).toContain('pet a cat');
    expect(u).toContain('your grandmother, your partner');
    expect(u).toContain('Previous scenes (do not repeat): "Vet bill paid"; "Parking ticket issued"');
    expect(u).toContain('Life event: gift');
    const vet = user({ kind: 'flavour', shock: { ...withPrev, amount: -85, templateId: 'vet_visit' } } as never);
    expect(vet).toContain('Event: a vet visit for your pet');
    const auto = user({ kind: 'flavour', shock: { ...withPrev, kind: 'auto', amount: 1800, templateId: undefined, variant: 'rear_ended' } } as never);
    expect(auto).toContain('Variant: rear ended');
  });

  it('round-trips through the handler with a mocked model and falls back to the template pool offline', async () => {
    const r = await handleAiRequest(JSON.stringify({ kind: 'flavour', shock: input }), env, fake({ headline: 'Birthday cheque arrives', scene: `Your grandmother sent a cheque for your birthday. You banked the $${Math.abs(giftNote.amountSigned!)}.` }));
    expect(r.status).toBe(200);
    const res = await describeShock(input, giftNote.id, { fetchImpl: replay(r) });
    expect(res.source).toBe('ai');
    expect(res.headline).toBe('Birthday cheque arrives');
    const offline = await describeShock(input, giftNote.id, { offline: true });
    expect(offline.source).toBe('fallback');
    expect(LIFE_SCENES[giftNote.templateId!]!.some((row) => offline.headline === row.headline.replace('{elder}', s.householdProfile.circle[0]!))).toBe(true);
    expect(offline.scene).toContain(`$${Math.round(Math.abs(giftNote.amountSigned!)).toLocaleString('en-US')}`);
  });
});
