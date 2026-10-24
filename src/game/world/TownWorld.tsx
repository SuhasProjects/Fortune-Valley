import type { CSSProperties } from 'react'
import type { BuildingId } from '@/types/domain'
import { Sprite } from '../art/Sprite'
import { SPRITES } from '../art/manifest'
import { useStageScale } from '../stage/GameStage'
import { MAP_H, MAP_W } from '../stage/scale'
import { BUILDINGS, BUILDING_IDS } from './landmarks'
import { BUILDING_LAYOUT, FIREFLIES, LAMP, PROPS, SMOKE } from './layout'
import { useReducedMotion } from './useReducedMotion'
import './world.css'

export interface TownWorldProps {
  /** Omitted = decorative, non-interactive (e.g. behind the results screen). */
  onBuildingClick?: (id: BuildingId) => void
  /** Buildings showing the "decision waiting" badge. */
  eventBuildings?: BuildingId[]
  /** Building whose window is open: steady highlight. */
  openBuilding?: BuildingId | null
  timeOfDay?: 'day' | 'dusk'
  /** Reserved for the Town Office clock hand. */
  monthIndex?: number
}

/**
 * The living town: ground and water layers, props and the five buildings as sprites on a 480x288 art-px map,
 * centred on its 320x180 core and drawn at the stage's integer zoom. Everything animates by stepping frames.
 */
export function TownWorld({ onBuildingClick, eventBuildings = [], openBuilding = null, timeOfDay = 'day' }: TownWorldProps) {
  const { px, viewW, viewH } = useStageScale()
  const still = useReducedMotion()
  const dusk = timeOfDay === 'dusk'
  const interactive = onBuildingClick !== undefined
  const left = Math.round(((viewW - MAP_W) / 2) * px)
  const top = Math.round(((viewH - MAP_H) / 2) * px)
  const place = (x: number, y: number, h: number, z = y + h): CSSProperties => ({ left: x * px, top: y * px, zIndex: z })
  const lampMeta = SPRITES['world/props/lamp']

  return <section className={`fv-town${still ? ' fv-still' : ''}`} aria-label="Fortune Valley. Choose a building to manage your money." data-time={timeOfDay}>
    <div className="fv-map" style={{ width: MAP_W * px, height: MAP_H * px, left, top }}>
      <Sprite name="world/ground" className="fv-ground"/>
      <Sprite name="world/water" animate className="fv-water"/>

      {PROPS.map((p, i) => {
        const meta = SPRITES[p.sprite]
        const lit = dusk && p.sprite === 'world/props/lamp' && meta.frames.includes('lit')
        return <Sprite key={i} name={p.sprite} animate={p.animate} frame={lit ? 'lit' : 0} className="fv-prop" style={place(p.x, p.y, meta.h)}/>
      })}

      {BUILDING_IDS.map((id) => {
        const { x, y } = BUILDING_LAYOUT[id]
        const sprite = `world/buildings/${id}` as const
        const meta = SPRITES[sprite]
        const { title, hint } = BUILDINGS[id]
        const event = eventBuildings.includes(id)
        const inner = <>
          <Sprite name={sprite} className="fv-building__base"/>
          <Sprite name={sprite} frame="hover" className="fv-building__hover"/>
          <span className="fv-town-plaque"><span>{title}</span></span>
          {event && <span className="fv-badge" aria-label="Decision waiting"><Sprite name="world/fx/badge"/></span>}
        </>
        return interactive
          ? <button key={id} type="button" className="fv-building" data-building={id} data-open={openBuilding === id || undefined} style={place(x, y, meta.h)}
              aria-label={`Open ${title}: ${hint}${event ? '. Decision waiting' : ''}`} onClick={() => onBuildingClick(id)}>{inner}</button>
          : <div key={id} className="fv-building fv-building--static" data-building={id} style={place(x, y, meta.h)}>{inner}</div>
      })}

      {SMOKE.map((s, i) => <Sprite key={i} name="world/fx/smoke" animate className="fv-smoke" style={{ ...place(s.x, s.y, 0, 900), animationDelay: `${i * 450}ms` }}/>)}

      {dusk && <>
        <div className="fv-dusk"/>
        {BUILDING_IDS.map((id) => {
          const { x, y } = BUILDING_LAYOUT[id]
          const sprite = `world/buildings/${id}` as const
          return SPRITES[sprite].frames.includes('lights') ? <Sprite key={id} name={sprite} frame="lights" className="fv-lights" style={place(x, y, 0, 1001)}/> : null
        })}
        <Sprite name="world/fx/glow" className="fv-glow" style={place(LAMP.x + Math.floor(lampMeta.w / 2) - 4, LAMP.y - 2, 0, 1001)}/>
        {FIREFLIES.map((f, i) => <Sprite key={i} name="world/fx/firefly" animate className="fv-firefly" style={{ ...place(f.x, f.y, 0, 1002), animationDelay: `${f.delay}ms, ${f.delay}ms` }}/>)}
      </>}
    </div>
  </section>
}
