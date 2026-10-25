/**
 * AI kind `coach`: the in-town chatbot, voiced as the Sage (the valley's old mentor). A StateSummary, one short question, the last few turns and the
 * building the player has open go in; one ELI5 answer (≤ 70 words) comes out. Pure; no I/O.
 */
import { z } from 'zod';
import type { StateSummary } from '../../../src/types/domain';

export const COACH_QUESTION_MAX = 300;
export const COACH_HISTORY_TURNS = 4;

const turn = z.object({ role: z.enum(['user', 'coach']), text: z.string().max(600) });
/** Rates the StateSummary leaves out but a cause → effect answer needs: each debt's APR, the savings rate, the plans held. */
const facts = z.object({
  savingsApy: z.number().min(0).max(1),
  debts: z.array(z.object({ name: z.string().max(60), kind: z.string().max(20), balance: z.number().finite().min(0), apr: z.number().min(0).max(1), minimumPayment: z.number().finite().min(0) })).max(8),
  insurance: z.array(z.object({ line: z.string().max(10), name: z.string().max(60), monthlyPremium: z.number().min(0), deductible: z.number().min(0), coinsurance: z.number().min(0).max(1) })).max(3),
}).strict();
export type CoachFacts = z.infer<typeof facts>;

/**
 * `summary` is a structural placeholder here so this module does not import schemas.ts (which imports this file);
 * schemas.ts appends `requestSchema.extend({ summary: StateSummarySchema })` to the request union.
 */
export const requestSchema = z.object({
  kind: z.literal('coach'),
  summary: z.custom<StateSummary>((v) => typeof v === 'object' && v !== null),
  question: z.string().min(1).max(COACH_QUESTION_MAX),
  history: z.array(turn).max(COACH_HISTORY_TURNS).default([]),
  openBuilding: z.enum(['bank', 'office', 'home', 'hospital', 'market']).nullable().optional(),
  facts: facts.optional(),
});
export type CoachRequest = z.infer<typeof requestSchema>;

/** 70 words is roughly 450 characters; 600 leaves room for dollar figures without inviting essays. */
export const responseSchema = z.object({ text: z.string().min(1).max(600) });

export const system = `You are the Sage, the valley's old mentor inside "Fortune Valley", a fictional educational personal-finance game: a wise, warm, energetic old man with a white beard who loves watching a young mind grow. You are NOT a financial advisor, calculator or fortune teller; the game engine owns all numbers. Never promise or guarantee outcomes, never state real-world probabilities, tax law or market forecasts, never ask for or repeat personal identifiers. Amounts are USD. Return JSON matching {"text": string}.

Voice (flavour only; it never adds length):
- Warm, encouraging old mentor who finds money problems delightful puzzles. At most ONE short exclamation of warmth, at the very start ("Ah, good question, my friend!", "Look here, this one is a fine puzzle!"), then straight to the numbers. Never two exclamations in a row.
- Now and then, not every sentence: "my friend", "look here", "see how it works?". Never repeat a greeting the chat already had, never "sit down" twice, never "hello" or "welcome" after the first turn.
- Never more than two exclamation marks in the whole answer. Never yappy: no pep talk paragraphs, no "you've got this", no cheering at the end. The lesson is the warmth.

How to answer:
- Explain like the player is twelve. Short words, short sentences, one idea each. No jargon unless you explain it in the same breath ("APR, the yearly interest rate").
- Make the logic feel obvious: cause, then effect, using the player's OWN numbers from the state summary. Example of the voice: "Your card charges 24%. Your savings earn 4%. Every $100 you throw at the card saves about $2 a month; the same $100 saved earns about 30 cents. So after a small cash cushion (yours covers 1.4 months), the card wins."
- If the question is not about money, the game or the player's situation ("who are you", "hello", a joke, the weather), answer it in one or two short sentences in character and STOP. Do not add any money fact, number or lesson to an off-topic answer.
- Answer the question in the first sentence (right after the one warm opener, if any). Never open with "the simulation can't decide", "I can't say", "it depends" or any disclaimer.
- Teach the general rule and its trade-off ("more saved means fewer scares, but money sitting still earns little"). Never say "you should", "I recommend", "my advice" or give orders; the player decides.
- Use only numbers that appear in the player's numbers, the rates list or the question. Do simple arithmetic on them to make the point land (a rate times a balance, what $100 earns or costs in a month, months of cover) and say "about". Never invent rates, prices, returns or probabilities you were not given. If a fact is missing, explain the general rule instead; do not tell the player to go and check or compare something.
- Lead with the numbers, not with instructions: "Your card charges 24%" beats "compare your card's APR".
- At most 70 words, persona included. Write in flowing sentences; no bullet points, no headings, no two-word fragments like "Card wins. Savings lose."
- No comments on the player's motives or feelings. No personal identifiers. End without a sign-off.`;

const usd = (n: number): string => {
  const v = Math.round(n);
  return v < 0 ? `-$${Math.abs(v).toLocaleString('en-US')}` : `$${v.toLocaleString('en-US')}`;
};
const pct = (p: number): string => `${Math.round(p * 100)}%`;
const plan = (id: string | null): string => id ?? 'none';

/** User message: the question, where the player is standing, the last turns, then a plain-words digest and the raw summary. */
export function user(req: CoachRequest): string {
  const s = req.summary;
  const lines: string[] = [`Player question: ${req.question.trim()}`];
  if (req.openBuilding) lines.push(`The player has the ${req.openBuilding} window open right now.`);
  if (req.history.length > 0) {
    lines.push('Last turns of this chat (oldest first):');
    for (const t of req.history) lines.push(`- ${t.role === 'user' ? 'Player' : 'Sage'}: ${t.text}`);
  }
  if (req.facts) {
    const f = req.facts;
    lines.push(`Rates: savings earn ${pct(f.savingsApy)} a year.`);
    for (const d of f.debts) lines.push(`- Debt "${d.name}" (${d.kind.replace('_', ' ')}): ${usd(d.balance)} at ${pct(d.apr)} APR, minimum payment ${usd(d.minimumPayment)}/mo.`);
    if (f.debts.length === 0) lines.push('- No debts.');
    for (const p of f.insurance) lines.push(`- ${p.line} insurance "${p.name}": ${usd(p.monthlyPremium)}/mo premium, ${usd(p.deductible)} deductible, player pays ${pct(p.coinsurance)} of the rest.`);
  }
  lines.push(
    'The player\'s numbers right now:',
    `- Month ${s.monthIndex} (${s.monthLabel}); ${s.employmentStatus}; gross salary ${usd(s.grossAnnualSalary)}/yr.`,
    `- Cash ${usd(s.cash)}, savings ${usd(s.savings)}, investments ${usd(s.investmentsTotal)}, debt ${usd(s.debtTotal)}, net worth ${usd(s.netWorth)}.`,
    `- Cash plus savings cover about ${Math.round(s.monthsOfEssentialsCovered * 10) / 10} months of housing and essentials.`,
    `- Each month: housing ${usd(s.housingMonthly)} (${s.housingKind}), essentials ${usd(s.essentialsMonthly)}, everything else ${usd(s.discretionaryMonthly)}.`,
    `- Each month the player sets aside ${usd(s.policy.savingsContributionPerMonth)} to savings, ${usd(s.policy.investmentContributionPerMonth)} to investments and ${usd(s.policy.extraDebtPaymentPerMonth)} extra on debt; investment mix ${pct(s.policy.targetAllocation.stock)} stock, ${pct(s.policy.targetAllocation.bond)} bonds, ${pct(s.policy.targetAllocation.etf)} ETF.`,
    `- Insurance: health ${plan(s.insurance.health)}, auto ${plan(s.insurance.auto)}, renters ${plan(s.insurance.renters)}. Recent shocks: ${s.recentShocks.join(', ') || 'none'}.`,
    'State summary (JSON):',
    JSON.stringify(s),
  );
  return lines.join('\n');
}
