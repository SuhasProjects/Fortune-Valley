/**
 * `flavour` kind: a short news-wire scene for a shock the engine already priced, or for a
 * life event (kind `life`: a small unavoidable cost when amount < 0, a small gift when > 0).
 * The model never changes numbers; the amount is quoted back as given.
 */
import { z } from 'zod';

export const requestSchema = z.object({
  kind: z.literal('flavour'),
  shock: z.object({
    kind: z.enum(['medical', 'auto', 'home', 'job_loss', 'life']),
    /** Gross cost in USD as the engine computed it (0 for job loss); signed for `life` (gift > 0, cost < 0). */
    amount: z.number().finite().min(-10_000_000).max(10_000_000),
    monthLabel: z.string().max(10),
    archetype: z.enum(['college_student', 'entry_worker', 'professional', 'young_family']).optional(),
    housingKind: z.enum(['rent', 'dorm', 'family', 'own']),
    hasCar: z.boolean(),
    employment: z.enum(['employed', 'unemployed', 'student']),
    /** Life-event template id (e.g. birthday_gift, vet_visit); the engine's rules already chose it. */
    templateId: z.string().regex(/^[a-z_]{1,40}$/).optional(),
    /** Shock variant tag (e.g. wrist, windshield, break_in). */
    variant: z.string().regex(/^[a-z_]{1,40}$/).optional(),
    /** The run's fixed household facts (no names). */
    household: z.object({
      archetype: z.enum(['college_student', 'entry_worker', 'professional', 'young_family']).optional(),
      birthMonth: z.number().int().min(1).max(12),
      pet: z.enum(['none', 'cat', 'dog']),
      hobby: z.string().regex(/^[a-z_]{1,24}$/),
      hasKids: z.boolean(),
      commute: z.enum(['car', 'transit', 'bike']),
      circle: z.array(z.string().regex(/^[a-z ]{1,24}$/)).min(1).max(2),
    }).strict().optional(),
    /** Headlines of the last few scenes in this run (≤ 6, ≤ 60 chars each). */
    previousScenes: z.array(z.string().max(60)).max(6).optional(),
    /** Offline-only hints the browser may also send; ignored by the prompt. */
    occurrence: z.number().int().min(0).max(1000).optional(),
    runSeed: z.number().int().min(0).max(4_294_967_295).optional(),
  }).strict().refine((s) => s.kind === 'life' || s.amount >= 0, { message: 'Shock amounts are non-negative', path: ['amount'] }),
});
export type FlavourRequest = z.infer<typeof requestSchema>;

export const responseSchema = z.object({
  headline: z.string().min(1).max(60),
  scene: z.string().min(1).max(260),
});

export const system = `You write two-sentence wire-service items for "Fortune Valley", a fictional personal-finance simulation. The game engine has already decided what happened and what it cost; you only describe it.
Style: plain news reporting, like a regional wire desk. Past tense. Short declarative sentences with concrete nouns (a tree limb, the windshield, the water heater, the night shift, a broken wrist). State the dollar figure once, plainly, exactly as given. No adjectives piled up, no jokes, no moral, no advice, no exclamation marks, no second-person address ("you"), no "X. Y." fragment pairs, no quotation marks, no names of real people, companies, towns or hospitals.
Output: "headline" of 3 to 5 words in sentence case (capitalise only the first word), plain, no period, no month name. "scene" of 1 or 2 complete sentences, 32 words at most, that says what happened and what it cost. For job_loss there is no dollar amount; report the cut (shift, contract, plant line, department) and when pay stopped instead.
Do not restate the household facts (housing, car, job status) as facts; use them only to choose a fitting incident. It happened to the player, so write in second person: "you slipped", "your car", "your wrist", "your position". Never "a student", "a resident", "the player", "the household", "someone".
Continuity: the "Household" line is fixed for the whole run. The pet is the pet named there and only that species ("your cat" never becomes "your dog"; with no pet, no animal belongs to the player). Relatives are the roles listed (a grandmother, a cousin, a roommate), never anyone else and never by name. Kids appear only when the household has kids. A student has no office job or employer.
No repeats: "Previous scenes" lists what already happened in this run; invent a different incident, not a variation of one of those.
Templates: "Event" names the incident family and its cadence. Write that incident and no other: a birthday gift is for the player's own birthday ("your birthday"), a holiday gift is for the holidays, a tax refund is the annual refund, back-to-school fees come with the new term; a vet visit is for the household's pet; a parking ticket needs the household's car. Name an annual event as such ("your birthday", "the holidays", "tax season").
Fit the facts: a medical shock is an injury or illness and a bill; an auto shock is damage to or by the player's car; a home shock is theft or damage where the player lives (a dorm room, a rented flat, the family house, their own home); job_loss is the employer cutting the position. A life event is small and uninsured: with "Life event: cost" it is an everyday expense you could not skip (a parking ticket, a wedding gift, a field trip fee, a vet bill, a cousin who needed help, a concert ticket) and the scene makes clear you paid it; with "Life event: gift" it is money that came to you (a birthday cheque from a grandparent, a friend repaying a loan, a small tax refund, a refund for a cancelled flight) and the scene makes clear you received it. Vary the incident with the month and the amount: small sums are small incidents, large sums are serious ones.`;

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

/** Plain-English template notes keyed by life-event template id; unknown ids fall back to the id itself. */
export const TEMPLATE_NOTES: Record<string, string> = {
  birthday_gift: 'birthday gift from an elder relative (annual: your birthday)',
  holiday_gift: 'holiday gift from an elder relative (annual: the holidays)',
  tax_refund: 'tax refund (annual: tax season)',
  flight_refund: 'refund for a cancelled flight (once per run)',
  friend_repays: 'a friend repaying money you lent',
  expense_claim: 'your employer paying an expense claim',
  bursary_topup: 'a bursary or grant top-up from the student office',
  childcare_rebate: 'a childcare rebate or refund for your child',
  small_gift: 'a small windfall (a returned deposit, a refund, something sold)',
  back_to_school: 'back-to-school fees and supplies (annual: the new term)',
  wedding_gift: 'a wedding gift for a friend or relative (once per run)',
  phone_repair: 'repairing a broken phone screen (once per run)',
  vet_visit: 'a vet visit for your pet',
  parking_ticket: 'a parking or traffic fine for your car',
  commute_cost: 'an unplanned commute cost (fare, pass, bike repair) — no car',
  relative_help: 'money you sent to help a peer relative or roommate',
  hobby_cost: 'gear, fees or an event for your hobby',
  kid_cost: 'a school or daycare charge for your child',
  student_cost: 'a course fee, textbook or campus charge',
  small_cost: 'a small unplanned everyday cost',
};

export function user(req: FlavourRequest): string {
  const s = req.shock;
  const h = s.household;
  const facts = [
    s.kind === 'life' ? `Life event: ${s.amount >= 0 ? 'gift (money you received)' : 'cost (money you paid)'}` : `Shock: ${s.kind}`,
    s.kind === 'job_loss' ? 'Amount: none (lost income, no bill)' : `Amount: ${usd(Math.abs(s.amount))} (quote exactly once)`,
    `Month: ${s.monthLabel}`,
    `Household: ${s.archetype ?? 'custom'}, housing ${s.housingKind}, ${s.hasCar ? 'owns a car' : 'no car'}, ${s.employment}`,
  ];
  if (s.templateId) facts.push(`Event: ${TEMPLATE_NOTES[s.templateId] ?? s.templateId.replaceAll('_', ' ')}`);
  if (s.variant) facts.push(`Variant: ${s.variant.replaceAll('_', ' ')}`);
  if (h) facts.push(`Household facts: pet ${h.pet === 'none' ? 'none' : `a ${h.pet}`}; ${h.hasKids ? 'has kids' : 'no kids'}; commutes by ${h.commute}; hobby ${h.hobby.replaceAll('_', ' ')}; relatives in the story: ${h.circle.map((r) => `your ${r}`).join(', ')}; birthday month ${h.birthMonth}`);
  if (s.previousScenes && s.previousScenes.length > 0) facts.push(`Previous scenes (do not repeat): ${s.previousScenes.map((x) => `"${x}"`).join('; ')}`);
  return `${facts.join('\n')}\nReturn JSON {"headline","scene"}.`;
}
