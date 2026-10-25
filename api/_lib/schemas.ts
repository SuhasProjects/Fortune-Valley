/** Zod schemas for the AI gateway: request validation + model-output verification. */
import { z } from 'zod';
import * as coach from './kinds/coach.js';

const archetype = z.enum(['college_student', 'entry_worker', 'professional', 'young_family']);
const building = z.enum(['bank', 'office', 'home', 'hospital', 'market']);
const housingKind = z.enum(['rent', 'dorm', 'family', 'own']);
const insuranceLine = z.enum(['health', 'auto', 'renters']);
const money = (max: number) => z.number().finite().min(0).max(max);

export const PersonalizedInputSchema = z.object({
  freeText: z.string().max(2000),
  age: z.number().int().min(13).max(110).optional(),
  grossAnnualIncome: money(1_000_000).optional(),
  monthlyRent: money(20_000).optional(),
  savings: money(10_000_000).optional(),
  debtBalance: money(5_000_000).optional(),
  debtApr: z.number().min(0).max(0.6).optional(),
  dependents: z.number().int().min(0).max(8).optional(),
}).strict();

export const StateSummarySchema = z.object({
  monthIndex: z.number().int().min(0).max(600),
  monthLabel: z.string().max(10),
  archetype: archetype.optional(),
  netWorth: z.number().finite(),
  cash: z.number().finite(),
  savings: z.number().finite(),
  investmentsTotal: z.number().finite(),
  debtTotal: z.number().finite(),
  grossAnnualSalary: money(1_000_000),
  employmentStatus: z.enum(['employed', 'unemployed', 'student']),
  housingKind,
  housingMonthly: money(20_000),
  essentialsMonthly: money(50_000),
  discretionaryMonthly: money(50_000),
  insurance: z.object({ health: z.string().nullable(), auto: z.string().nullable(), renters: z.string().nullable() }),
  policy: z.object({
    savingsContributionPerMonth: money(50_000),
    investmentContributionPerMonth: money(50_000),
    targetAllocation: z.object({ stock: z.number(), bond: z.number(), etf: z.number() }),
    extraDebtPaymentPerMonth: money(50_000),
  }),
  recentShocks: z.array(z.enum(['medical', 'auto', 'home', 'job_loss'])).max(12),
  monthsOfEssentialsCovered: z.number().finite(),
  narrativeFocus: z.array(z.string().max(40)).max(8),
  complexityLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
}).strict();

export const AiRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('scenario'), input: PersonalizedInputSchema }),
  z.object({ kind: z.literal('opportunity'), summary: StateSummarySchema }),
  z.object({
    kind: z.literal('explain'),
    summary: StateSummarySchema,
    question: z.string().max(500),
    monteCarlo: z.object({
      median: z.number(), p10: z.number(), p90: z.number(),
      probabilityNegativeNetWorth: z.number(), probabilityLiquidityShortfall: z.number(),
      observedNetWorth: z.number(), percentileOfObserved: z.number().optional(),
    }).optional(),
  }),
  coach.requestSchema.extend({ summary: StateSummarySchema }),
]);
export type AiRequestParsed = z.infer<typeof AiRequestSchema>;

/** What the model is allowed to return for a scenario. */
export const ScenarioProposalSchema = z.object({
  baseArchetype: archetype,
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(400),
  overrides: z.object({
    grossAnnualSalary: money(1_000_000).optional(),
    housingMonthly: money(20_000).optional(),
    housingKind: housingKind.optional(),
    essentialsMonthly: money(50_000).optional(),
    discretionaryMonthly: money(50_000).optional(),
    cash: money(10_000_000).optional(),
    savings: money(10_000_000).optional(),
    debts: z.array(z.object({
      name: z.string().min(1).max(60),
      kind: z.enum(['student_loan', 'credit_card', 'auto_loan', 'personal_loan']),
      balance: money(5_000_000),
      apr: z.number().min(0).max(0.6),
      minimumPayment: money(5_000_000),
    })).max(6).optional(),
    dependents: z.number().int().min(0).max(8).optional(),
    durationMonths: z.number().int().min(6).max(240).optional(),
  }),
  narrativeFocus: z.array(z.string().min(1).max(40)).min(1).max(6),
  defaultsApplied: z.array(z.string().max(60)).max(20),
});

export const EventEffectSchema = z.discriminatedUnion('template', [
  z.object({ template: z.literal('none') }),
  z.object({ template: z.literal('offer_job'), grossAnnualSalary: money(1_000_000), title: z.string().min(1).max(60) }),
  z.object({ template: z.literal('change_housing'), housingMonthly: money(20_000), housingKind }),
  z.object({ template: z.literal('change_insurance'), line: insuranceLine, planId: z.string().max(40).nullable() }),
  z.object({ template: z.literal('budget_choice'), discretionaryMonthly: money(50_000) }),
  z.object({ template: z.literal('loan_choice'), principal: z.number().min(1).max(100_000), apr: z.number().min(0).max(0.6), termMonths: z.number().int().min(6).max(120), name: z.string().min(1).max(60) }),
  z.object({ template: z.literal('contribution_choice'), savingsContributionPerMonth: money(50_000), investmentContributionPerMonth: money(50_000) }),
]);

export const OpportunityProposalSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(600),
  buildingTarget: building,
  learningNote: z.string().min(1).max(300),
  options: z.array(z.object({ label: z.string().min(1).max(60), description: z.string().max(200), effect: EventEffectSchema })).min(1).max(3),
  expiresInMonths: z.number().int().min(1).max(6),
});

/** Director may also decline to propose anything. */
export const OpportunityOutputSchema = z.object({ proposal: OpportunityProposalSchema.nullable() });
export const ExplainOutputSchema = z.object({ text: z.string().min(1).max(1200) });
