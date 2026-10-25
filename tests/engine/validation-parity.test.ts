import { describe, expect, it } from 'vitest';
import { archetypeConfig } from '@/config/archetypes';
import { BOUNDS, DEFAULT_ASSUMPTIONS } from '@/config/defaults';
import { createGame, validateConfig, validateEffect } from '@/engine';
import { validateNarrativeEvent } from '@/engine/validation';
import { makeRng } from '@/engine/rng';
import { proposalToEvent, scenarioToConfig } from '@/services/scenarioMapper';
import type { EventEffect, OpportunityProposal, ScenarioProposal } from '@/types/domain';
import { EventEffectSchema, OpportunityProposalSchema, ScenarioProposalSchema } from '../../api/_lib/schemas';
import { ARCHETYPE_IDS, randomEffect } from './helpers/randomPlay';

const state = createGame(archetypeConfig('entry_worker', 1));
const assumptions = DEFAULT_ASSUMPTIONS;

const proposal = (effects: unknown[], over: Partial<OpportunityProposal> = {}): unknown => ({
  title: 'Side gig', body: 'A neighbour offers weekend work.', buildingTarget: 'office', learningNote: 'Extra income vs. time.',
  options: effects.map((effect, i) => ({ label: `Option ${i + 1}`, description: 'd', effect })), expiresInMonths: 2, ...over,
});

/** [label, proposal, expected] — expected is what BOTH the Zod schema and the engine pipeline must say. */
const cases: [string, unknown, 'valid' | 'invalid'][] = [
  ['none', proposal([{ template: 'none' }]), 'valid'],
  ['offer_job', proposal([{ template: 'offer_job', grossAnnualSalary: 65000, title: 'Analyst' }]), 'valid'],
  ['offer_job at salary max', proposal([{ template: 'offer_job', grossAnnualSalary: BOUNDS.salaryMax, title: 'CEO' }]), 'valid'],
  ['offer_job over salary max', proposal([{ template: 'offer_job', grossAnnualSalary: BOUNDS.salaryMax + 1, title: 'CEO' }]), 'invalid'],
  ['offer_job negative salary', proposal([{ template: 'offer_job', grossAnnualSalary: -1, title: 'x' }]), 'invalid'],
  ['offer_job empty title', proposal([{ template: 'offer_job', grossAnnualSalary: 1, title: '' }]), 'invalid'],
  ['offer_job long title', proposal([{ template: 'offer_job', grossAnnualSalary: 1, title: 'x'.repeat(61) }]), 'invalid'],
  ['offer_job NaN salary', proposal([{ template: 'offer_job', grossAnnualSalary: NaN, title: 'x' }]), 'invalid'],
  ['offer_job string salary', proposal([{ template: 'offer_job', grossAnnualSalary: '65000', title: 'x' }]), 'invalid'],
  ['change_housing', proposal([{ template: 'change_housing', housingMonthly: 900, housingKind: 'rent' }]), 'valid'],
  ['change_housing at max', proposal([{ template: 'change_housing', housingMonthly: BOUNDS.housingMax, housingKind: 'own' }]), 'valid'],
  ['change_housing over max', proposal([{ template: 'change_housing', housingMonthly: BOUNDS.housingMax + 0.01, housingKind: 'own' }]), 'invalid'],
  ['change_housing bad kind', proposal([{ template: 'change_housing', housingMonthly: 900, housingKind: 'boat' }]), 'invalid'],
  ['change_insurance known plan', proposal([{ template: 'change_insurance', line: 'health', planId: 'health_plus' }]), 'valid'],
  ['change_insurance drop', proposal([{ template: 'change_insurance', line: 'auto', planId: null }]), 'valid'],
  ['change_insurance bad line', proposal([{ template: 'change_insurance', line: 'pet', planId: null }]), 'invalid'],
  ['change_insurance missing planId', proposal([{ template: 'change_insurance', line: 'auto' }]), 'invalid'],
  ['budget_choice', proposal([{ template: 'budget_choice', discretionaryMonthly: 250 }]), 'valid'],
  ['budget_choice zero', proposal([{ template: 'budget_choice', discretionaryMonthly: 0 }]), 'valid'],
  ['budget_choice over max', proposal([{ template: 'budget_choice', discretionaryMonthly: BOUNDS.monthlySpendMax + 1 }]), 'invalid'],
  ['budget_choice infinite', proposal([{ template: 'budget_choice', discretionaryMonthly: Infinity }]), 'invalid'],
  ['loan_choice', proposal([{ template: 'loan_choice', principal: 5000, apr: 0.12, termMonths: 24, name: 'Personal loan' }]), 'valid'],
  ['loan_choice at bounds', proposal([{ template: 'loan_choice', principal: BOUNDS.loanPrincipalMax, apr: BOUNDS.aprMax, termMonths: BOUNDS.loanTermMonthsMax, name: 'Big' }]), 'valid'],
  ['loan_choice min term', proposal([{ template: 'loan_choice', principal: 1, apr: 0, termMonths: BOUNDS.loanTermMonthsMin, name: 'Tiny' }]), 'valid'],
  ['loan_choice zero principal', proposal([{ template: 'loan_choice', principal: 0, apr: 0.1, termMonths: 12, name: 'x' }]), 'invalid'],
  ['loan_choice over principal', proposal([{ template: 'loan_choice', principal: BOUNDS.loanPrincipalMax + 1, apr: 0.1, termMonths: 12, name: 'x' }]), 'invalid'],
  ['loan_choice over apr', proposal([{ template: 'loan_choice', principal: 100, apr: BOUNDS.aprMax + 0.01, termMonths: 12, name: 'x' }]), 'invalid'],
  ['loan_choice short term', proposal([{ template: 'loan_choice', principal: 100, apr: 0.1, termMonths: BOUNDS.loanTermMonthsMin - 1, name: 'x' }]), 'invalid'],
  ['loan_choice long term', proposal([{ template: 'loan_choice', principal: 100, apr: 0.1, termMonths: BOUNDS.loanTermMonthsMax + 1, name: 'x' }]), 'invalid'],
  ['loan_choice fractional term', proposal([{ template: 'loan_choice', principal: 100, apr: 0.1, termMonths: 12.5, name: 'x' }]), 'invalid'],
  ['loan_choice empty name', proposal([{ template: 'loan_choice', principal: 100, apr: 0.1, termMonths: 12, name: '' }]), 'invalid'],
  ['contribution_choice', proposal([{ template: 'contribution_choice', savingsContributionPerMonth: 100, investmentContributionPerMonth: 50 }]), 'valid'],
  ['contribution_choice over max', proposal([{ template: 'contribution_choice', savingsContributionPerMonth: BOUNDS.contributionMax + 1, investmentContributionPerMonth: 0 }]), 'invalid'],
  ['contribution_choice negative', proposal([{ template: 'contribution_choice', savingsContributionPerMonth: 0, investmentContributionPerMonth: -5 }]), 'invalid'],
  ['unknown template', proposal([{ template: 'grant_cash', amount: 1_000_000 }]), 'invalid'],
  ['missing template', proposal([{ amount: 5 }]), 'invalid'],
  ['three options', proposal([{ template: 'none' }, { template: 'budget_choice', discretionaryMonthly: 100 }, { template: 'offer_job', grossAnnualSalary: 1, title: 't' }]), 'valid'],
  ['zero options', proposal([]), 'invalid'],
  ['bad building', proposal([{ template: 'none' }], { buildingTarget: 'castle' as never }), 'invalid'],
  ['empty title', proposal([{ template: 'none' }], { title: '' }), 'invalid'],
];

const engineAccepts = (p: unknown): boolean => {
  const ev = proposalToEvent(p as OpportunityProposal, state, 'ai');
  return ev !== null && validateNarrativeEvent(state.assumptions, ev, state.monthIndex).ok;
};

describe('engine validation agrees with the gateway Zod schemas', () => {
  it.each(cases)('%s', (_label, p, expected) => {
    const zod = OpportunityProposalSchema.safeParse(p).success;
    expect(zod, 'zod').toBe(expected === 'valid');
    expect(engineAccepts(p), 'engine').toBe(expected === 'valid');
  });

  it('every option effect: engine validateEffect and EventEffectSchema agree on bounds', () => {
    for (const [, p, expected] of cases) {
      for (const o of ((p as OpportunityProposal).options ?? [])) {
        const e = o.effect as EventEffect;
        if (!EventEffectSchema.safeParse(e).success) expect(validateEffect(assumptions, e).ok, JSON.stringify(e)).toBe(false);
        if (expected === 'valid') expect(validateEffect(assumptions, e).ok, JSON.stringify(e)).toBe(true);
      }
    }
  });

  it('anything Zod accepts that proposalToEvent emits passes validateNarrativeEvent (random effects)', () => {
    const rng = makeRng(77);
    for (let i = 0; i < 200; i++) {
      const effects = Array.from({ length: rng.int(1, 3) }, () => randomEffect(rng, state));
      const p = proposal(effects, { expiresInMonths: rng.int(1, 6) }) as OpportunityProposal;
      expect(OpportunityProposalSchema.safeParse(p).success).toBe(true);
      const ev = proposalToEvent(p, state, i % 2 ? 'ai' : 'fallback');
      expect(ev).not.toBeNull();
      expect(validateNarrativeEvent(state.assumptions, ev!, state.monthIndex).ok).toBe(true);
      expect(ev!.options.some((o) => o.effect.template === 'none')).toBe(true);
      expect(ev!.options.length).toBeLessThanOrEqual(4);
      expect(ev!.expiresAtMonth).toBeGreaterThanOrEqual(state.monthIndex + 1);
    }
  });

  it('documented divergence: proposalToEvent clamps expiresInMonths, which Zod rejects outside 1–6', () => {
    for (const expiresInMonths of [0, 9]) {
      const p = proposal([{ template: 'none' }], { expiresInMonths });
      expect(OpportunityProposalSchema.safeParse(p).success).toBe(false);
      const ev = proposalToEvent(p as OpportunityProposal, state, 'ai')!;
      expect(ev.expiresAtMonth! - state.monthIndex).toBe(Math.min(6, Math.max(1, expiresInMonths)));
      expect(validateNarrativeEvent(state.assumptions, ev, state.monthIndex).ok).toBe(true);
    }
  });

  it('an unknown plan id passes Zod (it cannot know plans) but the engine refuses it', () => {
    const p = proposal([{ template: 'change_insurance', line: 'health', planId: 'gold_plan' }]);
    expect(OpportunityProposalSchema.safeParse(p).success).toBe(true);
    expect(proposalToEvent(p as OpportunityProposal, state, 'ai')).toBeNull();
  });
});

describe('scenarioToConfig output always validates', () => {
  const scenario = (over: ScenarioProposal['overrides'], archetype = 'entry_worker' as ScenarioProposal['baseArchetype']): ScenarioProposal => ({
    baseArchetype: archetype, title: 'Custom life', description: 'Mapped from text', overrides: over, narrativeFocus: ['budgeting'], defaultsApplied: ['rent'],
  });
  it('random Zod-valid proposals map to configs that pass validateConfig and start a game', () => {
    const rng = makeRng(5);
    const kinds = ['student_loan', 'credit_card', 'auto_loan', 'personal_loan'] as const;
    for (let i = 0; i < 150; i++) {
      const over: ScenarioProposal['overrides'] = {};
      if (rng.next() < 0.6) over.grossAnnualSalary = Math.round(rng.next() * BOUNDS.salaryMax * (rng.next() < 0.1 ? 1 : 0.2));
      if (rng.next() < 0.5) over.housingMonthly = Math.round(rng.next() * BOUNDS.housingMax);
      if (rng.next() < 0.3) over.housingKind = (['rent', 'dorm', 'family', 'own'] as const)[rng.int(0, 3)];
      if (rng.next() < 0.5) over.essentialsMonthly = Math.round(rng.next() * BOUNDS.monthlySpendMax);
      if (rng.next() < 0.5) over.discretionaryMonthly = Math.round(rng.next() * BOUNDS.monthlySpendMax);
      if (rng.next() < 0.5) over.cash = Math.round(rng.next() * BOUNDS.cashMax);
      if (rng.next() < 0.5) over.savings = Math.round(rng.next() * BOUNDS.cashMax);
      if (rng.next() < 0.3) over.dependents = rng.int(0, 8);
      if (rng.next() < 0.3) over.durationMonths = rng.int(BOUNDS.durationMonthsMin, BOUNDS.durationMonthsMax);
      if (rng.next() < 0.6) over.debts = Array.from({ length: rng.int(0, 6) }, (_, j) => ({ name: `Debt ${j}`, kind: kinds[rng.int(0, 3)]!, balance: Math.round(rng.next() * BOUNDS.debtMax), apr: Math.round(rng.next() * BOUNDS.aprMax * 100) / 100, minimumPayment: Math.round(rng.next() * 5000) }));
      const p = scenario(over, ARCHETYPE_IDS[i % 4]!);
      expect(ScenarioProposalSchema.safeParse(p).success).toBe(true);
      const cfg = scenarioToConfig(p, i, i % 2 ? 'ai' : 'fallback');
      expect(validateConfig(cfg).ok).toBe(true);
      expect(() => createGame(cfg)).not.toThrow();
      expect(cfg.mode).toBe('personalized');
    }
  });
  it('edge overrides: zero salary, empty debts, extreme duration', () => {
    for (const over of [{ grossAnnualSalary: 0 }, { debts: [] }, { durationMonths: BOUNDS.durationMonthsMax }, { durationMonths: BOUNDS.durationMonthsMin }, { cash: 0, savings: 0 }, { debts: [{ name: 'Zero', kind: 'credit_card' as const, balance: 0, apr: 0.1, minimumPayment: 0 }] }]) {
      const cfg = scenarioToConfig(scenario(over), 3, 'ai');
      expect(validateConfig(cfg).ok).toBe(true);
    }
  });
});
