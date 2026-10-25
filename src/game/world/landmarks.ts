import type { BuildingId } from '@/types/domain'

/** Display names and hints for the five buildings (owner: Agent 1). Order = keyboard/tab order in the town. */
export const BUILDINGS: Record<BuildingId, { title: string; hint: string }> = {
  bank: { title: 'Pine Bank', hint: 'Savings & debt' },
  office: { title: 'Town Office', hint: 'Income & career' },
  hospital: { title: 'Health House', hint: 'Health & auto insurance' },
  home: { title: 'Your Home', hint: 'Rent & everyday costs' },
  market: { title: 'Market Hall', hint: 'Investments & allocation' },
}
export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[]
