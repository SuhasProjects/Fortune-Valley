import type { BuildingId } from '../../types/domain'
import { GameStage } from '../../game/stage/GameStage'
import { TownWorld } from '../../game/world/TownWorld'

export interface TownSceneProps {
  onBuildingClick: (building: BuildingId) => void
  eventBuilding?: BuildingId | null
  eventBuildings?: BuildingId[]
}

/** Legacy mount point used by App until Agent 4's GameScreen composes GameStage + TownWorld directly. */
export function TownScene({ onBuildingClick, eventBuilding, eventBuildings = [] }: TownSceneProps) {
  const events = eventBuilding ? [...eventBuildings, eventBuilding] : eventBuildings
  return <GameStage label="Fortune Valley town" world={<TownWorld onBuildingClick={onBuildingClick} eventBuildings={events}/>}/>
}
