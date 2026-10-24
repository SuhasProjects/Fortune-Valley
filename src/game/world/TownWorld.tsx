import type { BuildingId } from '@/types/domain'
import { TownScene } from '@/components/town/TownScene'

export interface TownWorldProps {
  /** Omitted = decorative, non-interactive (e.g. behind the results screen). */
  onBuildingClick?: (id: BuildingId) => void
  /** Buildings showing the "decision waiting" badge. */
  eventBuildings?: BuildingId[]
  /** Building whose window is open: door-open frame and steady highlight. */
  openBuilding?: BuildingId | null
  timeOfDay?: 'day' | 'dusk'
  /** Drives the Town Office clock hand. */
  monthIndex?: number
}

// STUB (Phase 0): renders the old image town until the tile-and-sprite world lands. The props are final.
export function TownWorld({ onBuildingClick, eventBuildings = [] }: TownWorldProps) {
  return <TownScene onBuildingClick={onBuildingClick ?? (() => {})} eventBuildings={eventBuildings}/>
}
