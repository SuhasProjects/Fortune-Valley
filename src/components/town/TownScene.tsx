import type { BuildingId } from '../../types/domain'
import { buildingIds, buildings } from './buildings'

export const TOWN_ART = '/assets/town-valley-v2.png'

// Both the map and the card portraits reference the same original raster artwork.
// Crops use a normalized 1536 x 1024 coordinate space, not separate sprite assets.
const portraits: Record<BuildingId, [number, number, number, number]> = {
  bank: [115, 90, 335, 320],
  office: [605, 20, 355, 330],
  hospital: [1075, 110, 375, 320],
  home: [350, 530, 340, 310],
  market: [875, 535, 395, 320],
}
export function BuildingSprite({ building }: { building: BuildingId }) {
  return <svg className="building-portrait" viewBox={portraits[building].join(' ')} aria-hidden="true" shapeRendering="crispEdges">
    <image href={TOWN_ART} width="1536" height="1024" preserveAspectRatio="none"/>
  </svg>
}
export interface TownSceneProps {
  onBuildingClick: (building: BuildingId) => void
  eventBuilding?: BuildingId | null
  eventBuildings?: BuildingId[]
}
export function TownScene({ onBuildingClick, eventBuilding, eventBuildings = [] }: TownSceneProps) {
  return <section className="town-scene illustrated-town" aria-label="Financial Town. Choose a building to explore your finances.">
    <img className="town-illustration" src={TOWN_ART} alt="" width="1536" height="1024" fetchPriority="high" draggable={false}/>
    {buildingIds.map(id => {
      const event = eventBuilding === id || eventBuildings.includes(id)
      return <button key={id} className={`town-hotspot illustrated-hotspot hotspot-${id}`} style={{ left: `${buildings[id].x}%`, top: `${buildings[id].y}%` }} onClick={() => onBuildingClick(id)} aria-label={`Open ${buildings[id].title}: ${buildings[id].hint}${event ? '. Decision waiting' : ''}`}>
        <span className="building-sign">{buildings[id].title}</span>
        <span className="building-tooltip">{buildings[id].hint} <span aria-hidden="true">↗</span></span>
        {event && <span className="event-badge" aria-label="Decision waiting">!</span>}
      </button>
    })}
  </section>
}
