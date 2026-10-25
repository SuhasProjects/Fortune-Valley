/**
 * Offline fallback generators. Deterministic, rule-based, clearly labeled
 * source:'fallback'. Used when the AI gateway is disabled, offline, times out,
 * or returns schema-invalid data. Owner: Agent 1.
 *
 * Nothing here computes finance: every number is either copied from the
 * summary, rounded for display, or a fixed illustrative offer bounded by BOUNDS.
 */
import type { ArchetypeId, BuildingId, EventEffect, OpportunityProposal, PersonalizedInput, ScenarioProposal, StateSummary } from '@/types/domain';
import { hashSeed } from '@/engine/rng';
import { BOUNDS } from '@/config/defaults';

const clampNum = (n: number | undefined, min: number, max: number): number | undefined =>
  n === undefined || !Number.isFinite(n) ? undefined : Math.min(max, Math.max(min, n));
const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

/** `$1,234` / `-$1,234`; never "NaN" or "$-1". */
export const fmtUsd = (n: number): string => {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  const abs = Math.abs(v).toLocaleString('en-US');
  return v < 0 ? `-$${abs}` : `$${abs}`;
};
const fmtPct = (p: number): string => `${Math.round(clamp(p, 0, 1) * 100)}%`;
const fmtMonths = (m: number): string => {
  const v = Number.isFinite(m) ? Math.round(m * 10) / 10 : 0;
  return `${v} month${v === 1 ? '' : 's'}`;
};

export function fallbackScenario(input: PersonalizedInput): ScenarioProposal {
  const t = input.freeText.toLowerCase();
  let baseArchetype: ArchetypeId = 'entry_worker';
  if (/student|college|tuition|campus|dorm/.test(t)) baseArchetype = 'college_student';
  else if (/family|kid|child|baby|spouse|married|daycare/.test(t)) baseArchetype = 'young_family';
  else if (/invest|portfolio|stock|retire|allocation|bonus|senior|six.figure|\b1[0-9]{2}k\b/.test(t)) baseArchetype = 'professional';
  if (input.dependents && input.dependents > 0) baseArchetype = 'young_family';
  if (input.grossAnnualIncome !== undefined) {
    if (input.grossAnnualIncome >= 95000 && baseArchetype !== 'young_family') baseArchetype = 'professional';
    else if (input.grossAnnualIncome < 25000) baseArchetype = 'college_student';
  }
  const focus: string[] = [];
  if (/debt|loan|credit card|payoff|pay off/.test(t)) focus.push('debt_payoff');
  if (/emergency|rainy|buffer|cushion/.test(t)) focus.push('emergency_fund');
  if (/invest|stock|etf|bond|portfolio|allocation/.test(t)) focus.push('investing_basics');
  if (/insurance|deductible|premium|health|medical|accident/.test(t)) focus.push('insurance');
  if (/budget|spend|rent|save/.test(t)) focus.push('budgeting');
  if (/tax|withholding|take.home|paycheck/.test(t)) focus.push('taxes');
  if (focus.length === 0) focus.push('budgeting', 'emergency_fund');

  const overrides: ScenarioProposal['overrides'] = {};
  const defaultsApplied: string[] = [];
  const salary = clampNum(input.grossAnnualIncome, 0, 1_000_000);
  if (salary !== undefined) overrides.grossAnnualSalary = salary; else defaultsApplied.push('grossAnnualSalary');
  const rent = clampNum(input.monthlyRent, 0, 20_000);
  if (rent !== undefined) overrides.housingMonthly = rent; else defaultsApplied.push('housingMonthly');
  const savings = clampNum(input.savings, 0, 10_000_000);
  if (savings !== undefined) overrides.savings = savings; else defaultsApplied.push('savings');
  const debt = clampNum(input.debtBalance, 0, 5_000_000);
  if (debt !== undefined) {
    const apr = clampNum(input.debtApr, 0, 0.6) ?? 0.08;
    if (input.debtApr === undefined) defaultsApplied.push('debtApr');
    overrides.debts = debt > 0 ? [{ name: 'Your debt', kind: apr > 0.15 ? 'credit_card' : 'personal_loan', balance: debt, apr, minimumPayment: Math.max(25, Math.round(debt * 0.02)) }] : [];
  } else defaultsApplied.push('debts');
  if (input.dependents !== undefined) overrides.dependents = clampNum(input.dependents, 0, 8);
  defaultsApplied.push('essentialsMonthly', 'discretionaryMonthly', 'insurance', 'investments');

  return {
    baseArchetype,
    title: 'Your situation (offline mapping)',
    description: `Mapped offline to the "${baseArchetype.replace('_', ' ')}" mechanics using keywords and the numbers you entered. Unlabeled values use demo defaults.`,
    overrides,
    narrativeFocus: focus,
    defaultsApplied,
  };
}

// ---------------------------------------------------------------------------
// Type B opportunities
// ---------------------------------------------------------------------------

interface OppTemplate {
  id: string;
  building: BuildingId;
  /** Narrative focus tags this template teaches (used to prefer archetype-relevant templates). */
  focus: string[];
  eligible: (s: StateSummary) => boolean;
  build: (s: StateSummary) => OpportunityProposal;
}

const DECLINE = (label = 'Not now', description = 'No change.'): OpportunityProposal['options'][number] => ({ label, description, effect: { template: 'none' } });
const roundTo = (n: number, step: number): number => Math.round(n / step) * step;
const salaryOffer = (n: number): number => clamp(roundTo(n, 500), 0, BOUNDS.salaryMax);
const housingOffer = (n: number): number => clamp(roundTo(n, 10), 0, BOUNDS.housingMax);
const spendOffer = (n: number): number => clamp(roundTo(n, 10), 0, BOUNDS.monthlySpendMax);
const contribOffer = (n: number): number => clamp(roundTo(n, 10), 0, BOUNDS.contributionMax);
const loanOffer = (n: number, s: StateSummary): number => clamp(roundTo(n, 500), 500, Math.min(BOUNDS.loanPrincipalMax, Math.max(500, 2 * s.grossAnnualSalary)));
const monthly = (s: StateSummary): number => s.grossAnnualSalary / 12;
const job = (grossAnnualSalary: number, title: string): EventEffect => ({ template: 'offer_job', grossAnnualSalary, title });
const housing = (s: StateSummary, housingMonthly: number): EventEffect => ({ template: 'change_housing', housingMonthly, housingKind: s.housingKind === 'own' ? 'rent' : s.housingKind });
const insure = (line: 'health' | 'auto' | 'renters', planId: string | null): EventEffect => ({ template: 'change_insurance', line, planId });
const budget = (discretionaryMonthly: number): EventEffect => ({ template: 'budget_choice', discretionaryMonthly });
const contrib = (savingsContributionPerMonth: number, investmentContributionPerMonth: number): EventEffect => ({ template: 'contribution_choice', savingsContributionPerMonth, investmentContributionPerMonth });

const TEMPLATES: OppTemplate[] = [
  {
    id: 'return_to_work', building: 'office', focus: ['emergency_fund', 'budgeting'],
    eligible: (s) => s.employmentStatus === 'unemployed' && s.grossAnnualSalary > 0,
    build: (s) => {
      const pay = salaryOffer(s.grossAnnualSalary * 0.9);
      return {
        title: 'A quicker way back to work',
        body: `A recruiter offers ${fmtUsd(pay)}/yr from next month, about 10% under your last pay, which ends unemployment now instead of waiting for your old rate.`,
        buildingTarget: 'office',
        learningNote: 'Income stability versus holding out for a higher salary. There is no single right answer; the simulation shows the cash effect.',
        options: [
          { label: `Take the ${fmtUsd(pay)} role`, description: 'Resume full income now at lower pay.', effect: job(pay, 'New role (recruiter offer)') },
          DECLINE('Keep searching', 'Stay on reduced benefits until your usual role returns.'),
        ],
        expiresInMonths: 1,
      };
    },
  },
  {
    id: 'tight_month', building: 'home', focus: ['emergency_fund', 'budgeting'],
    eligible: (s) => s.monthsOfEssentialsCovered < 2 && s.discretionaryMonthly >= 100,
    build: (s) => {
      const cut = spendOffer(s.discretionaryMonthly * 0.6);
      const deep = spendOffer(s.discretionaryMonthly * 0.3);
      return {
        title: 'Tight month ahead',
        body: `Your cash and savings cover about ${fmtMonths(s.monthsOfEssentialsCovered)} of essentials, so trimming spending from ${fmtUsd(s.discretionaryMonthly)} to ${fmtUsd(cut)} or ${fmtUsd(deep)} a month would rebuild your buffer faster.`,
        buildingTarget: 'home',
        learningNote: 'Emergency funds are built from the gap between income and spending; small recurring cuts compound.',
        options: [
          { label: `Trim to ${fmtUsd(cut)}/mo`, description: 'Lower lifestyle spending for now.', effect: budget(cut) },
          { label: `Cut to ${fmtUsd(deep)}/mo`, description: 'Essentials-only for a while.', effect: budget(deep) },
          DECLINE('Keep current spending'),
        ],
        expiresInMonths: 2,
      };
    },
  },
  {
    id: 'open_enrollment', building: 'hospital', focus: ['insurance'],
    eligible: (s) => s.insurance.health === null,
    build: () => ({
      title: 'Open enrollment',
      body: 'You have no health coverage, and a Basic plan at $180/month or Plus at $340/month would cap what a medical shock costs you.',
      buildingTarget: 'hospital',
      learningNote: 'Insurance trades a certain premium for a cap on uncertain costs. It changes what you pay, never whether something happens.',
      options: [
        { label: 'Enroll in Basic Health', description: '$180/mo, $4,000 deductible.', effect: insure('health', 'health_basic') },
        { label: 'Enroll in Plus Health', description: '$340/mo, $1,000 deductible.', effect: insure('health', 'health_plus') },
        DECLINE('Stay uninsured', 'Keep the premium in your pocket.'),
      ],
      expiresInMonths: 2,
    }),
  },
  {
    id: 'competitor_offer', building: 'office', focus: ['taxes', 'budgeting'],
    eligible: (s) => s.employmentStatus === 'employed' && s.grossAnnualSalary >= 15000,
    build: (s) => {
      const pay = salaryOffer(s.grossAnnualSalary * 1.08);
      const counter = salaryOffer(s.grossAnnualSalary * 1.03);
      return {
        title: 'Offer from across town',
        body: `A competitor offers ${fmtUsd(pay)}/yr against your ${fmtUsd(s.grossAnnualSalary)}, and your manager hints at ${fmtUsd(counter)} if you stay; take-home rises less than the headline.`,
        buildingTarget: 'office',
        learningNote: 'Compare after-tax pay, not headline salary: a raise is taxed at your top bracket in the simulation.',
        options: [
          { label: `Accept ${fmtUsd(pay)}`, description: 'Switch employers for the higher offer.', effect: job(pay, 'Competitor role') },
          { label: `Stay at ${fmtUsd(counter)}`, description: 'Take the partial match and keep your seat.', effect: job(counter, 'Current role (matched)') },
          DECLINE('Decline both', 'Stay at your current pay.'),
        ],
        expiresInMonths: 2,
      };
    },
  },
  {
    id: 'side_gig', building: 'office', focus: ['budgeting', 'taxes', 'debt_payoff'],
    eligible: (s) => s.employmentStatus === 'employed' && s.grossAnnualSalary > 0 && s.grossAnnualSalary < 150_000,
    build: (s) => {
      const big = salaryOffer(s.grossAnnualSalary + 4800);
      const small = salaryOffer(s.grossAnnualSalary + 2400);
      return {
        title: 'Weekend side gig',
        body: `A neighbour needs weekend help: two shifts a month add about $200 (${fmtUsd(small)}/yr), four add about $400 (${fmtUsd(big)}/yr), all taxed as income.`,
        buildingTarget: 'office',
        learningNote: 'Extra income raises every month’s surplus, but it costs time and is taxed; the net is smaller than the gross.',
        options: [
          { label: 'Four shifts (+$400/mo)', description: 'Most income, least free time.', effect: job(big, 'Current role + side gig') },
          { label: 'Two shifts (+$200/mo)', description: 'A lighter commitment.', effect: job(small, 'Current role + light gig') },
          DECLINE('Pass', 'Keep your weekends.'),
        ],
        expiresInMonths: 2,
      };
    },
  },
  {
    id: 'annual_review', building: 'office', focus: ['taxes', 'allocation', 'investing_basics'],
    eligible: (s) => s.employmentStatus === 'employed' && s.grossAnnualSalary >= 30000 && s.complexityLevel >= 2,
    build: (s) => {
      const ask = salaryOffer(s.grossAnnualSalary * 1.05);
      const std = salaryOffer(s.grossAnnualSalary * 1.02);
      return {
        title: 'Annual review',
        body: `The standard review raise is 2% (${fmtUsd(std)}/yr), or you could ask for 5% (${fmtUsd(ask)}/yr) by leading a bigger project with longer hours.`,
        buildingTarget: 'office',
        learningNote: 'Pay raises compound: a higher base lifts every future raise and contribution tied to income.',
        options: [
          { label: `Ask for 5% (${fmtUsd(ask)})`, description: 'More pay, more responsibility.', effect: job(ask, 'Current role (lead)') },
          { label: `Accept 2% (${fmtUsd(std)})`, description: 'The standard adjustment.', effect: job(std, 'Current role') },
          DECLINE('Skip the review', 'No change this year.'),
        ],
        expiresInMonths: 1,
      };
    },
  },
  {
    id: 'four_day_week', building: 'office', focus: ['budgeting', 'allocation'],
    eligible: (s) => s.employmentStatus === 'employed' && s.grossAnnualSalary >= 40000 && s.monthsOfEssentialsCovered >= 3 && s.complexityLevel >= 2,
    build: (s) => {
      const pay = salaryOffer(s.grossAnnualSalary * 0.9);
      return {
        title: 'Four-day week offer',
        body: `Your employer offers a four-day week at 90% pay, ${fmtUsd(pay)}/yr instead of ${fmtUsd(s.grossAnnualSalary)}, while your fixed costs stay the same.`,
        buildingTarget: 'office',
        learningNote: 'A pay cut shows up fully in the surplus because housing and essentials do not shrink with it.',
        options: [
          { label: `Take the four-day week`, description: `${fmtUsd(pay)}/yr, one more free day a week.`, effect: job(pay, 'Current role (4-day week)') },
          DECLINE('Keep five days', 'Keep current pay.'),
        ],
        expiresInMonths: 2,
      };
    },
  },
  {
    id: 'lease_renewal', building: 'home', focus: ['budgeting', 'emergency_fund'],
    eligible: (s) => s.housingKind === 'rent' && s.housingMonthly >= 400,
    build: (s) => {
      const up = housingOffer(s.housingMonthly * 1.06);
      const down = housingOffer(s.housingMonthly * 0.88);
      return {
        title: 'Lease renewal',
        body: `Your lease is up: renewing costs ${fmtUsd(up)}/mo, a smaller place nearby lists at ${fmtUsd(down)}/mo, or you can stay month-to-month at ${fmtUsd(s.housingMonthly)}.`,
        buildingTarget: 'home',
        learningNote: 'Housing is usually the largest fixed cost; a few percent either way moves every month of the run.',
        options: [
          { label: `Renew at ${fmtUsd(up)}/mo`, description: 'Same place, higher rent.', effect: housing(s, up) },
          { label: `Move to ${fmtUsd(down)}/mo`, description: 'Smaller place, lower rent.', effect: housing(s, down) },
          DECLINE('Stay month-to-month', 'No change for now.'),
        ],
        expiresInMonths: 2,
      };
    },
  },
  {
    id: 'smaller_place', building: 'home', focus: ['budgeting', 'debt_payoff', 'emergency_fund'],
    eligible: (s) => (s.housingKind === 'rent' || s.housingKind === 'dorm') && s.housingMonthly >= 500,
    build: (s) => {
      const cheaper = housingOffer(s.housingMonthly * 0.82);
      return {
        title: 'A smaller place opens up',
        body: `A friend’s building has a smaller unit for about ${fmtUsd(cheaper)}/mo instead of your ${fmtUsd(s.housingMonthly)}, trading space for monthly budget room.`,
        buildingTarget: 'home',
        learningNote: 'Reducing a fixed cost frees the same cash every month for the rest of the run; one-off savings do not.',
        options: [
          { label: 'Move to the smaller unit', description: 'Lower rent from next month.', effect: housing(s, cheaper) },
          DECLINE('Stay', 'Keep your current place.'),
        ],
        expiresInMonths: 2,
      };
    },
  },
  {
    id: 'lifestyle_choice', building: 'home', focus: ['budgeting'],
    eligible: (s) => s.discretionaryMonthly >= 150 && s.monthsOfEssentialsCovered >= 2,
    build: (s) => {
      const up = spendOffer(s.discretionaryMonthly * 1.25);
      const down = spendOffer(s.discretionaryMonthly * 0.8);
      return {
        title: 'Friends, plans, and a budget',
        body: `New invitations would lift your spending from ${fmtUsd(s.discretionaryMonthly)} to about ${fmtUsd(up)}/mo, while a no-spend challenge would trim it to ${fmtUsd(down)}.`,
        buildingTarget: 'home',
        learningNote: 'Discretionary spending is the lever you control most directly; it moves the surplus one-for-one.',
        options: [
          { label: `Say yes (${fmtUsd(up)}/mo)`, description: 'Enjoy more now.', effect: budget(up) },
          { label: `Trim to ${fmtUsd(down)}/mo`, description: 'Spend less, save the difference.', effect: budget(down) },
          DECLINE('Keep it as is'),
        ],
        expiresInMonths: 2,
      };
    },
  },
  {
    id: 'renters_flyer', building: 'hospital', focus: ['insurance'],
    eligible: (s) => s.insurance.renters === null && (s.housingKind === 'rent' || s.housingKind === 'dorm'),
    build: () => ({
      title: 'Renters insurance flyer',
      body: 'Your building offers renters insurance at $18/month with a $500 deductible, covering theft and damage up to $20,000.',
      buildingTarget: 'hospital',
      learningNote: 'Cheap coverage for rare, expensive events is often where insurance adds the most value; the simulation lets you see both outcomes.',
      options: [
        { label: 'Add renters insurance', description: '$18/mo.', effect: insure('renters', 'renters_basic') },
        DECLINE('Skip it'),
      ],
      expiresInMonths: 2,
    }),
  },
  {
    id: 'health_plan_switch', building: 'hospital', focus: ['insurance'],
    eligible: (s) => s.insurance.health === 'health_basic' || s.insurance.health === 'health_plus',
    build: (s) => {
      const toPlus = s.insurance.health === 'health_basic';
      return {
        title: toPlus ? 'Upgrade your health plan?' : 'Downgrade your health plan?',
        body: toPlus
          ? 'The Plus plan costs $340/month instead of $180 but cuts the deductible from $4,000 to $1,000, so you pay more monthly for a smaller worst case.'
          : 'The Basic plan costs $180/month instead of $340 but raises the deductible from $1,000 to $4,000, so you keep more monthly with a bigger worst case.',
        buildingTarget: 'hospital',
        learningNote: 'Premium versus deductible is a trade between a certain monthly cost and the size of the bad-month bill.',
        options: [
          toPlus
            ? { label: 'Switch to Plus Health', description: '$340/mo, $1,000 deductible.', effect: insure('health', 'health_plus') }
            : { label: 'Switch to Basic Health', description: '$180/mo, $4,000 deductible.', effect: insure('health', 'health_basic') },
          DECLINE('Keep current plan'),
        ],
        expiresInMonths: 2,
      };
    },
  },
  {
    id: 'auto_coverage', building: 'hospital', focus: ['insurance'],
    eligible: (s) => s.insurance.auto === 'auto_liability' || (s.insurance.auto === null && s.archetype !== 'college_student'),
    build: (s) => {
      const hasLiability = s.insurance.auto === 'auto_liability';
      return {
        title: hasLiability ? 'Full coverage quote' : 'Auto insurance quote',
        body: hasLiability
          ? 'Full coverage costs $145/month instead of $70 and pays up to $25,000 for damage to your own car after a $1,000 deductible.'
          : 'You drive uninsured; liability-only costs $70/month, while full coverage at $145/month also pays up to $25,000 for your own car.',
        buildingTarget: 'hospital',
        learningNote: 'Different lines of coverage protect different things; check what a plan pays for, not just its price.',
        options: hasLiability
          ? [
              { label: 'Upgrade to Full Coverage', description: '$145/mo, $1,000 deductible.', effect: insure('auto', 'auto_full') },
              DECLINE('Keep liability only'),
            ]
          : [
              { label: 'Add Liability Only', description: '$70/mo.', effect: insure('auto', 'auto_liability') },
              { label: 'Add Full Coverage', description: '$145/mo, $1,000 deductible.', effect: insure('auto', 'auto_full') },
              DECLINE('Stay uninsured'),
            ],
        expiresInMonths: 2,
      };
    },
  },
  {
    id: 'savings_nudge', building: 'bank', focus: ['emergency_fund', 'budgeting'],
    eligible: (s) => s.employmentStatus === 'employed' && monthly(s) >= 1000,
    build: (s) => {
      const bump = contribOffer(Math.max(25, monthly(s) * 0.03));
      const save = s.policy.savingsContributionPerMonth;
      const inv = s.policy.investmentContributionPerMonth;
      const more = contribOffer(save + bump);
      const less = contribOffer(Math.max(0, save - bump));
      return {
        title: 'Automatic transfer reminder',
        body: `You move ${fmtUsd(save)}/mo to savings and ${fmtUsd(inv)}/mo to investments; raising savings to ${fmtUsd(more)} builds your buffer faster, while ${fmtUsd(less)} leaves more cash.`,
        buildingTarget: 'bank',
        learningNote: 'Savings earn a small steady return and stay liquid; the contribution, not the rate, does most of the work early on.',
        options: [
          { label: `Raise to ${fmtUsd(more)}/mo`, description: 'Faster buffer.', effect: contrib(more, inv) },
          { label: `Lower to ${fmtUsd(less)}/mo`, description: 'More cash on hand.', effect: contrib(less, inv) },
          DECLINE('Keep it'),
        ],
        expiresInMonths: 2,
      };
    },
  },
  {
    id: 'rebalance_split', building: 'market', focus: ['allocation', 'investing_basics', 'concentration_risk'],
    eligible: (s) => s.policy.savingsContributionPerMonth + s.policy.investmentContributionPerMonth >= 50,
    build: (s) => {
      const save = s.policy.savingsContributionPerMonth;
      const inv = s.policy.investmentContributionPerMonth;
      const total = save + inv;
      const half = contribOffer(total * 0.5);
      const growth = contribOffer(total * 0.3);
      return {
        title: 'Rebalance your monthly habit',
        body: `You set aside ${fmtUsd(save)}/mo for savings and ${fmtUsd(inv)}/mo for investments; an even split is ${fmtUsd(half)} each, and a growth tilt is ${fmtUsd(growth)} to ${fmtUsd(contribOffer(total - growth))}.`,
        buildingTarget: 'market',
        learningNote: 'Savings are liquid and steady; investments grow more on average but swing. The right split depends on your buffer.',
        options: [
          { label: `Split evenly (${fmtUsd(half)}/${fmtUsd(half)})`, description: 'Balance liquidity and growth.', effect: contrib(half, half) },
          { label: 'Tilt to growth', description: `${fmtUsd(growth)} savings, ${fmtUsd(contribOffer(total - growth))} investments.`, effect: contrib(growth, contribOffer(total - growth)) },
          DECLINE('Keep current split'),
        ],
        expiresInMonths: 2,
      };
    },
  },
  {
    id: 'start_investing', building: 'market', focus: ['investing_basics', 'allocation'],
    eligible: (s) => s.policy.investmentContributionPerMonth === 0 && s.employmentStatus === 'employed' && s.monthsOfEssentialsCovered >= 3 && monthly(s) >= 1500,
    build: (s) => {
      const save = s.policy.savingsContributionPerMonth;
      const small = contribOffer(Math.max(25, monthly(s) * 0.02));
      const medium = contribOffer(Math.max(50, monthly(s) * 0.05));
      return {
        title: 'Open a brokerage account?',
        body: `Maple Market offers a no-minimum account, so investing ${fmtUsd(small)} or ${fmtUsd(medium)} a month would buy your target mix while your ${fmtUsd(save)}/mo savings transfer stays unchanged.`,
        buildingTarget: 'market',
        learningNote: 'Investment returns in the simulation are random around an average; a steady contribution matters more than timing.',
        options: [
          { label: `Start at ${fmtUsd(small)}/mo`, description: 'A small, steady start.', effect: contrib(save, small) },
          { label: `Start at ${fmtUsd(medium)}/mo`, description: 'A bigger commitment.', effect: contrib(save, medium) },
          DECLINE('Not yet'),
        ],
        expiresInMonths: 3,
      };
    },
  },
  {
    id: 'small_loan', building: 'bank', focus: ['debt_payoff', 'credit_cards', 'budgeting'],
    eligible: (s) => s.grossAnnualSalary >= 12000,
    build: (s) => {
      const principal = loanOffer(Math.min(3000, monthly(s) * 1.5), s);
      return {
        title: 'Laptop financing offer',
        body: `Your laptop died, and the store offers ${fmtUsd(principal)} of financing at 9% APR over 24 months or 18% APR over 12 months with a higher payment.`,
        buildingTarget: 'bank',
        learningNote: 'A loan converts one bill into many; the longer the term, the smaller each payment and the more interest in total.',
        options: [
          { label: '24 months at 9%', description: 'Smaller payment, more total interest.', effect: { template: 'loan_choice', principal, apr: 0.09, termMonths: 24, name: 'Laptop financing' } },
          { label: '12 months at 18%', description: 'Bigger payment, paid off sooner.', effect: { template: 'loan_choice', principal, apr: 0.18, termMonths: 12, name: 'Store card plan' } },
          DECLINE('Decline', 'No new borrowing.'),
        ],
        expiresInMonths: 1,
      };
    },
  },
  {
    id: 'consolidation', building: 'bank', focus: ['debt_payoff', 'credit_cards'],
    eligible: (s) => s.debtTotal >= 2000,
    build: (s) => {
      const principal = loanOffer(Math.min(10000, s.debtTotal), s);
      return {
        title: 'Consolidation offer',
        body: `A lender offers a ${fmtUsd(principal)} personal loan at 11% APR over 36 months, which adds cash now while your ${fmtUsd(s.debtTotal)} of existing debt stays until you repay it.`,
        buildingTarget: 'bank',
        learningNote: 'New borrowing adds a fixed payment and interest. It only helps if it replaces more expensive debt.',
        options: [
          { label: 'Take the loan', description: 'Adds a 36-month personal loan.', effect: { template: 'loan_choice', principal, apr: 0.11, termMonths: 36, name: 'Consolidation loan' } },
          DECLINE('Decline'),
        ],
        expiresInMonths: 2,
      };
    },
  },
];

export const FALLBACK_OPPORTUNITY_TEMPLATE_IDS: readonly string[] = TEMPLATES.map((t) => t.id);

/**
 * Rule-based Type B opportunity tied to the current state; null if nothing fits.
 * Urgent situations (unemployment, a shock with no coverage, a very thin buffer)
 * pick a matching template directly; otherwise the eligible templates rotate by
 * month with an archetype-specific offset, preferring templates that teach the
 * summary's narrativeFocus, so replays are stable and consecutive offers differ.
 */
export function fallbackOpportunity(s: StateSummary): OpportunityProposal | null {
  const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;
  const urgent: string[] = [];
  if (s.employmentStatus === 'unemployed') urgent.push('return_to_work');
  if (s.recentShocks.includes('medical') && s.insurance.health === null) urgent.push('open_enrollment');
  if (s.recentShocks.includes('auto') && s.insurance.auto === null) urgent.push('auto_coverage');
  if (s.recentShocks.includes('home') && s.insurance.renters === null) urgent.push('renters_flyer');
  // Nag about a thin buffer at most every third month so it does not crowd out everything else.
  if (s.monthsOfEssentialsCovered < 1.5 && s.monthIndex % 3 === 0) urgent.push('tight_month');
  for (const id of urgent) {
    const t = byId(id);
    if (t.eligible(s)) return t.build(s);
  }
  const eligible = TEMPLATES.filter((t) => t.id !== 'return_to_work' && t.id !== 'tight_month' && t.eligible(s));
  if (eligible.length === 0) return null;
  // One rotation over every eligible template, focus-relevant ones first, so the
  // archetype's lessons come early and consecutive months never repeat a template.
  const isFocused = (t: OppTemplate) => t.focus.some((f) => s.narrativeFocus.includes(f));
  const pool = [...eligible.filter(isFocused), ...eligible.filter((t) => !isFocused(t))];
  const offset = hashSeed(s.archetype ?? 'custom', 'fallback-opp') % pool.length;
  return pool[(offset + s.monthIndex) % pool.length]!.build(s);
}

// ---------------------------------------------------------------------------
// Explanations
// ---------------------------------------------------------------------------

export type ExplainTopic = 'savings' | 'debt' | 'investing' | 'insurance' | 'spending' | 'advice' | 'general';

/** Which template family a free-text question belongs to. Exported for tests. */
export function classifyQuestion(question: string | undefined): ExplainTopic {
  const q = (question ?? '').toLowerCase();
  if (!q.trim()) return 'general';
  if (/should i|what should|what would you|recommend|advice|best (thing|move|option|choice)|what do i do|what can i do|how (do|can|could) i (improve|fix|do better|be safer)|next time/.test(q)) return 'advice';
  if (/insur|deductible|premium|coverage|covered|medical|hospital|health plan/.test(q)) return 'insurance';
  if (/debt|loan|credit card|interest|apr|borrow|owe|payoff|pay off/.test(q)) return 'debt';
  if (/invest|stock|bond|etf|market|portfolio|allocation|return|volatil|risk|safer|steadier|stable|swing|spread/.test(q)) return 'investing';
  if (/saving|emergency|buffer|cushion|rainy|cash/.test(q)) return 'savings';
  if (/spend|budget|rent|housing|essential|discretionary|lifestyle|cost/.test(q)) return 'spending';
  return 'general';
}

type Mc = { median: number; p10: number; p90: number; probabilityNegativeNetWorth: number; probabilityLiquidityShortfall: number; observedNetWorth: number; percentileOfObserved?: number };

/** Closing note, at most 8 words, mirroring the AI prompt's rule. */
const DISCLAIMER = 'Demo figures are illustrative, not personal advice.';

const healthName = (id: string | null) => (id === 'health_basic' ? 'Basic Health' : id === 'health_plus' ? 'Plus Health' : id === 'health_family' ? 'Family Health' : id === null ? 'no health plan' : id);
const autoName = (id: string | null) => (id === 'auto_liability' ? 'liability-only auto' : id === 'auto_full' ? 'full auto coverage' : id === null ? 'no auto coverage' : id);

const BUFFER_LEVER = 'A buffer of roughly 3–6 months of essentials means a shock is paid from savings instead of borrowing, which lifts the unlucky ending; the trade-off is cash that earns little while it waits.';
const DEBT_LEVER = 'Paying the highest-rate debt first lowers the total interest charged each month, while keeping payments at the minimum leaves more cash free for shocks.';
const MIX_LEVER = (mc: Mc | undefined) => mc
  ? `A higher bond share usually narrows the spread between the lucky (${fmtUsd(mc.p90)}) and unlucky (${fmtUsd(mc.p10)}) endings but lowers the typical one; a stock-heavier mix does the reverse.`
  : 'A higher bond share usually narrows the spread of endings but lowers the typical one; a stock-heavier mix does the reverse.';
const COVER_LEVER = (mc: Mc | undefined) => mc
  ? `Coverage changes what a shock costs, never whether it happens: a fuller plan or lower deductible trims the bad-month bill (${fmtPct(mc.probabilityLiquidityShortfall)} of replays needed emergency borrowing), at the cost of higher premiums every month.`
  : 'Coverage changes what a shock costs, never whether it happens: a fuller plan or lower deductible trims the bad-month bill, at the cost of higher premiums every month.';
const SPEND_LEVER = 'Lower fixed costs raise the surplus in every month of every replay, so they move all three lines together; the trade-off is less room for the things that make a budget liveable.';

/** Two or three generally-true levers, each with its trade-off, anchored on this run's own figures. */
function leverSentences(topic: ExplainTopic, s: StateSummary, mc: Mc | undefined): string[] {
  const buffer = fmtMonths(s.monthsOfEssentialsCovered);
  const pol = s.policy;
  switch (topic) {
    case 'savings':
      return [
        `Your liquid buffer is ${fmtUsd(s.cash)} in cash plus ${fmtUsd(s.savings)} in savings, about ${buffer} of housing and essentials, with ${fmtUsd(pol.savingsContributionPerMonth)}/mo flowing into savings.`,
        BUFFER_LEVER,
      ];
    case 'debt':
      if (s.debtTotal <= 0) return ['You finished with no debt, so none of the gap between the unlucky and lucky endings comes from interest; it comes from income, spending and market luck.', DEBT_LEVER];
      return [`You carry ${fmtUsd(s.debtTotal)} of debt and pay ${fmtUsd(pol.extraDebtPaymentPerMonth)}/mo above the minimums.`, DEBT_LEVER];
    case 'investing':
      return [
        `Investments total ${fmtUsd(s.investmentsTotal)}, with ${fmtUsd(pol.investmentContributionPerMonth)}/mo added at a target mix of ${fmtPct(pol.targetAllocation.stock)} stock, ${fmtPct(pol.targetAllocation.bond)} bonds and ${fmtPct(pol.targetAllocation.etf)} ETF.`,
        MIX_LEVER(mc),
      ];
    case 'insurance':
      return [
        `You hold ${healthName(s.insurance.health)}, ${autoName(s.insurance.auto)} and ${s.insurance.renters ? 'renters insurance' : 'no renters insurance'}.`,
        COVER_LEVER(mc),
      ];
    case 'spending':
      return [
        `Each month you spend ${fmtUsd(s.housingMonthly)} on housing, ${fmtUsd(s.essentialsMonthly)} on essentials and ${fmtUsd(s.discretionaryMonthly)} on everything else, against a gross salary of ${fmtUsd(s.grossAnnualSalary)}/yr.`,
        SPEND_LEVER,
      ];
    case 'advice':
      return [
        `The levers that usually matter most are a cash buffer of 3–6 months of essentials (yours covers ${buffer}), which cuts forced borrowing but earns little while it waits; paying the highest-rate debt first${s.debtTotal > 0 ? ` (you carry ${fmtUsd(s.debtTotal)})` : ''}, which lowers interest but ties up cash; and a steadier investment mix, which narrows the spread of endings but lowers the typical one.`,
        s.insurance.health === null ? 'Health coverage turns a large medical bill into premiums paid every month, so it costs more in calm futures and far less in unlucky ones.' : SPEND_LEVER,
      ];
    default: {
      const out: string[] = [];
      if (s.monthsOfEssentialsCovered < 3) out.push(`Your liquid buffer covers about ${buffer} of housing and essentials; a buffer of 3–6 months pays shocks without borrowing, at the cost of cash that earns little.`);
      if (s.debtTotal > 0) out.push(`You carry ${fmtUsd(s.debtTotal)} of debt; paying the highest-rate debt first lowers total interest, while minimum payments keep more cash free.`);
      if (s.insurance.health === null) out.push('Without health coverage, medical shocks are paid in full; coverage changes the cost, not the chance, in exchange for premiums every month.');
      if (out.length < 2) out.push(MIX_LEVER(mc));
      return out.slice(0, 3);
    }
  }
}

/** One sentence naming a single change the what-if panel can test, tied to the lever just explained. */
function whatIfSentence(topic: ExplainTopic, s: StateSummary): string {
  const pick = topic === 'savings' ? 'a larger monthly savings contribution'
    : topic === 'debt' ? 'extra payments on the highest-rate debt'
    : topic === 'investing' ? 'a higher bond share'
    : topic === 'insurance' ? 'a different coverage level'
    : topic === 'spending' ? 'a cheaper place or a smaller discretionary budget'
    : s.monthsOfEssentialsCovered < 3 ? 'a larger monthly savings contribution' : s.debtTotal > 0 ? 'extra payments on the highest-rate debt' : 'a steadier investment mix';
  return `The what-if panel can test one change at a time, such as ${pick}, with the same luck in every future.`;
}

/**
 * Template explanation for the reveal (with Monte Carlo numbers) or a mid-game
 * insight (without), mirroring the AI prompt: what happened, two or three general
 * levers with their trade-offs, one what-if pointer, a short note. No new math.
 * A topic question is answered first; its levers come before the summary.
 */
export function fallbackExplanation(s: StateSummary, mc?: Mc, question?: string): string {
  const topic = classifyQuestion(question);
  const happened: string[] = [];
  if (mc) {
    const where = mc.percentileOfObserved !== undefined && Number.isFinite(mc.percentileOfObserved)
      ? `your run ended at ${fmtUsd(mc.observedNetWorth)}, above about ${fmtPct(mc.percentileOfObserved)} of those replays, which reflects luck as well as choices and is not a grade`
      : `your run ended at ${fmtUsd(mc.observedNetWorth)}, and where it sits among the replays reflects luck as well as choices, so it is not a grade`;
    happened.push(`Across 1,000 replays of your strategy under different luck, the typical ending (the median ending net worth) was ${fmtUsd(mc.median)}, the unlucky (10th percentile) and lucky (90th percentile) endings were ${fmtUsd(mc.p10)} and ${fmtUsd(mc.p90)}, and ${where}.`);
    happened.push(`About ${fmtPct(mc.probabilityNegativeNetWorth)} of replays ended with negative net worth and ${fmtPct(mc.probabilityLiquidityShortfall)} needed emergency borrowing at some point.`);
  } else {
    happened.push(`As of ${s.monthLabel}, your net worth is ${fmtUsd(s.netWorth)}: ${fmtUsd(s.cash)} cash, ${fmtUsd(s.savings)} savings and ${fmtUsd(s.investmentsTotal)} invested, less ${fmtUsd(s.debtTotal)} of debt.`);
  }
  const levers = leverSentences(topic, s, mc);
  const asked = topic !== 'general' && (question ?? '').trim().length > 0;
  return [...(asked ? [...levers, ...happened] : [...happened, ...levers]), whatIfSentence(topic, s), DISCLAIMER].join(' ');
}

/** Coach chat fallback: keyword-matched ELI5 answers built from the summary's own numbers (src/services/coachFallback.ts). */
export { fallbackCoach } from './coachFallback';
