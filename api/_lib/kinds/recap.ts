/**
 * AI kind `recap`: three news-wire sentences recapping the run from a condensed timeline.
 * Self-contained (no runtime imports from src/); registered by one line each in schemas.ts and handler.ts.
 */
import { z } from 'zod';
import { COMMON } from '../prompts.js';

export const MAX_TIMELINE_LINES = 25;

export const requestSchema = z.object({
  kind: z.literal('recap'),
  recap: z.object({
    months: z.number().int().min(0).max(600),
    startNetWorth: z.number().finite(),
    endNetWorth: z.number().finite(),
    timeline: z.array(z.object({
      month: z.number().int().min(0).max(600),
      label: z.string().max(10),
      event: z.string().min(1).max(160),
      amount: z.number().finite().optional(),
    }).strict()).max(MAX_TIMELINE_LINES),
  }).strict(),
});
export type RecapRequest = z.infer<typeof requestSchema>;

/** Reasoning models spend most of this on hidden reasoning; the visible answer is three sentences. */
export const maxTokens = 2000;
export const MAX_WORDS = 70;
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const sentences = (t: string) => (t.match(/[.!?](\s|$)/g) ?? []).length;
/** Three (two to four tolerated) sentences, at most 70 words (the prompt asks for 60), no exclamation marks. */
export const responseSchema = z.object({
  text: z.string().min(1).max(480)
    .refine((t) => words(t) <= MAX_WORDS, `at most ${MAX_WORDS} words`)
    .refine((t) => { const n = sentences(t); return n >= 2 && n <= 4; }, 'two to four sentences')
    .refine((t) => !t.includes('!'), 'no exclamation marks'),
});

export const system = `${COMMON}

Task: write a recap of the player's finished run as exactly THREE sentences, at most 60 words in total (each sentence under 22 words), from the timeline given. Pick the few facts that matter; leave the rest out rather than cramming.
Style, strictly: plain news-wire reporting, like this: "In a matter of minutes, visibility for people brave enough to go out onto streets in the Northeast deteriorated quickly Wednesday as whipping winds brought snow squalls. One moment people could see down the block, and the next, they could barely see their own hands. Minutes later, it was clear again."
- Concrete and past tense. Short declarative sentences. Name the specific months (use the given month labels as "in July 2026" style or "in month 7") and dollar amounts from the timeline.
- Order: what the player set up or changed first; then the shocks and the hard months (job loss, big bills, cash running short) and what changed after them; then how it ended, with the ending net worth versus the start.
- Use only the facts in the timeline; invent nothing. No adjectives piled up, no moralising, no praise, no advice, no second-guessing the player. Never use the words "journey", "resilient", "navigate", "rollercoaster", "testament". No exclamation marks. No fragments like "X. Y."; every sentence has a subject and a verb. No headings, no bullets, no quotation marks.`;

const usd = (n: number): string => { const v = Math.round(n); return v < 0 ? `-$${Math.abs(v).toLocaleString('en-US')}` : `$${v.toLocaleString('en-US')}`; };

export function user(req: RecapRequest): string {
  const r = req.recap;
  const lines = r.timeline.map((t) => `- month ${t.month} (${t.label}): ${t.event}${t.amount !== undefined ? ` [${usd(t.amount)}]` : ''}`);
  return [
    `Run length: ${r.months} months. Net worth at start ${usd(r.startNetWorth)}, at the end ${usd(r.endNetWorth)}.`,
    lines.length ? 'Timeline (month index, calendar month, event, amount):' : 'Timeline: the player changed nothing and no shocks were recorded.',
    ...lines,
    'Return {"text": "<three sentences, at most 60 words>"}.',
  ].join('\n');
}
