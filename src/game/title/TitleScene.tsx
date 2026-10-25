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
const tree = (x: number, y: number): Placed => ({ sprite: 'world/props/tree-round', x, y, animate: true })
const bush = (x: number, y: number): Placed => ({ sprite: 'world/props/bush', x, y, animate: true })

/**
 * Every desktop viewport shows the 320x180 core (art px 80..400 wide; 1366x768 shows 69..411, 1440x900 60..420).
 * Standalone props sit fully inside the core or fully outside x 58..422 so no viewport cuts one in half; the pine
 * line leaves a gap over those edge bands for the same reason.
 */
// A scattered forest receding into the distance: a cool, small far band along the horizon, a darker mid band in
// front of it and a few full-size pines nearest the meadow. Seeded jitter keeps the scatter the same every load.
const jitter = (i: number, salt: number, range: number): number => {
  const h = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return Math.floor((h - Math.floor(h)) * range)
}
const band = (name: string, pines: number, rounds: number): { pines: SpriteName[]; rounds: SpriteName[] } => ({
  pines: Array.from({ length: pines }, (_, i) => `title/scene/pine-${name}-${i}` as SpriteName),
  rounds: Array.from({ length: rounds }, (_, i) => `title/scene/tree-${name}-${i}` as SpriteName),
})
const HAZE = band('haze', 3, 2), FAR = band('far', 3, 2), MID = band('mid', 3, 2)
const NEAR = { pines: ['world/extra/pine-tree'] as SpriteName[], rounds: MID.rounds } // the nearest band keeps its broadleaves small
const forest: Placed[] = []
/** Scatter one depth band: ~70% evergreens, ~30% broadleaf, irregular gaps, the odd tree missing. */
const scatter = (b: { pines: SpriteName[]; rounds: SpriteName[] }, from: number, gap: number, gapSpread: number, base: number, baseSpread: number, salt: number) => {
  for (let x = from, i = 0; x < MAP_W; x += gap + jitter(i, salt, gapSpread), i++) {
    if (jitter(i, salt + 1, 10) < 2) continue // the odd missing tree
    const names = jitter(i, salt + 4, 10) < 3 ? b.rounds : b.pines
    const name = names[jitter(i, salt + 2, names.length)] ?? names[0]!
    forest.push({ sprite: name, x, y: base + jitter(i, salt + 3, baseSpread) - SPRITES[name].h })
  }
}
scatter(HAZE, -3, 3, 2, 145, 2, 40) // a pale, unbroken line of tiny trees along the whole horizon
scatter(FAR, -4, 5, 4, 146, 3, 10)
scatter(MID, -2, 10, 8, 149, 4, 20)
scatter(NEAR, 6, 44, 40, 154, 4, 30)

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
