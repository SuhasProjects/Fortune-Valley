/**
 * Life-event templates and their rules. A template says what kind of small cost or gift it is,
 * who it can happen to (archetype whitelist, pet / kids / car / peer requirements) and how often:
 *   annual   — once per 12 months in a fixed calendar month (birthday in the profile's birth month,
 *              holiday gift in December, tax refund in March/April, back-to-school fees in August)
 *   once     — at most once per run
 *   cooldown — at least N months since the same template last fired
 * `rollLifeEvent` (events.ts) draws incidence and amount on the life stream and asks this module
 * which template fits; eligibility is read from `state.lifeEvents` so Monte Carlo paths and
 * what-if replays apply the same rules from the same history. Owner: Agent 1.
 */
import type { ArchetypeId, GameState, HouseholdProfile } from '@/types/domain';

export type LifeCadence = { kind: 'annual'; month: 'birth' | readonly number[] } | { kind: 'once' } | { kind: 'cooldown'; months: number };

export interface LifeEventTemplate {
  id: string;
  /** Recap label; `{pet}`, `{elder}`, `{peer}`, `{hobby}` are filled from the profile. */
  label: string;
  /** Two-word form for the offline recap's word budget (defaults to the label without its "from/for your …" tail). */
  short?: string;
  sign: 1 | -1;
  amountMin: number;
  amountMax: number;
  /** Archetypes this can happen to (undefined = anyone). */
  archetypes?: readonly ArchetypeId[];
  requires?: { pet?: true; kids?: true; car?: true; noCar?: true; peer?: true; studentOrKids?: true };
  cadence: LifeCadence;
}

const STUDENT: readonly ArchetypeId[] = ['college_student'];
const WORKING: readonly ArchetypeId[] = ['entry_worker', 'professional', 'young_family'];

export const LIFE_EVENT_TEMPLATES: readonly LifeEventTemplate[] = [
  // ── gifts ──
  { id: 'birthday_gift', label: 'birthday gift from your {elder}', sign: 1, amountMin: 60, amountMax: 200, cadence: { kind: 'annual', month: 'birth' } },
  { id: 'holiday_gift', label: 'holiday gift from your {elder}', sign: 1, amountMin: 40, amountMax: 150, cadence: { kind: 'annual', month: [12] } },
  { id: 'tax_refund', label: 'tax refund', sign: 1, amountMin: 80, amountMax: 300, cadence: { kind: 'annual', month: [3, 4] } },
  { id: 'flight_refund', label: 'refund for a cancelled flight', short: 'flight refund', sign: 1, amountMin: 120, amountMax: 300, cadence: { kind: 'once' } },
  { id: 'friend_repays', label: 'a friend repaying a loan', short: 'repaid loan', sign: 1, amountMin: 40, amountMax: 200, cadence: { kind: 'cooldown', months: 8 } },
  { id: 'expense_claim', label: 'expense claim paid by your employer', short: 'expense claim', sign: 1, amountMin: 40, amountMax: 200, archetypes: WORKING, cadence: { kind: 'cooldown', months: 6 } },
  { id: 'bursary_topup', label: 'bursary top-up from the student office', short: 'bursary top-up', sign: 1, amountMin: 50, amountMax: 200, archetypes: STUDENT, cadence: { kind: 'cooldown', months: 9 } },
  { id: 'childcare_rebate', label: 'childcare rebate', sign: 1, amountMin: 60, amountMax: 250, requires: { kids: true }, cadence: { kind: 'cooldown', months: 9 } },
  { id: 'small_gift', label: 'small windfall', sign: 1, amountMin: 20, amountMax: 120, cadence: { kind: 'cooldown', months: 2 } },
  // ── costs ──
  { id: 'back_to_school', label: 'back-to-school fees', sign: -1, amountMin: 60, amountMax: 250, requires: { studentOrKids: true }, cadence: { kind: 'annual', month: [8] } },
  { id: 'wedding_gift', label: 'wedding gift', sign: -1, amountMin: 80, amountMax: 250, cadence: { kind: 'once' } },
  { id: 'phone_repair', label: 'phone screen repair', sign: -1, amountMin: 80, amountMax: 250, cadence: { kind: 'once' } },
  { id: 'vet_visit', label: 'vet visit for your {pet}', sign: -1, amountMin: 60, amountMax: 300, requires: { pet: true }, cadence: { kind: 'cooldown', months: 6 } },
  { id: 'parking_ticket', label: 'parking ticket', sign: -1, amountMin: 30, amountMax: 120, requires: { car: true }, cadence: { kind: 'cooldown', months: 4 } },
  { id: 'commute_cost', label: 'commute cost', sign: -1, amountMin: 20, amountMax: 120, requires: { noCar: true }, cadence: { kind: 'cooldown', months: 4 } },
  { id: 'relative_help', label: 'money sent to your {peer}', sign: -1, amountMin: 50, amountMax: 200, requires: { peer: true }, cadence: { kind: 'cooldown', months: 6 } },
  { id: 'hobby_cost', label: '{hobby} gear', sign: -1, amountMin: 30, amountMax: 200, cadence: { kind: 'cooldown', months: 5 } },
  { id: 'kid_cost', label: 'school or daycare charge', short: 'school charge', sign: -1, amountMin: 30, amountMax: 150, requires: { kids: true }, cadence: { kind: 'cooldown', months: 3 } },
  { id: 'student_cost', label: 'course fee', sign: -1, amountMin: 30, amountMax: 150, archetypes: STUDENT, cadence: { kind: 'cooldown', months: 3 } },
  { id: 'small_cost', label: 'small unplanned cost', short: 'unplanned cost', sign: -1, amountMin: 20, amountMax: 120, cadence: { kind: 'cooldown', months: 2 } },
];

export const LIFE_TEMPLATE_BY_ID: ReadonlyMap<string, LifeEventTemplate> = new Map(LIFE_EVENT_TEMPLATES.map((t) => [t.id, t]));

/** Templates that are always available as a last resort (no requirements); their cooldown is waived only when nothing else fits. */
export const GENERIC_TEMPLATE: Record<1 | -1, string> = { 1: 'small_gift', [-1]: 'small_cost' };

/** Calendar month (1–12) of `monthIndex` given the run's start month `YYYY-MM`. */
export function calendarMonth(startMonth: string, monthIndex: number): number {
  const m = Number(startMonth.split('-')[1] ?? 1);
  return ((m - 1 + monthIndex) % 12) + 1;
}

export interface EligibilityContext {
  profile: HouseholdProfile;
  hasCar: boolean;
  /** Calendar month 1–12 of the month being rolled. */
  calendarMonth: number;
  monthIndex: number;
  lifeEvents: readonly { monthIndex: number; templateId?: string }[];
}

/** Does the household itself fit the template (ignoring cadence)? */
export function fitsHousehold(t: LifeEventTemplate, ctx: Pick<EligibilityContext, 'profile' | 'hasCar'>): boolean {
  const p = ctx.profile;
  const student = p.archetype === 'college_student';
  if (t.archetypes && (!p.archetype || !t.archetypes.includes(p.archetype))) return false;
  const r = t.requires;
  if (!r) return true;
  if (r.pet && p.pet === 'none') return false;
  if (r.kids && !p.hasKids) return false;
  if (r.car && !ctx.hasCar) return false;
  if (r.noCar && ctx.hasCar) return false;
  if (r.peer && p.circle.length < 2) return false;
  if (r.studentOrKids && !student && !p.hasKids) return false;
  return true;
}

/** Months since the template last fired (Infinity if never). */
export function monthsSinceLast(t: LifeEventTemplate, ctx: Pick<EligibilityContext, 'monthIndex' | 'lifeEvents'>): number {
  let last = -Infinity;
  for (const e of ctx.lifeEvents) if (e.templateId === t.id && e.monthIndex > last) last = e.monthIndex;
  return ctx.monthIndex - last;
}

/** Cadence check only: right month for annuals, never for once, N months for cooldowns. */
export function cadenceAllows(t: LifeEventTemplate, ctx: EligibilityContext): boolean {
  const since = monthsSinceLast(t, ctx);
  switch (t.cadence.kind) {
    case 'annual': {
      const months = t.cadence.month === 'birth' ? [ctx.profile.birthMonth] : t.cadence.month;
      return months.includes(ctx.calendarMonth) && since >= 12;
    }
    case 'once': return since === Infinity;
    case 'cooldown': return since >= t.cadence.months;
  }
}

export function isEligible(t: LifeEventTemplate, ctx: EligibilityContext): boolean {
  return fitsHousehold(t, ctx) && cadenceAllows(t, ctx);
}

export function eligibleTemplates(ctx: EligibilityContext, sign?: 1 | -1): LifeEventTemplate[] {
  return LIFE_EVENT_TEMPLATES.filter((t) => (sign === undefined || t.sign === sign) && isEligible(t, ctx));
}

/**
 * Pick a template for `sign` with uniform draw `p`: an annual template whose month it is wins
 * over everything else (so a birthday does not lose out to a parking ticket); otherwise any
 * eligible template. Returns null when nothing of that sign is eligible this month.
 */
export function chooseTemplate(ctx: EligibilityContext, sign: 1 | -1, p: number): LifeEventTemplate | null {
  const eligible = eligibleTemplates(ctx, sign);
  if (eligible.length === 0) return null;
  const annual = eligible.filter((t) => t.cadence.kind === 'annual');
  const pool = annual.length > 0 ? annual : eligible;
  return pool[Math.min(pool.length - 1, Math.floor(p * pool.length))]!;
}

export function eligibilityContext(s: Pick<GameState, 'householdProfile' | 'startMonth' | 'monthIndex' | 'lifeEvents' | 'debts'>, carOwner: boolean): EligibilityContext {
  return { profile: s.householdProfile, hasCar: carOwner, calendarMonth: calendarMonth(s.startMonth, s.monthIndex), monthIndex: s.monthIndex, lifeEvents: s.lifeEvents ?? [] };
}

const HOBBY_GEAR: Record<HouseholdProfile['hobby'], string> = { running: 'running', cycling: 'cycling', music: 'music', gaming: 'gaming', photography: 'camera', cooking: 'kitchen', reading: 'book', hiking: 'hiking' };

/** Fill `{pet}`, `{elder}`, `{peer}`, `{hobby}` from the profile. */
export function fillProfile(text: string, profile: HouseholdProfile | undefined): string {
  const elder = profile?.circle[0] ?? 'grandmother';
  const peer = profile?.circle[1] ?? 'cousin';
  const pet = profile && profile.pet !== 'none' ? profile.pet : 'cat';
  const hobby = profile ? HOBBY_GEAR[profile.hobby] : 'running';
  return text.replaceAll('{pet}', pet).replaceAll('{elder}', elder).replaceAll('{peer}', peer).replaceAll('{hobby}', hobby);
}

/** Recap/UI label for a realized life event: "birthday gift from your grandmother", "vet visit for your cat". */
export function lifeEventLabel(templateId: string | undefined, profile: HouseholdProfile | undefined, amountSigned: number): string {
  const t = templateId ? LIFE_TEMPLATE_BY_ID.get(templateId) : undefined;
  if (!t) return amountSigned > 0 ? 'small gift' : 'small unplanned cost';
  return fillProfile(t.label, profile);
}

/** Human cadence note for the AI prompt: "annual: your birthday", "once per run", "repeats at most every 6 months". */
export function cadenceNote(t: LifeEventTemplate): string {
  switch (t.cadence.kind) {
    case 'annual': return t.id === 'birthday_gift' ? 'annual: your birthday' : t.id === 'holiday_gift' ? 'annual: the holidays' : t.id === 'tax_refund' ? 'annual: tax season' : 'annual: back to school';
    case 'once': return 'once per run';
    case 'cooldown': return `at most every ${t.cadence.months} months`;
  }
}

/** Strip the relative/pet/hobby tail of a filled label: "birthday gift from your grandmother" → "birthday gift". */
export const stripLabelTail = (label: string): string => label.replace(/ (from|for|to|by) (your|the) .*$/, '');

/** Short label for a recap line that starts with "Life event: <label>, $X received|paid" (word budget of the offline recap). */
export function shortLifeLabel(filledLabel: string): string {
  const base = stripLabelTail(filledLabel);
  const t = LIFE_EVENT_TEMPLATES.find((x) => stripLabelTail(x.label) === base);
  return t?.short ?? base;
}
