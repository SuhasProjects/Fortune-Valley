import { describe, expect, it } from 'vitest';
import { archetypeConfig, ARCHETYPES } from '@/config/archetypes';
import { BOUNDS } from '@/config/defaults';
import { advanceMonth, applyAction, createGame, monthLabel, summarizeForAi } from '@/engine';
import { validateNarrativeEvent } from '@/engine/validation';
import { FALLBACK_OPPORTUNITY_TEMPLATE_IDS, fallbackOpportunity } from '@/services/aiFallback';
import { proposalToEvent } from '@/services/scenarioMapper';
import { OpportunityProposalSchema } from '../../api/_lib/schemas';
import type { ArchetypeId, GameState, OpportunityProposal, StateSummary } from '@/types/domain';

const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

/** Real engine states for each archetype at every month of a 24-month run (no decisions, so luck is the only variation). */
function statesFor(id: ArchetypeId, seed = 7): GameState[] {
  const cfg = archetypeConfig(id, seed, { durationMonths: 24 });
  let s = applyAction(createGame(cfg), { type: 'resume' }).state;
  const out: GameState[] = [s];
  for (let i = 0; i < 23; i++) {
    s = advanceMonth(s);
    out.push(s);
  }
  return out;
}
const summarize = (s: GameState, id: ArchetypeId): StateSummary => summarizeForAi(s, ARCHETYPES[id].narrativeFocus, id);

function expectValid(p: OpportunityProposal | null, state: GameState, label: string): asserts p is OpportunityProposal {
  expect(p, label).not.toBeNull();
  const proposal = p!;
  expect(proposal.options.length, label).toBeGreaterThanOrEqual(2);
  expect(proposal.options.length, label).toBeLessThanOrEqual(3);
  expect(proposal.options.filter((o) => o.effect.template === 'none').length, label).toBe(1);
  expect(proposal.options.filter((o) => o.effect.template !== 'none').length, label).toBeGreaterThanOrEqual(1);
  expect(proposal.learningNote.length, label).toBeGreaterThan(20);
  expect(proposal.learningNote.length, label).toBeLessThanOrEqual(300);
  expect(proposal.learningNote, label).not.toMatch(/you should/i);
  expect(proposal.body, label).not.toMatch(/NaN|undefined|\$-/);
  expect(proposal.title.length, label).toBeLessThanOrEqual(80);
  expect(proposal.body.length, label).toBeLessThanOrEqual(600);
  expect(proposal.expiresInMonths, label).toBeGreaterThanOrEqual(1);
  expect(proposal.expiresInMonths, label).toBeLessThanOrEqual(6);
  // Same shape the server-side Zod schema accepts from the model.
  expect(OpportunityProposalSchema.safeParse(proposal).success, label).toBe(true);
  const ev = proposalToEvent(proposal, state, 'fallback');
  expect(ev, label).not.toBeNull();
  expect(validateNarrativeEvent(state.assumptions, ev!, state.monthIndex), label).toEqual({ ok: true, message: '' });
  expect(applyAction(state, { type: 'enqueue_event', event: ev! }).ok, label).toBe(true);
  for (const o of proposal.options) {
    const e = o.effect;
    if (e.template === 'offer_job') expect(e.grossAnnualSalary).toBeLessThanOrEqual(BOUNDS.salaryMax);
    if (e.template === 'change_housing') expect(e.housingMonthly).toBeLessThanOrEqual(BOUNDS.housingMax);
    if (e.template === 'budget_choice') expect(e.discretionaryMonthly).toBeLessThanOrEqual(BOUNDS.monthlySpendMax);
    if (e.template === 'loan_choice') {
      expect(e.principal).toBeLessThanOrEqual(BOUNDS.loanPrincipalMax);
      expect(e.apr).toBeLessThanOrEqual(0.35);
      expect(e.termMonths).toBeGreaterThanOrEqual(BOUNDS.loanTermMonthsMin);
    }
    if (e.template === 'contribution_choice') {
      expect(e.savingsContributionPerMonth).toBeLessThanOrEqual(BOUNDS.contributionMax);
      expect(e.investmentContributionPerMonth).toBeLessThanOrEqual(BOUNDS.contributionMax);
    }
  }
}

describe('fallbackOpportunity', () => {
  it('has at least 12 distinct templates spanning all five buildings', () => {
    expect(new Set(FALLBACK_OPPORTUNITY_TEMPLATE_IDS).size).toBeGreaterThanOrEqual(12);
    const buildings = new Set<string>();
    for (const id of ARCHETYPE_IDS) for (const st of statesFor(id)) buildings.add(fallbackOpportunity(summarize(st, id))?.buildingTarget ?? 'null');
    for (const b of ['bank', 'office', 'home', 'hospital', 'market']) expect([...buildings], b).toContain(b);
  });

  it('is valid, bounded, schema-compatible and enqueueable for 24 months × 4 archetypes', () => {
    for (const id of ARCHETYPE_IDS) {
      for (const st of statesFor(id)) expectValid(fallbackOpportunity(summarize(st, id)), st, `${id} month ${st.monthIndex}`);
    }
  });

  it('varies across months and archetypes and never repeats in consecutive months', () => {
    const all = new Set<string>();
    for (const id of ARCHETYPE_IDS) {
      const states = statesFor(id);
      const titles = states.map((st) => fallbackOpportunity(summarize(st, id))!.title);
      titles.forEach((t) => all.add(t));
      expect(new Set(titles).size, id).toBeGreaterThanOrEqual(6);
      // Consecutive months differ, except while unemployed (the return-to-work offer legitimately persists).
      for (let m = 1; m < titles.length; m++) {
        if (states[m]!.employment.status === 'unemployed' || states[m - 1]!.employment.status === 'unemployed') continue;
        expect(titles[m], `${id} month ${m}`).not.toBe(titles[m - 1]);
      }
    }
    expect(all.size).toBeGreaterThanOrEqual(12);
    // Different archetypes do not get the same sequence.
    const seq = (id: ArchetypeId) => statesFor(id).map((st) => fallbackOpportunity(summarize(st, id))!.title).join('|');
    expect(seq('college_student')).not.toBe(seq('professional'));
  });

  it('is deterministic for the same summary', () => {
    for (const id of ARCHETYPE_IDS) {
      const st = statesFor(id)[9]!;
      const s = summarize(st, id);
      expect(JSON.stringify(fallbackOpportunity(s))).toBe(JSON.stringify(fallbackOpportunity(structuredClone(s))));
    }
  });

  it('prefers templates tied to the archetype’s narrativeFocus', () => {
    const fam = statesFor('young_family').map((st) => fallbackOpportunity(summarize(st, 'young_family'))!);
    const insuranceOrBuffer = fam.filter((p) => p.buildingTarget === 'hospital' || p.buildingTarget === 'home' || p.buildingTarget === 'bank').length;
    expect(insuranceOrBuffer).toBeGreaterThanOrEqual(fam.length / 2);
    const pro = statesFor('professional').map((st) => fallbackOpportunity(summarize(st, 'professional'))!);
    expect(pro.some((p) => p.buildingTarget === 'market')).toBe(true);
  });

  it('uses the summary’s own numbers in copy and option labels', () => {
    const st = statesFor('entry_worker')[3]!;
    const s = summarize(st, 'entry_worker');
    const p = fallbackOpportunity(s)!;
    const text = `${p.body} ${p.options.map((o) => `${o.label} ${o.description}`).join(' ')}`;
    expect(text).toMatch(/\$[\d,]+/);
    expect(text).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('responds to urgent situations: unemployment, uncovered shocks, thin buffers', () => {
    const st = statesFor('entry_worker')[5]!;
    const base: StateSummary = { ...summarize(st, 'entry_worker'), employmentStatus: 'employed', recentShocks: [], monthsOfEssentialsCovered: 3, monthIndex: 6 };
    const unemployed = fallbackOpportunity({ ...base, employmentStatus: 'unemployed' })!;
    expect(unemployed.title).toBe('A quicker way back to work');
    expect(unemployed.options[0]!.effect).toMatchObject({ template: 'offer_job' });
    expectValid(unemployed, st, 'unemployed');

    const medical = fallbackOpportunity({ ...base, recentShocks: ['medical'], insurance: { ...base.insurance, health: null } })!;
    expect(medical.title).toBe('Open enrollment');
    expect(medical.buildingTarget).toBe('hospital');
    expectValid(medical, st, 'medical');

    const auto = fallbackOpportunity({ ...base, recentShocks: ['auto'], insurance: { ...base.insurance, auto: null } })!;
    expect(auto.title).toBe('Auto insurance quote');
    expectValid(auto, st, 'auto');

    const tight = fallbackOpportunity({ ...base, monthsOfEssentialsCovered: 0.8, discretionaryMonthly: 400, monthIndex: 9 })!;
    expect(tight.title).toBe('Tight month ahead');
    expect(tight.options.map((o) => o.effect.template)).toEqual(['budget_choice', 'budget_choice', 'none']);
    expectValid(tight, st, 'tight');
  });

  it('clamps offers to BOUNDS even for extreme summaries', () => {
    const st = statesFor('professional')[2]!;
    const base = summarize(st, 'professional');
    const extremes: Partial<StateSummary>[] = [
      { grossAnnualSalary: 990_000, housingMonthly: 19_500, discretionaryMonthly: 49_000, debtTotal: 4_000_000, policy: { ...base.policy, savingsContributionPerMonth: 49_000, investmentContributionPerMonth: 49_000 } },
      { grossAnnualSalary: 0, housingMonthly: 0, discretionaryMonthly: 0, debtTotal: 0, monthsOfEssentialsCovered: 0, policy: { ...base.policy, savingsContributionPerMonth: 0, investmentContributionPerMonth: 0 } },
    ];
    for (const over of extremes) {
      for (let m = 0; m < 24; m++) {
        const s: StateSummary = { ...base, ...over, monthIndex: m, monthLabel: monthLabel('2026-01', m) };
        const p = fallbackOpportunity(s);
        if (p) expectValid(p, st, `extreme month ${m}`);
      }
    }
  });
});
