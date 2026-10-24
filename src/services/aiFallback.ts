/**
 * Offline fallback generators. Deterministic, rule-based, clearly labeled
 * source:'fallback'. Used when the AI gateway is disabled, offline, times out,
 * or returns schema-invalid data. Owner: Agent 1.
 */
import type { ArchetypeId, OpportunityProposal, PersonalizedInput, ScenarioProposal, StateSummary } from '@/types/domain';
import { hashSeed } from '@/engine/rng';

const clampNum = (n: number | undefined, min: number, max: number): number | undefined =>
  n === undefined || !Number.isFinite(n) ? undefined : Math.min(max, Math.max(min, n));

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

/** Rule-based Type B opportunity tied to the current state; null if nothing fits. */
export function fallbackOpportunity(s: StateSummary): OpportunityProposal | null {
  const pick = hashSeed(s.monthIndex, s.netWorth, 'fallback-opp') % 5;
  if (s.employmentStatus === 'unemployed') {
    const pay = Math.round((s.grossAnnualSalary * 0.9) / 500) * 500;
    return {
      title: 'A quicker way back to work',
      body: `A recruiter offers a role at $${pay.toLocaleString()}/yr — about 10% less than your last job — starting next month. Taking it ends unemployment now; declining means waiting for a role at your old pay.`,
      buildingTarget: 'office',
      learningNote: 'Income stability versus holding out for a higher salary. There is no single right answer; the simulation shows the cash effect.',
      options: [
        { label: `Take the $${pay.toLocaleString()} role`, description: 'Resume full income now at lower pay.', effect: { template: 'offer_job', grossAnnualSalary: pay, title: 'New role (recruiter offer)' } },
        { label: 'Keep searching', description: 'Stay on reduced benefits until your usual role returns.', effect: { template: 'none' } },
      ],
      expiresInMonths: 1,
    };
  }
  if (s.monthsOfEssentialsCovered < 2 && s.discretionaryMonthly >= 100) {
    const cut = Math.round((s.discretionaryMonthly * 0.6) / 10) * 10;
    return {
      title: 'Tight month ahead',
      body: `Your cash plus savings covers about ${s.monthsOfEssentialsCovered} months of housing and essentials. Trimming discretionary spending from $${s.discretionaryMonthly.toLocaleString()} to $${cut.toLocaleString()} would rebuild a buffer faster.`,
      buildingTarget: 'home',
      learningNote: 'Emergency funds are built from the gap between income and spending; small recurring cuts compound.',
      options: [
        { label: `Trim to $${cut}/mo`, description: 'Lower lifestyle spending for now.', effect: { template: 'budget_choice', discretionaryMonthly: cut } },
        { label: 'Keep current spending', description: 'No change.', effect: { template: 'none' } },
      ],
      expiresInMonths: 2,
    };
  }
  if (s.insurance.health === null && s.complexityLevel >= 1) {
    return {
      title: 'Open enrollment',
      body: 'You currently have no health coverage. A basic high-deductible plan costs $180/month and caps your out-of-pocket per claim; going without saves the premium but leaves you exposed to the full cost of a medical shock.',
      buildingTarget: 'hospital',
      learningNote: 'Insurance trades a certain premium for a cap on uncertain costs. It changes what you pay, never whether something happens.',
      options: [
        { label: 'Enroll in Basic Health', description: '$180/mo, $4,000 deductible.', effect: { template: 'change_insurance', line: 'health', planId: 'health_basic' } },
        { label: 'Stay uninsured', description: 'Keep the premium in your pocket.', effect: { template: 'none' } },
      ],
      expiresInMonths: 2,
    };
  }
  switch (pick) {
    case 0: {
      const pay = Math.round((s.grossAnnualSalary * 1.08) / 500) * 500;
      const housing = Math.round((s.housingMonthly * 1.15) / 10) * 10;
      return {
        title: 'Offer from across town',
        body: `A competitor offers $${pay.toLocaleString()}/yr (about 8% more), but the commute means moving closer: rent would rise to about $${housing.toLocaleString()}/mo.`,
        buildingTarget: 'office',
        learningNote: 'Compare the after-tax raise with the increase in fixed costs, not the headline salary.',
        options: [
          { label: 'Accept and move', description: 'Higher pay, higher rent.', effect: { template: 'offer_job', grossAnnualSalary: pay, title: 'Competitor role' } },
          { label: 'Stay put', description: 'No change.', effect: { template: 'none' } },
        ],
        expiresInMonths: 2,
      };
    }
    case 1: {
      const cheaper = Math.round((s.housingMonthly * 0.82) / 10) * 10;
      return {
        title: 'A smaller place opens up',
        body: `A friend's building has a smaller unit for about $${cheaper.toLocaleString()}/mo versus your $${s.housingMonthly.toLocaleString()}. Less space, more room in the budget.`,
        buildingTarget: 'home',
        learningNote: 'Housing is usually the largest fixed cost; reducing it frees cash every month for the rest of the run.',
        options: [
          { label: 'Move to the smaller unit', description: 'Lower rent from next month.', effect: { template: 'change_housing', housingMonthly: cheaper, housingKind: s.housingKind === 'own' ? 'rent' : s.housingKind } },
          { label: 'Stay', description: 'No change.', effect: { template: 'none' } },
        ],
        expiresInMonths: 2,
      };
    }
    case 2: {
      const save = s.policy.savingsContributionPerMonth;
      const inv = s.policy.investmentContributionPerMonth;
      const shifted = Math.round((save + inv) * 0.5 / 10) * 10;
      return {
        title: 'Rebalance your monthly habit',
        body: `You currently set aside $${save}/mo to savings and $${inv}/mo to investments. Would you split it evenly ($${shifted} each) to balance liquidity and growth?`,
        buildingTarget: 'bank',
        learningNote: 'Savings are liquid and steady; investments grow more on average but swing. The right split depends on your buffer.',
        options: [
          { label: `Split evenly ($${shifted}/$${shifted})`, description: 'Adjust the persistent policy.', effect: { template: 'contribution_choice', savingsContributionPerMonth: shifted, investmentContributionPerMonth: shifted } },
          { label: 'Keep current split', description: 'No change.', effect: { template: 'none' } },
        ],
        expiresInMonths: 2,
      };
    }
    case 3: {
      if (s.insurance.renters !== null) return null;
      return {
        title: 'Renters insurance flyer',
        body: 'Your building offers renters insurance at $18/month with a $500 deductible, covering theft and damage up to $20,000.',
        buildingTarget: 'home',
        learningNote: 'Cheap coverage for rare, expensive events is often where insurance adds the most value; the simulation lets you see both outcomes.',
        options: [
          { label: 'Add renters insurance', description: '$18/mo.', effect: { template: 'change_insurance', line: 'renters', planId: 'renters_basic' } },
          { label: 'Skip it', description: 'No change.', effect: { template: 'none' } },
        ],
        expiresInMonths: 2,
      };
    }
    default: {
      if (s.debtTotal <= 0) return null;
      return {
        title: 'Consolidation offer',
        body: `A lender offers a $${Math.min(10000, Math.round(s.debtTotal / 500) * 500).toLocaleString()} personal loan at 11% APR over 36 months. The cash lands in your account; you decide what to do with it. (Your existing debts remain.)`,
        buildingTarget: 'bank',
        learningNote: 'New borrowing adds a fixed payment and interest. It only helps if it replaces more expensive debt — which you would have to pay down yourself.',
        options: [
          { label: 'Take the loan', description: 'Adds a 36-month personal loan.', effect: { template: 'loan_choice', principal: Math.min(10000, Math.round(s.debtTotal / 500) * 500), apr: 0.11, termMonths: 36, name: 'Consolidation loan' } },
          { label: 'Decline', description: 'No change.', effect: { template: 'none' } },
        ],
        expiresInMonths: 2,
      };
    }
  }
}

export function fallbackExplanation(s: StateSummary, mc?: { median: number; p10: number; p90: number; probabilityNegativeNetWorth: number; probabilityLiquidityShortfall: number; observedNetWorth: number; percentileOfObserved?: number }): string {
  const parts: string[] = [];
  if (mc) {
    const pct = mc.percentileOfObserved !== undefined ? ` Your actual run ended above about ${Math.round(mc.percentileOfObserved * 100)}% of those paths — that reflects luck as well as choices, so it is not a grade.` : '';
    parts.push(`Across 1,000 replays of your strategy with different luck, the median ending net worth was $${Math.round(mc.median).toLocaleString()} (10th–90th percentile: $${Math.round(mc.p10).toLocaleString()} to $${Math.round(mc.p90).toLocaleString()}).${pct}`);
    parts.push(`About ${Math.round(mc.probabilityNegativeNetWorth * 100)}% of paths ended with negative net worth and ${Math.round(mc.probabilityLiquidityShortfall * 100)}% needed emergency borrowing at some point.`);
  }
  if (s.monthsOfEssentialsCovered < 3) parts.push(`Your liquid buffer covers about ${s.monthsOfEssentialsCovered} months of housing and essentials; shocks in the simulation hit harder below roughly three months.`);
  if (s.debtTotal > 0) parts.push(`You carry $${Math.round(s.debtTotal).toLocaleString()} of debt; interest accrues every month before payments, so extra payments reduce future interest.`);
  if (s.insurance.health === null) parts.push('Without health coverage, medical shocks are paid in full; coverage changes the cost, not the chance.');
  parts.push('All figures use the illustrative demo assumptions listed in the reveal; they are not forecasts or personal advice.');
  return parts.join(' ');
}
