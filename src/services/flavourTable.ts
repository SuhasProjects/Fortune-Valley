/**
 * Offline news-wire scenes for shocks, one table per ShockKind. Picked by seed so
 * replays read the same. `{amount}` is replaced with the engine's figure; the
 * table never invents a number. Style: past tense, concrete nouns, no "!".
 */
import type { ShockFlavour, ShockFlavourInput, ShockKind } from '@/types/domain';
import { hashSeed } from '@/engine/rng';

const fmtUsd = (n: number): string => `$${(Number.isFinite(n) ? Math.round(n) : 0).toLocaleString('en-US')}`;

export const FLAVOUR_TABLE: Record<ShockKind, readonly ShockFlavour[]> = {
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

/** Deterministic table pick; `seed` is usually the notification id. */
export function pickFlavour(input: ShockFlavourInput, seed: number | string): ShockFlavour {
  const rows = FLAVOUR_TABLE[input.kind];
  const row = rows[hashSeed(seed, input.kind, input.monthLabel) % rows.length]!;
  return { headline: row.headline, scene: row.scene.replace('{amount}', fmtUsd(input.amount)) };
}
