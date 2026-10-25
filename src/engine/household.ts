/**
 * Household profile: the fixed, names-free facts about the player that life events and their
 * scenes must agree on for a whole run (one birthday month, one pet, the same relatives, one
 * commute). Derived deterministically from (seed, archetype, dependents, car) at createGame, so
 * Monte Carlo paths and what-if replays rebuild the same profile from the same seed. Owner: Agent 1.
 */
import type { ArchetypeId, CircleRole, GameConfig, HobbyTag, HouseholdProfile, PetKind } from '@/types/domain';
import { hashSeed, makeRng } from './rng';
import { hasCar } from './car';

export const HOBBIES: readonly HobbyTag[] = ['running', 'cycling', 'music', 'gaming', 'photography', 'cooking', 'reading', 'hiking'];
const ELDERS: readonly CircleRole[] = ['grandmother', 'grandfather', 'aunt', 'uncle'];
const PEERS_STUDENT: readonly CircleRole[] = ['roommate', 'cousin', 'older sister', 'older brother'];
const PEERS_WORKING: readonly CircleRole[] = ['roommate', 'partner', 'cousin', 'older sister', 'older brother'];

/** Pet odds: students mostly have none (dorms); everyone else ~40 % none / 30 % cat / 30 % dog. */
export function drawPet(u: number, archetype: ArchetypeId | undefined): PetKind {
  if (archetype === 'college_student') return u < 0.85 ? 'none' : u < 0.925 ? 'cat' : 'dog';
  return u < 0.4 ? 'none' : u < 0.7 ? 'cat' : 'dog';
}

export function deriveHouseholdProfile(config: Pick<GameConfig, 'seed' | 'archetype' | 'initialState'>): HouseholdProfile {
  const rng = makeRng(hashSeed(config.seed, 'household-profile', config.archetype ?? 'custom'));
  const archetype = config.archetype;
  const birthMonth = rng.int(1, 12);
  const pet = drawPet(rng.next(), archetype);
  const hobby = HOBBIES[rng.int(0, HOBBIES.length - 1)]!;
  const hasKids = archetype === 'young_family' || config.initialState.household.dependents > 0;
  const car = hasCar(config.initialState);
  const commute = car ? 'car' : rng.next() < 0.6 ? 'transit' : 'bike';
  const elder = ELDERS[rng.int(0, ELDERS.length - 1)]!;
  const peers = archetype === 'college_student' ? PEERS_STUDENT : PEERS_WORKING;
  const peer: CircleRole = hasKids ? 'partner' : peers[rng.int(0, peers.length - 1)]!;
  const circle: CircleRole[] = hasKids || rng.next() < 0.7 ? [elder, peer] : [elder];
  return { ...(archetype ? { archetype } : {}), birthMonth, pet, hobby, hasKids, commute, circle };
}

/** Light shape check for saves; fills nothing, only confirms the profile is usable by the engine. */
export function isHouseholdProfile(v: unknown): v is HouseholdProfile {
  if (!v || typeof v !== 'object') return false;
  const p = v as Partial<HouseholdProfile>;
  return Number.isInteger(p.birthMonth) && (p.birthMonth as number) >= 1 && (p.birthMonth as number) <= 12
    && (['none', 'cat', 'dog'] as const).includes(p.pet as PetKind)
    && typeof p.hobby === 'string' && typeof p.hasKids === 'boolean'
    && (['car', 'transit', 'bike'] as const).includes(p.commute as HouseholdProfile['commute'])
    && Array.isArray(p.circle) && p.circle.length >= 1 && p.circle.length <= 2 && p.circle.every((r) => typeof r === 'string');
}
