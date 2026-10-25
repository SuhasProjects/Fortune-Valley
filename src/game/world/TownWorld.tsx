import type { CSSProperties } from 'react'
import type { BuildingId } from '@/types/domain'
import { Sprite } from '../art/Sprite'
import { SPRITES } from '../art/manifest'
import { useStageScale } from '../stage/GameStage'
import { EDGE_TILE, MAP_H, MAP_W, mapWindow } from '../stage/scale'
import { BUILDINGS, BUILDING_IDS } from './landmarks'
import { BADGE_GAP, BUILDING_LAYOUT, WINDOW_TOP_MAX, CLOCK, FIREFLIES, LAMP, PROPS, SMOKE, VILLAGERS, VILLAGER_STEP_MS, type Villager } from './layout'
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
  /** Rotates the Town Office clock hand: one hour per month. */
  monthIndex?: number
}

/** Chebyshev length of a villager segment: one step per art px along the longer axis, so diagonals work too. */
export const segmentSteps = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))

/**
 * A villager's cycle as CSS: `fv-walk-<id>` steps the sprite along its route once (one art px per step, in `--px`
 * units so it survives zoom changes), `fv-show-<id>` hides it the moment it reaches the last waypoint (a door or
 * the map edge) until the cycle restarts, and `fv-flip-<id>` mirrors it while it heads left. Positions are the
 * sprite's top-left: the route holds feet positions and the sprite's anchor is its feet. Returns the keyframes and
 * the cycle duration (walk + rest).
 */
export function villagerKeyframes(v: Villager): { css: string; duration: number } {
  const [ax, ay] = SPRITES[v.sprite].anchor ?? [0, 0]
  const points = v.route.map((p) => ({ x: p.x - ax, y: p.y - ay }))
  const segments = points.slice(1).map((to, i) => ({ from: points[i]!, to, len: segmentSteps(points[i]!, to) }))
  const total = segments.reduce((n, s) => n + s.len, 0)
  const duration = total * VILLAGER_STEP_MS + v.rest
  const pct = (n: number) => `${((n * VILLAGER_STEP_MS / duration) * 100).toFixed(3)}%`
  let at = 0
  let facing = 1
  const walk: string[] = []
  const flip: string[] = []
  for (const s of segments) {
    if (s.to.x !== s.from.x) facing = s.to.x > s.from.x ? 1 : -1
    walk.push(`${pct(at)} { transform: translate(calc(${s.from.x} * var(--px)), calc(${s.from.y} * var(--px))); z-index: ${s.from.y + 16}; animation-timing-function: steps(${s.len}, end); }`)
    flip.push(`${pct(at)} { transform: scaleX(${facing}); animation-timing-function: step-end; }`)
    at += s.len
  }
  const last = points[points.length - 1]!
  const end = `transform: translate(calc(${last.x} * var(--px)), calc(${last.y} * var(--px))); z-index: ${last.y + 16};`
  walk.push(`${pct(total)} { ${end} } 100% { ${end} }`)
  flip.push(`100% { transform: scaleX(${facing}); }`)
  const show = `0% { opacity: 1; animation-timing-function: step-end; } ${pct(total)} { opacity: 0; } 100% { opacity: 0; }`
  return { css: `@keyframes fv-walk-${v.id} { ${walk.join(' ')} }\n@keyframes fv-show-${v.id} { ${show} }\n@keyframes fv-flip-${v.id} { ${flip.join(' ')} }`, duration }
}

/**
 * The living town: ground and water layers, props and the five buildings as sprites on a 480x288 art-px map,
 * centred on its 320x180 core and drawn at the stage's integer zoom. Everything animates by stepping frames.
 */
export function TownWorld({ onBuildingClick, eventBuildings = [], openBuilding = null, timeOfDay = 'day', monthIndex = 0 }: TownWorldProps) {
  const stage = useStageScale()
  const { px } = stage
  const still = useReducedMotion()
  const dusk = timeOfDay === 'dusk'
  const interactive = onBuildingClick !== undefined
  // Centred on the core, unless that would tuck the top row of buildings under the HUD (short viewports). Tall or
  // ultrawide windows show past the map: the grass-and-pines tile fills that border, aligned to the map's grid.
  const { left, top, wide, tall } = mapWindow(stage.width, stage.height, stage, WINDOW_TOP_MAX)
  const place = (x: number, y: number, h: number, z = y + h): CSSProperties => ({ left: x * px, top: y * px, zIndex: z })
  const lampMeta = SPRITES['world/props/lamp']
  const walks = VILLAGERS.map((v) => ({ v, ...villagerKeyframes(v) }))

  return <section className={`fv-town${still ? ' fv-still' : ''}`} aria-label="Fortune Valley. Choose a building to manage your money." data-time={timeOfDay}>
    {(wide || tall) && <div className="fv-edge" data-dusk={dusk || undefined} style={{ backgroundImage: `url(${SPRITES['world/edge-tile'].src})`, backgroundSize: `${EDGE_TILE * px}px ${EDGE_TILE * px}px`, backgroundPosition: `${left}px ${top}px` }}/>}
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
          {id === 'office' && <Sprite name={CLOCK.sprite} frame={((monthIndex % 12) + 12) % 12} className="fv-clock" style={{ left: CLOCK.x * px, top: CLOCK.y * px }}/>}
          <span className="fv-town-plaque"><span>{title}</span></span>
        </>
        return interactive
          ? <button key={id} type="button" className="fv-building" data-building={id} data-open={openBuilding === id || undefined} style={place(x, y, meta.h)}
              aria-label={`Open ${title}: ${hint}${event ? '. Decision waiting' : ''}`} onClick={() => onBuildingClick(id)}>{inner}</button>
          : <div key={id} className="fv-building fv-building--static" data-building={id} style={place(x, y, meta.h)}>{inner}</div>
      })}

      {SMOKE.map((s, i) => <Sprite key={i} name="world/fx/smoke" animate className="fv-smoke" style={{ ...place(s.x, s.y, 0, 900), animationDelay: `${i * 450}ms` }}/>)}

      {/* "Decision waiting" badges: centred above each marked building's roof, above every prop and villager. */}
      {eventBuildings.filter((id) => BUILDING_IDS.includes(id)).map((id) => {
        const { x, y } = BUILDING_LAYOUT[id]
        const { w } = SPRITES[`world/buildings/${id}`]
        const badge = SPRITES['world/fx/badge']
        return <span key={id} className="fv-badge" data-badge={id} aria-label="Decision waiting" style={place(x + Math.floor(w / 2) - Math.floor(badge.w / 2), y - badge.h - BADGE_GAP, 0, 950)}><Sprite name="world/fx/badge"/></span>
      })}

      {!still && <>
        <style>{walks.map((w) => w.css).join('\n')}</style>
        {walks.map(({ v, duration }) => {
          const start = v.route[0]!
          return <span key={v.id} className="fv-villager" data-villager={v.id} aria-hidden="true"
              style={{ ...place(0, 0, 0, start.y + 2), '--walk': `fv-walk-${v.id}`, '--show': `fv-show-${v.id}`, '--flip': `fv-flip-${v.id}`, '--walk-dur': `${duration}ms`, '--walk-delay': `${v.delay}ms` } as CSSProperties}>
            <span className="fv-villager__flip"><Sprite name={v.sprite} animate/></span>
          </span>
        })}
      </>}

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
