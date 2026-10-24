import type { BuildingId } from '../../types/domain'
import { BUILDINGS } from '../../game/world/landmarks'

// Legacy shim for the image-based TownScene; titles and hints come from landmarks.ts. Removed in Agent 1's cleanup.
const legacy: Record<BuildingId, { color: string; x: number; y: number }> = {
  bank: { color: '#dcb87c', x: 18.5, y: 25 },
  office: { color: '#aebcc0', x: 50.5, y: 18 },
  hospital: { color: '#eee4b9', x: 82, y: 25 },
  home: { color: '#e1b17c', x: 33.5, y: 66 },
  market: { color: '#d9b385', x: 69, y: 67 },
}
export const buildings = Object.fromEntries(Object.entries(legacy).map(([id, v]) => [id, { ...BUILDINGS[id as BuildingId], ...v }])) as Record<BuildingId, { title: string; hint: string; color: string; x: number; y: number }>
export const buildingIds = Object.keys(buildings) as BuildingId[]
