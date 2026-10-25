import type { CSSProperties } from 'react'
import { Sprite } from '../art/Sprite'
import { SPRITES, type SpriteName } from '../art/manifest'
import { useStageScale } from '../stage/GameStage'
import { MAP_H, MAP_W } from '../stage/scale'
import { useReducedMotion } from '../world/useReducedMotion'
import './title-scene.css'

/**
 * Title backdrop built with the town's own pipeline (owner: Agent 1): dithered sky, shaded mountain ranges with
 * snow and drifting haze, rolling hills, a pine line, and a meadow using the same ground textures, buildings,
 * trees and props as the town. Same 480x288 map and integer zoom as TownWorld.
 */
const LAYERS: [SpriteName, number][] = [
  ['title/scene/sky', 0],
  ['title/scene/mountains-far', 40],
  ['title/scene/mountains-mid', 70],
  ['title/scene/hills', 102],
]

interface Placed { sprite: SpriteName; x: number; y: number; animate?: boolean }
const pine = (x: number, y: number): Placed => ({ sprite: 'world/extra/pine-tree', x, y })
const tree = (x: number, y: number): Placed => ({ sprite: 'world/props/tree-round', x, y, animate: true })
const bush = (x: number, y: number): Placed => ({ sprite: 'world/props/bush', x, y, animate: true })

/**
 * Every desktop viewport shows the 320x180 core (art px 80..400 wide; 1366x768 shows 69..411, 1440x900 60..420).
 * Standalone props sit fully inside the core or fully outside x 58..422 so no viewport cuts one in half; the pine
 * line leaves a gap over those edge bands for the same reason.
 */
const forest: Placed[] = []
for (let x = 2; x < MAP_W; x += 20) {
  if (x >= 216 && x <= 244) continue // the path leaves the meadow here
  if ((x + 18 > 60 && x < 80) || (x + 18 > 400 && x < 420)) continue // edge bands
  const step = Math.round((x - 2) / 20)
  forest.push(pine(x, 118 + (step % 3) * 3))
  if (step % 4 === 1 && x + 31 <= 400) forest.push(tree(x + 9, 126))
}

const PROPS: Placed[] = [
  ...forest,
  { sprite: 'world/buildings/home', x: 84, y: 150 },
  { sprite: 'world/buildings/market', x: 312, y: 168 },
  { sprite: 'world/extra/mailbox', x: 162, y: 184 },
  { sprite: 'world/extra/fence-post', x: 166, y: 176 }, { sprite: 'world/extra/fence-h', x: 173, y: 180 }, { sprite: 'world/extra/fence-h', x: 189, y: 180 }, { sprite: 'world/extra/fence-post', x: 205, y: 176 },
  { sprite: 'world/extra/fence-post', x: 320, y: 220 }, { sprite: 'world/extra/fence-h', x: 327, y: 224 }, { sprite: 'world/extra/fence-h', x: 343, y: 224 }, { sprite: 'world/extra/fence-h', x: 359, y: 224 }, { sprite: 'world/extra/fence-h', x: 375, y: 224 }, { sprite: 'world/extra/fence-post', x: 391, y: 220 },
  { sprite: 'world/extra/hay-bale', x: 278, y: 190 }, { sprite: 'world/extra/hay-bale', x: 292, y: 194 }, { sprite: 'world/extra/hay-bale', x: 284, y: 202 },
  { sprite: 'world/extra/well', x: 296, y: 214 },
  { sprite: 'world/extra/signpost', x: 258, y: 214 },
  { sprite: 'world/extra/rock', x: 44, y: 252 }, { sprite: 'world/extra/rock', x: 440, y: 256 }, { sprite: 'world/extra/stump', x: 150, y: 242 },
  bush(14, 150), bush(458, 150), bush(130, 216), bush(386, 198), bush(236, 266),
  { sprite: 'world/props/flowers-white', x: 96, y: 204, animate: true }, { sprite: 'world/props/flowers-mixed', x: 172, y: 262, animate: true },
  { sprite: 'world/props/flowers-white', x: 334, y: 262, animate: true }, { sprite: 'world/props/flowers-mixed', x: 444, y: 212, animate: true },
  { sprite: 'world/props/flowers-mixed', x: 200, y: 246, animate: true }, { sprite: 'world/props/flowers-white', x: 300, y: 198, animate: true },
  { sprite: 'world/props/lilypad', x: 104, y: 220, animate: true }, { sprite: 'world/props/lilypad', x: 128, y: 228, animate: true }, { sprite: 'world/props/lilypad', x: 118, y: 216, animate: true },
  tree(0, 232), tree(452, 196), tree(20, 196), tree(176, 208),
]

export function TitleScene({ dusk = false }: { dusk?: boolean }) {
  const { px, viewW, viewH } = useStageScale()
  const still = useReducedMotion()
  const left = Math.round(((viewW - MAP_W) / 2) * px)
  const top = Math.round(((viewH - MAP_H) / 2) * px)
  const at = (x: number, y: number, z: number): CSSProperties => ({ left: x * px, top: y * px, zIndex: z })
  return <div className={`fv-scene${still ? ' fv-still' : ''}`} aria-hidden="true" data-dusk={dusk || undefined}>
    <div className="fv-scene__map" style={{ width: MAP_W * px, height: MAP_H * px, left, top }}>
      <Sprite name="title/ground" className="fv-scene__layer" style={at(0, 0, 0)}/>
      <Sprite name="title/water" animate className="fv-scene__layer" style={at(0, 0, 1)}/>
      {LAYERS.map(([name, y], i) => <Sprite key={name} name={name} className="fv-scene__layer" style={at(0, y, 10 + i)}/>)}
      <div className="fv-scene__haze" style={at(0, 100, 12)}/>
      <div className="fv-scene__haze fv-scene__haze--reverse" style={at(0, 126, 14)}/>
      {PROPS.map((p, i) => <Sprite key={i} name={p.sprite} animate={p.animate} className="fv-scene__prop" style={at(p.x, p.y, 20 + p.y + SPRITES[p.sprite].h)}/>)}
      {dusk && <div className="fv-scene__dusk"/>}
    </div>
  </div>
}
