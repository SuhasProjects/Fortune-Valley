/**
 * Seed scenarios (OWNER: Agent 4). Numbers come from Agent 1's archetypes so
 * there is exactly one source of truth; this file owns copy/ordering.
 */
import type { ArchetypeId, GameConfig } from '@/types/domain';
import { ARCHETYPES, archetypeConfig } from '@/config/archetypes';

export const SCENARIO_ORDER: ArchetypeId[] = ['college_student', 'entry_worker', 'professional', 'young_family'];

/** Default seeds per archetype so a fresh start is reproducible. Pass your own seed for variety. */
const DEFAULT_SEEDS: Record<ArchetypeId, number> = { college_student: 104729, entry_worker: 130363, professional: 155921, young_family: 196613 };

export const scenarios: GameConfig[] = SCENARIO_ORDER.map((id) => archetypeConfig(id, DEFAULT_SEEDS[id]));

export const scenarioById = (id: string): GameConfig | undefined => scenarios.find((s) => s.scenarioId === id || s.archetype === id);

export const scenarioCards = SCENARIO_ORDER.map((id) => ({ id, title: ARCHETYPES[id].title, description: ARCHETYPES[id].description, focus: ARCHETYPES[id].narrativeFocus }));

/** New randomized run of an archetype. */
export const freshScenario = (id: ArchetypeId): GameConfig => archetypeConfig(id, (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
