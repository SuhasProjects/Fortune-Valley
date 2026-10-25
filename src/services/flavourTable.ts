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
    { headline: 'Fall on ice', scene: 'A patch of ice outside the building gave way under one step on a weekday morning. The wrist was broken and the bill came to {amount}.' },
    { headline: 'Night in the ER', scene: 'Chest pain after dinner ended in an ambulance and a night of tests. The hospital billed {amount} and found nothing lasting.' },
    { headline: 'Clinic visit, stitches', scene: 'A kitchen knife slipped while cutting bread. The urgent care clinic closed the cut with seven stitches and charged {amount}.' },
  ],
  auto: [
    { headline: 'Limb hits windshield', scene: 'High wind brought a tree limb down across the parking lot overnight. It went through the windshield and the repair ran {amount}.' },
    { headline: 'Rear-ended at the light', scene: 'A pickup rolled into the back of the car at a red light on the way to work. The body shop quoted {amount}.' },
    { headline: 'Transmission fails', scene: 'The transmission gave out on the highway ramp and the car was towed to the shop. The repair bill was {amount}.' },
  ],
  home: [
    { headline: 'Water heater quits', scene: 'The water heater failed overnight and flooded the floor around it. Replacing the unit and drying the room cost {amount}.' },
    { headline: 'Break-in reported', scene: 'Someone forced the door while the place was empty on a Tuesday. A laptop and a bike were taken, a loss of {amount}.' },
    { headline: 'Pipe bursts upstairs', scene: 'A pipe in the ceiling burst during a cold snap and soaked the room below. The damage came to {amount}.' },
  ],
  job_loss: [
    { headline: 'Plant cuts night shift', scene: 'The plant ended its night shift at the start of the month and let the crew go. The position was among those cut.' },
    { headline: 'Department closed', scene: 'Management closed the department on a Friday afternoon and gave notice by email. Pay stopped at the end of the week.' },
    { headline: 'Contract not renewed', scene: 'The contract ran out at month end and the employer did not renew it. Unemployment benefits now replace part of the pay.' },
  ],
};

/** Deterministic table pick; `seed` is usually the notification id. */
export function pickFlavour(input: ShockFlavourInput, seed: number | string): ShockFlavour {
  const rows = FLAVOUR_TABLE[input.kind];
  const row = rows[hashSeed(seed, input.kind, input.monthLabel) % rows.length]!;
  return { headline: row.headline, scene: row.scene.replace('{amount}', fmtUsd(input.amount)) };
}
