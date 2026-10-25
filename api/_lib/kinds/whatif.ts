/**
 * AI kind `whatif`: one plain-cause-and-effect sentence under the what-if result tiles.
 * Self-contained (no runtime imports from src/); registered by one line each in schemas.ts and handler.ts.
 */
import { z } from 'zod';
import { COMMON } from '../prompts.js';

const ending = z.object({ p10: z.number().finite(), median: z.number().finite(), p90: z.number().finite(), yourEvents: z.number().finite() }).strict();

export const requestSchema = z.object({
  kind: z.literal('whatif'),
  comparison: z.object({
    decisionLabel: z.string().min(1).max(120),
    alternativeLabel: z.string().min(1).max(120),
    original: ending,
    changed: ending,
    delta: ending.extend({ spread: z.number().finite() }),
    startNetWorth: z.number().finite(),
    months: z.number().int().min(1).max(600),
  }).strict(),
});
export type WhatIfRequest = z.infer<typeof requestSchema>;

/** Reasoning models spend most of this on hidden reasoning; the visible answer is one short line. */
export const maxTokens = 1500;
export const MAX_WORDS = 20;
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
/** One sentence, at most 20 words (the prompt asks for 18), no bullet fragments. */
export const responseSchema = z.object({
  text: z.string().min(1).max(160).refine((t) => words(t) <= MAX_WORDS, `at most ${MAX_WORDS} words`)
    .refine((t) => (t.match(/[.!?](\s|$)/g) ?? []).length <= 1, 'exactly one sentence'),
});

export const system = `${COMMON}

Task: the game took ONE of the player's past decisions, swapped in an ALTERNATIVE, and re-ran 1,000 futures with the same luck. Write ONE sentence, at most 18 words, that says what doing the ALTERNATIVE does and why that moved the endings the way they moved. The sentence is about the alternative, not about what the player actually did. Every delta given is "alternative minus what the player did": a positive typical delta means the alternative ended richer.
Style, strictly: explain-like-I'm-five cause and effect. Small everyday words. Shape: "<what the change does each month> means <what that does to the ending> and <what it does to risk>." Examples of the tone:
- "Saving more each month means less cash now but a fatter cushion when a shock hits."
- "Paying the loan faster means less interest piles up, so the typical ending climbs."
- "Dropping insurance keeps the premium money, but one bad bill can wipe that out."
Rules: no numbers unless one is essential; no jargon (no "volatility", "percentile", "allocation", "liquidity"); do not use the pattern "X. Y." or two fragments joined by "=" or dashes; one complete sentence that ends with a period; no exclamation marks; no advice ("you should"), no guarantees, no comment on the player's motives. Read the direction from the signs: a positive median delta means the typical ending went up; a negative spread delta means the futures ended closer together (less risky); "your run" is the player's exact luck with the change.`;

const usd = (n: number): string => { const v = Math.round(n); return v < 0 ? `-$${Math.abs(v).toLocaleString('en-US')}` : `$${v.toLocaleString('en-US')}`; };
const signed = (n: number): string => (Math.round(n) >= 0 ? `+${usd(n)}` : usd(n));
const direction = (n: number, up: string, down: string, same: string): string => (Math.round(n) > 0 ? up : Math.round(n) < 0 ? down : same);

export function user(req: WhatIfRequest): string {
  const c = req.comparison;
  return [
    `What the player actually did: ${c.decisionLabel}`,
    `ALTERNATIVE being explained (the sentence is about this): ${c.alternativeLabel}`,
    `All numbers below are alternative minus actual.`,
    `Horizon: ${c.months} months, starting net worth ${usd(c.startNetWorth)}.`,
    `Typical ending: ${usd(c.original.median)} -> ${usd(c.changed.median)} (${signed(c.delta.median)}, ${direction(c.delta.median, 'better', 'worse', 'unchanged')}).`,
    `Unlucky ending (10th pct): ${usd(c.original.p10)} -> ${usd(c.changed.p10)} (${signed(c.delta.p10)}).`,
    `Lucky ending (90th pct): ${usd(c.original.p90)} -> ${usd(c.changed.p90)} (${signed(c.delta.p90)}).`,
    `Spread between unlucky and lucky: ${signed(c.delta.spread)} (${direction(c.delta.spread, 'wider, more risky', 'narrower, less risky', 'unchanged')}).`,
    `Player's own luck with the change: ${usd(c.original.yourEvents)} -> ${usd(c.changed.yourEvents)} (${signed(c.delta.yourEvents)}).`,
    `Return {"text": "<one sentence, at most 18 words, about choosing '${c.alternativeLabel}'>"}.`,
  ].join('\n');
}
