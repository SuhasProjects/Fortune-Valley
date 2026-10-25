/**
 * `flavour` kind: a short news-wire scene for a shock the engine already priced.
 * The model never changes numbers; the amount is quoted back as given.
 */
import { z } from 'zod';

export const requestSchema = z.object({
  kind: z.literal('flavour'),
  shock: z.object({
    kind: z.enum(['medical', 'auto', 'home', 'job_loss']),
    /** Gross cost in USD as the engine computed it (0 for job loss). */
    amount: z.number().finite().min(0).max(10_000_000),
    monthLabel: z.string().max(10),
    archetype: z.enum(['college_student', 'entry_worker', 'professional', 'young_family']).optional(),
    housingKind: z.enum(['rent', 'dorm', 'family', 'own']),
    hasCar: z.boolean(),
    employment: z.enum(['employed', 'unemployed', 'student']),
  }).strict(),
});
export type FlavourRequest = z.infer<typeof requestSchema>;

export const responseSchema = z.object({
  headline: z.string().min(1).max(60),
  scene: z.string().min(1).max(260),
});

export const system = `You write two-sentence wire-service items for "Fortune Valley", a fictional personal-finance simulation. The game engine has already decided what happened and what it cost; you only describe it.
Style: plain news reporting, like a regional wire desk. Past tense. Short declarative sentences with concrete nouns (a tree limb, the windshield, the water heater, the night shift, a broken wrist). State the dollar figure once, plainly, exactly as given. No adjectives piled up, no jokes, no moral, no advice, no exclamation marks, no second-person address ("you"), no "X. Y." fragment pairs, no quotation marks, no names of real people, companies, towns or hospitals.
Output: "headline" of 3 to 5 words in sentence case (capitalise only the first word), plain, no period, no month name. "scene" of 1 or 2 complete sentences, 32 words at most, that says what happened and what it cost. For job_loss there is no dollar amount; report the cut (shift, contract, plant line, department) and when pay stopped instead.
Do not restate the household facts (housing, car, job status) as facts; use them only to choose a fitting incident. Never write "household", "the player", "the individual" or "the user"; refer to the car, the apartment, the house, the room, the position, the wrist.
Fit the facts: a medical shock is an injury or illness and a bill; an auto shock is damage to or by the player's car; a home shock is theft or damage where the player lives (a dorm room, a rented flat, the family house, their own home); job_loss is the employer cutting the position. Vary the incident with the month and the amount: small sums are small incidents, large sums are serious ones.`;

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

export function user(req: FlavourRequest): string {
  const s = req.shock;
  const facts = [
    `Shock: ${s.kind}`,
    s.kind === 'job_loss' ? 'Amount: none (lost income, no bill)' : `Amount: ${usd(s.amount)} (quote exactly once)`,
    `Month: ${s.monthLabel}`,
    `Household: ${s.archetype ?? 'custom'}, housing ${s.housingKind}, ${s.hasCar ? 'owns a car' : 'no car'}, ${s.employment}`,
  ];
  return `${facts.join('\n')}\nReturn JSON {"headline","scene"}.`;
}
