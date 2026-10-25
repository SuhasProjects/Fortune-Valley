/**
 * Offline Coach: keyword-matched ELI5 answers for the common questions, built from the summary's own numbers in
 * the same cause → effect voice as the AI prompt (api/_lib/kinds/coach.ts). Deterministic, no new finance math
 * beyond percentages of the player's own figures and the demo savings rate from config.
 */
import type { BuildingId, CoachFacts, StateSummary } from '@/types/domain';
import { DEFAULT_ASSUMPTIONS, INSURANCE_PLANS } from '@/config/defaults';

export type CoachTopic = 'save_vs_debt' | 'insurance' | 'allocation' | 'emergency_fund' | 'budget' | 'job_loss' | 'loans' | 'what_if' | 'general';

/** Which answer family a question belongs to. Exported for tests. */
export function classifyCoachQuestion(question: string, openBuilding: BuildingId | null = null): CoachTopic {
  const q = question.toLowerCase();
  if (/what (happens |would happen )?if|what-if|suppose|instead|more|less|double|cut (my )?(savings|saving)/.test(q) && /sav|invest|pay|spend|rent|budget/.test(q) && !/card|debt|loan|insur/.test(q)) return 'what_if';
  if (/(card|debt|loan).*(save|saving)|(save|saving).*(card|debt|loan)|pay (down|off).*(or|vs)|or save/.test(q)) return 'save_vs_debt';
  if (/insur|deductible|premium|coverage|covered|health plan|renters|liability/.test(q)) return 'insurance';
  if (/alloc|stock|bond|etf|mix|portfolio|invest|market|diversif|risk/.test(q)) return 'allocation';
  if (/emergency|cushion|buffer|rainy|how much (cash|should i save|savings)|months? of/.test(q)) return 'emergency_fund';
  if (/job|laid off|unemploy|lose my (job|income)|fired|income stop/.test(q)) return 'job_loss';
  if (/loan|borrow|apr|interest|credit card|debt|owe|consolidat/.test(q)) return 'loans';
  if (/budget|spend|rent|cut|cheaper|afford|discretionary|essentials|cost/.test(q)) return 'budget';
  if (openBuilding === 'hospital') return 'insurance';
  if (openBuilding === 'market') return 'allocation';
  if (openBuilding === 'bank') return 'emergency_fund';
  if (openBuilding === 'home') return 'budget';
  if (openBuilding === 'office') return 'job_loss';
  return 'general';
}

const usd = (n: number): string => {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  const abs = Math.abs(v).toLocaleString('en-US');
  return v < 0 ? `-$${abs}` : `$${abs}`;
};
/** Small dollar amounts with cents, e.g. 0.33 → "0.33", 2 → "2". */
const dollars = (n: number): string => (Math.round(n * 100) / 100).toString();
const pct = (p: number): string => `${Math.round(p * 100)}%`;
const months = (m: number): string => {
  const v = Number.isFinite(m) ? Math.round(m * 10) / 10 : 0;
  return `${v} month${v === 1 ? '' : 's'}`;
};
const plan = (id: string | null) => INSURANCE_PLANS.find((p) => p.id === id);

/** One short ELI5 answer (≤ 70 words) for the matched topic, using only the summary's figures. */
export function fallbackCoach(s: StateSummary, question: string, openBuilding: BuildingId | null = null, facts?: CoachFacts): string {
  const topic = classifyCoachQuestion(question, openBuilding);
  const cover = months(s.monthsOfEssentialsCovered);
  const fixed = s.housingMonthly + s.essentialsMonthly;
  const apy = facts?.savingsApy ?? DEFAULT_ASSUMPTIONS.savingsApy;
  const saveEarns = dollars((100 * apy) / 12); // what $100 earns in a month at the demo rate
  const top = facts?.debts.filter((d) => d.balance > 0).sort((a, b) => b.apr - a.apr)[0]; // highest-rate debt
  switch (topic) {
    case 'save_vs_debt':
      if (s.debtTotal <= 0) return `You have no debt right now, so that choice is easy: there is nothing charging you interest. Your savings earn about ${pct(apy)} a year, so every $100 you save earns about ${saveEarns} dollars a month. Saving builds a cushion; yours covers ${cover} of housing and essentials. More cushion means fewer scares, but money sitting still grows slowly.`;
      if (top) return `Your ${top.name.toLowerCase()} charges ${pct(top.apr)} a year. Your savings earn ${pct(apy)}. Every $100 you throw at that debt saves about ${dollars((100 * top.apr) / 12)} dollars a month; the same $100 saved earns about ${saveEarns}. So the debt wins on rate. The trade-off is a cash cushion: yours covers ${cover} of essentials, and a cushion keeps a surprise from becoming new debt.`;
      return `Debt charges you interest every month; savings pay you interest, and the debt rate is almost always the bigger one. Your savings earn about ${pct(apy)} a year, so $100 saved earns about ${saveEarns} dollars a month, while $100 paid off a loan stops its interest for good. The trade-off is a cushion: yours covers ${cover}. Past that, the ${usd(s.debtTotal)} of debt is where each dollar does most.`;
    case 'insurance': {
      const h = plan(s.insurance.health);
      const have = h ? `${h.name} costs ${usd(h.monthlyPremium)} a month, and a hospital bill costs you the ${usd(h.deductible)} deductible plus ${pct(h.coinsurance)} of the rest` : 'you have no health plan, so a medical shock is paid in full from your cash';
      return `Insurance swaps a small, certain cost for protection against a big surprise. ${have[0]!.toUpperCase()}${have.slice(1)}. A cheaper plan saves premiums in calm months but makes a bad month cost more; a fuller plan does the reverse. You hold ${usd(s.cash + s.savings)}, so that is the size of surprise you could cover alone.`;
    }
    case 'allocation': {
      const a = s.policy.targetAllocation;
      return `Your mix is ${pct(a.stock)} stock, ${pct(a.bond)} bonds and ${pct(a.etf)} ETF, with ${usd(s.policy.investmentContributionPerMonth)} added a month. Stocks swing the most, so they can grow faster and fall harder; bonds move less, so they steady the ride but grow slower. More bonds narrows the gap between your best and worst future; more stocks widens it. Investments total ${usd(s.investmentsTotal)} today.`;
    }
    case 'emergency_fund':
      return `An emergency fund is cash that pays for a surprise so you do not borrow. Your housing and essentials cost ${usd(fixed)} a month, and your cash plus savings cover about ${cover} of that. Three to six months is the usual rule of thumb. A bigger cushion means a shock never becomes a loan; the cost is money earning only about ${pct(apy)} while it waits.`;
    case 'budget':
      return `Each month you spend ${usd(s.housingMonthly)} on housing, ${usd(s.essentialsMonthly)} on essentials and ${usd(s.discretionaryMonthly)} on everything else. Cutting the "everything else" part frees cash right away, since each dollar you do not spend is one you keep. Rent is the biggest lever but the hardest to move. The trade-off is that a tighter budget is harder to stick to month after month.`;
    case 'job_loss':
      if (s.employmentStatus === 'unemployed') return `With no pay coming in, your ${usd(fixed)} a month of housing and essentials comes straight out of cash and savings, which cover about ${cover}. Every month without work shrinks that number. Cutting spending stretches it, and the Town Office shows what work is open. A cushion built before a job loss is what makes one survivable.`;
      return `If your pay stopped, your ${usd(fixed)} a month of housing and essentials would come out of cash and savings, which cover about ${cover} right now. That number is how long you could wait for the next job without borrowing. Saving more stretches it; spending less stretches it too. The trade-off is less to enjoy in the months when everything is fine.`;
    case 'loans':
      if (s.debtTotal <= 0) return `A loan is money you use now and pay back later with interest, which is the fee for borrowing. You carry no debt right now, so nothing is charging you that fee. Borrowing can be worth it for something that pays you back, like a car to reach work; it is costly when it just stretches spending. Pine Bank shows the rates on offer.`;
      return `Interest is the fee a loan charges every month it is open; the higher the rate, the bigger the fee on every dollar still owed. You owe ${usd(s.debtTotal)}${top ? `, and your ${top.name.toLowerCase()} at ${pct(top.apr)} costs about ${usd((top.balance * top.apr) / 12)} a month in interest alone` : ''}. Paying the highest-rate debt first shrinks that fee fastest; paying only minimums keeps more cash free today but costs more over time.`;
    case 'what_if':
      return `Saving more means more cash goes into savings each month, so the cushion grows and a surprise is less likely to become a loan. You now save ${usd(s.policy.savingsContributionPerMonth)} a month and your cushion covers ${cover}. The trade-off is less for everything else, which is ${usd(s.discretionaryMonthly)} a month today. The what-if panel at the end shows both futures side by side.`;
    default:
      return `Money in this town works in a loop: pay comes in, housing and essentials go out, and what is left becomes savings, investments or debt payments. Right now you have ${usd(s.cash)} cash, ${usd(s.savings)} saved and ${usd(s.debtTotal)} of debt, and your cushion covers ${cover}. Ask about saving, debt, insurance, investing or your budget and I will use your own numbers.`;
  }
}
