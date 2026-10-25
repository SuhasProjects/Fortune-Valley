/**
 * Offline news-wire scenes for shocks, one table per ShockKind, plus the life-event tables
 * (small costs and small gifts, chosen by the sign of the amount). Picked by seed so
 * replays read the same. `{amount}` is replaced with the engine's figure; the
 * table never invents a number. Style: second person, past tense, concrete nouns, no "!".
 */
import type { ArchetypeId, ShockFlavour, ShockFlavourInput, ShockKind } from '@/types/domain';
import { hashSeed } from '@/engine/rng';

const fmtUsd = (n: number): string => `$${(Number.isFinite(n) ? Math.round(n) : 0).toLocaleString('en-US')}`;

export const FLAVOUR_TABLE: Record<Exclude<ShockKind, 'life'>, readonly ShockFlavour[]> = {
  medical: [
    { headline: 'Fall on ice', scene: 'You slipped on a patch of ice outside the building on a weekday morning and broke your wrist. The bill came to {amount}.' },
    { headline: 'Night in the ER', scene: 'Chest pain after dinner put you in an ambulance and through a night of tests. The hospital billed you {amount} and found nothing lasting.' },
    { headline: 'Clinic visit, stitches', scene: 'A kitchen knife slipped while you were cutting bread. The urgent care clinic closed your hand with seven stitches and charged {amount}.' },
  ],
  auto: [
    { headline: 'Limb hits windshield', scene: 'High wind brought a tree limb down across the parking lot overnight. It went through your windshield and the repair ran {amount}.' },
    { headline: 'Rear-ended at the light', scene: 'A pickup rolled into the back of your car at a red light on your way to work. The body shop quoted {amount}.' },
    { headline: 'Transmission fails', scene: 'Your transmission gave out on the highway ramp and the car was towed to the shop. The repair bill was {amount}.' },
  ],
  home: [
    { headline: 'Water heater quits', scene: 'Your water heater failed overnight and flooded the floor around it. Replacing the unit and drying the room cost you {amount}.' },
    { headline: 'Break-in reported', scene: 'Someone forced your door while you were out on a Tuesday. Your laptop and bike were taken, a loss of {amount}.' },
    { headline: 'Pipe bursts upstairs', scene: 'A pipe in your ceiling burst during a cold snap and soaked the room below. The damage came to {amount}.' },
  ],
  job_loss: [
    { headline: 'Plant cuts night shift', scene: 'The plant ended its night shift at the start of the month and let the crew go. Your position was among those cut.' },
    { headline: 'Department closed', scene: 'Management closed your department on a Friday afternoon and gave notice by email. Your pay stopped at the end of the week.' },
    { headline: 'Contract not renewed', scene: 'Your contract ran out at month end and the employer did not renew it. Unemployment benefits now replace part of your pay.' },
  ],
};

/** A life-event scene; `fit` narrows the pick to households it suits (unset = anyone). */
export interface LifeFlavourRow extends ShockFlavour { fit?: readonly ArchetypeId[] }

const STUDENT: readonly ArchetypeId[] = ['college_student'];
const FAMILY: readonly ArchetypeId[] = ['young_family'];
const WORKING: readonly ArchetypeId[] = ['entry_worker', 'professional', 'young_family'];

/** Small unavoidable costs (amount < 0). */
export const LIFE_COST_TABLE: readonly LifeFlavourRow[] = [
  { headline: 'Parking ticket issued', scene: 'A warden ticketed your car outside the library on a Saturday afternoon. You paid the {amount} fine before the late fee kicked in.' },
  { headline: 'Wedding gift bought', scene: 'An old friend married in the spring and you were on the guest list. You bought a {amount} gift from the registry.' },
  { headline: 'Vet bill paid', scene: 'Your neighbour\'s cat scratched your dog during a walk. The vet cleaned the wound and billed you {amount}.' },
  { headline: 'Cousin asks for help', scene: 'Your cousin called about a short month and a rent gap. You sent {amount} and did not expect it back.' },
  { headline: 'Concert ticket bought', scene: 'The band you had followed since school came through town for one night. The ticket cost you {amount}.' },
  { headline: 'Phone screen replaced', scene: 'Your phone slid off the kitchen counter onto the tiles. The repair shop replaced the screen for {amount}.' },
  { headline: 'Dentist charges extra', scene: 'A routine cleaning turned up a cracked filling. Your dentist replaced it and charged {amount} the same day.' },
  { headline: 'Late fee charged', scene: 'You missed a utility due date by three days while travelling. The late fee came to {amount}.' },
  { headline: 'Field trip fee due', scene: 'Your course scheduled a two-day field trip and billed every student. You paid the {amount} fee at the registrar.', fit: STUDENT },
  { headline: 'Textbook replaced', scene: 'Your chemistry textbook went missing from the study hall. The campus store charged you {amount} for a new copy.', fit: STUDENT },
  { headline: 'School trip fee', scene: 'Your child\'s class booked a trip to the science museum. The school asked for {amount} by the end of the week.', fit: FAMILY },
  { headline: 'Daycare bills a late pickup', scene: 'You arrived at daycare twenty minutes late after a train delay. The centre added a {amount} late-pickup charge.', fit: FAMILY },
  { headline: 'Office collection comes round', scene: 'A colleague retired after thirty years and the office passed the envelope. You put in {amount}.', fit: WORKING },
];

/** Small gifts and refunds (amount > 0). */
export const LIFE_GIFT_TABLE: readonly LifeFlavourRow[] = [
  { headline: 'Grandfather sends a cheque', scene: 'Your grandfather mailed a birthday card with a cheque folded inside. You deposited the {amount} on Monday.' },
  { headline: 'Friend repays a loan', scene: 'A friend you had lent money to last year paid you back in full. The {amount} landed in your account by transfer.' },
  { headline: 'Tax refund arrives', scene: 'The tax office reviewed your return and found you had overpaid. A refund of {amount} arrived by direct deposit.' },
  { headline: 'Cancelled flight refunded', scene: 'The airline cancelled your morning flight and refunded the fare. You received {amount} back on your card.' },
  { headline: 'Deposit returned', scene: 'Your former landlord returned the cleaning deposit after a final inspection. The {amount} cheque came by post.' },
  { headline: 'Raffle ticket wins', scene: 'Your ticket in the neighbourhood raffle came up second. You collected {amount} at the community hall.' },
  { headline: 'Overcharge refunded', scene: 'Your phone company admitted it had billed you twice in the spring. It credited {amount} back to your account.' },
  { headline: 'Old bike sold', scene: 'You listed the bike that had sat in the hallway for a year. A buyer collected it and paid you {amount} in cash.' },
  { headline: 'Aunt sends exam money', scene: 'Your aunt heard you had passed your exams and sent a card. Inside was {amount} and a note to buy something useful.', fit: STUDENT },
  { headline: 'Bursary top-up paid', scene: 'The student office paid a small bursary top-up it had owed since the autumn. You received {amount}.', fit: STUDENT },
  { headline: 'Grandparents send birthday money', scene: 'Your child turned six and both grandparents sent cards. The {amount} inside went into your account the same week.', fit: FAMILY },
  { headline: 'Childcare rebate paid', scene: 'The council processed a childcare rebate it had held over from last year. You received {amount} by transfer.', fit: FAMILY },
  { headline: 'Expense claim paid', scene: 'Your employer finally paid a travel expense claim you had filed months ago. The {amount} reached your account on payday.', fit: WORKING },
];

/** Life-event rows for one household: archetype-fitted rows plus the general ones. */
export function lifeRows(amount: number, archetype?: ArchetypeId): readonly LifeFlavourRow[] {
  const table = amount >= 0 ? LIFE_GIFT_TABLE : LIFE_COST_TABLE;
  return table.filter((row) => !row.fit || (archetype !== undefined && row.fit.includes(archetype)));
}

/** Deterministic table pick; `seed` is usually the notification id. */
export function pickFlavour(input: ShockFlavourInput, seed: number | string): ShockFlavour {
  if (input.kind === 'life') {
    const rows = lifeRows(input.amount, input.archetype);
    const row = rows[hashSeed(seed, input.kind, input.monthLabel, input.amount >= 0 ? 'gift' : 'cost') % rows.length]!;
    return { headline: row.headline, scene: row.scene.replace('{amount}', fmtUsd(Math.abs(input.amount))) };
  }
  const rows = FLAVOUR_TABLE[input.kind];
  const row = rows[hashSeed(seed, input.kind, input.monthLabel) % rows.length]!;
  return { headline: row.headline, scene: row.scene.replace('{amount}', fmtUsd(input.amount)) };
}
