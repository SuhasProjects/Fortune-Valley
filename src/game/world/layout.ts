import type { BuildingId } from '@/types/domain'
import type { SpriteName } from '../art/manifest'

/**
 * Where everything sits on the 480x288 map, in art pixels (sprite top-left corners). The core town reproduces
 * the reference image's layout: positions were measured from it by scripts/art (see AGENT_1.md §6). The outer
 * ring is scenery that only shows on wide or tall windows (1440x900 shows map x 60–420, y 32–257).
 */
export interface PlacedSprite { sprite: SpriteName; x: number; y: number; animate?: boolean }

export const BUILDING_LAYOUT: Record<BuildingId, { x: number; y: number }> = {
  bank: { x: 115, y: 72 },
  office: { x: 205, y: 72 },
  hospital: { x: 295, y: 77 },
  home: { x: 151, y: 148 },
  market: { x: 259, y: 150 },
}

const at = (sprite: SpriteName, animate = false) => (x: number, y: number): PlacedSprite => ({ sprite, x, y, animate })
const tree = at('world/props/tree-round', true)
const bush = at('world/props/bush', true)
const pine = at('world/extra/pine-tree', true)
const lily = at('world/props/lilypad', true)
const fence = at('world/extra/fence-h')
const post = at('world/extra/fence-post')
const rock = at('world/extra/rock')
const hay = at('world/extra/hay-bale')
const crate = at('world/ring/crate')

/** The four round trees the reference puts in the core's corners; the only ring-ish objects allowed inside the core. */
export const CORE_CORNER_TREES: PlacedSprite[] = [tree(97, 69), tree(353, 68), tree(97, 185), tree(353, 185)]

/** Props inside the 320x180 core (from the reference). */
export const CORE_PROPS: PlacedSprite[] = [
  { sprite: 'world/props/fountain', x: 221, y: 127, animate: true },
  { sprite: 'world/props/lamp', x: 192, y: 123 },
  { sprite: 'world/props/bench', x: 295, y: 132 },
  { sprite: 'world/props/flowers-white', x: 170, y: 130, animate: true },
  { sprite: 'world/props/flowers-mixed', x: 336, y: 205, animate: true },
  { sprite: 'world/props/flowers-white', x: 110, y: 212, animate: true },
  ...CORE_CORNER_TREES,
  lily(106, 173), lily(122, 190), lily(96, 205), lily(112, 228),
]

/** Scenery in the outer ring: never inside the core, never on a path or building (enforced by TownWorld.test). */
export const RING_PROPS: PlacedSprite[] = [
  // Top: a pine line broken by round trees, with the north road (x 189–194) passing between a mailbox and a signpost.
  pine(2, 14), tree(22, 8), pine(14, 40), bush(40, 40), pine(46, 18), pine(66, 8), tree(90, 16), pine(118, 12), tree(142, 4),
  pine(160, 18), { sprite: 'world/extra/mailbox', x: 181, y: 38 }, { sprite: 'world/extra/signpost', x: 197, y: 34 },
  pine(210, 10), tree(232, 18), pine(258, 6), pine(278, 20), tree(300, 8), pine(326, 14), tree(348, 22), pine(372, 8),
  pine(392, 18), tree(414, 4), bush(420, 44), pine(440, 12), pine(460, 22),
  // Left: the farm plot (soil x 12–63, y 70–121) fenced in, with a scarecrow, hay and crates by the road.
  pine(62, 40),
  fence(10, 64), fence(22, 64), fence(34, 64), fence(46, 64),
  post(9, 72), post(9, 84), post(9, 96), post(9, 108), post(57, 72), post(57, 84), post(57, 96), post(57, 108),
  fence(10, 116), fence(22, 116), fence(34, 116), fence(46, 116),
  { sprite: 'world/ring/scarecrow', x: 34, y: 84 },
  { sprite: 'world/props/flowers-mixed', x: 66, y: 72, animate: true },
  hay(64, 84), hay(68, 94), crate(66, 106), crate(72, 112), { sprite: 'world/extra/signpost', x: 66, y: 122 },
  lily(40, 160), lily(70, 182), lily(20, 190),
  pine(60, 204), pine(40, 222), tree(8, 232), rock(68, 236), pine(64, 250),
  // Right: a well, pines, and the pond (water x 418–460, y 141–161) with rocks and a bench.
  { sprite: 'world/extra/well', x: 404, y: 62 }, tree(440, 60), pine(462, 70), pine(404, 86), tree(452, 100),
  { sprite: 'world/props/bench', x: 422, y: 124 }, { sprite: 'world/extra/signpost', x: 466, y: 128 },
  rock(412, 134), rock(456, 132), rock(408, 160), rock(458, 164), lily(430, 146), lily(446, 152),
  bush(460, 170), pine(404, 176), pine(456, 186), tree(430, 200), { sprite: 'world/extra/stump', x: 412, y: 214 },
  // Bottom: the river (x 144–186) with lily pads, fences along the south road (x 229–252), the market lane (x 313–329).
  pine(96, 240), { sprite: 'world/extra/stump', x: 122, y: 252 }, lily(152, 244), lily(166, 266), rock(188, 244),
  tree(200, 256), fence(256, 246), fence(268, 246), { sprite: 'world/props/flowers-mixed', x: 260, y: 258, animate: true },
  tree(284, 250), crate(300, 238), crate(332, 240), bush(330, 262), pine(344, 236), pine(372, 248),
  tree(396, 254), { sprite: 'world/props/flowers-white', x: 404, y: 236, animate: true }, pine(424, 238), rock(452, 250), pine(458, 236),
]

export const PROPS: PlacedSprite[] = [...CORE_PROPS, ...RING_PROPS]

/** Chimney tops: Your Home and Health House puff smoke. */
export const SMOKE: { x: number; y: number }[] = [
  { x: 157, y: 139 },
  { x: 350, y: 68 },
]

export const LAMP = { x: 192, y: 123 }

/** The Town Office clock hand: sprite top-left relative to the office sprite (face centre at 34,11 in office.txt). */
export const CLOCK = { sprite: 'world/extra/clock-hand' as const, x: 31, y: 8 }

/**
 * Villagers walk axis-aligned segments between the waypoints (sprite top-left, feet 14 px lower), there and back,
 * one art px per 120 ms. Waypoints stay on the tan paths of the ground mask.
 */
export interface Villager { id: string; sprite: SpriteName; path: { x: number; y: number }[]; delay: number }
export const VILLAGERS: Villager[] = [
  // Town Office door, down to the east–west road, west to Pine Bank's front path and up to its door.
  { id: 'a', sprite: 'world/ring/villager-a', path: [{ x: 233, y: 108 }, { x: 233, y: 132 }, { x: 147, y: 132 }, { x: 147, y: 116 }], delay: 0 },
  // Market Hall door, down its lane and out of town past the south edge of the map.
  { id: 'b', sprite: 'world/ring/villager-b', path: [{ x: 305, y: 194 }, { x: 305, y: 206 }, { x: 318, y: 206 }, { x: 318, y: 274 }], delay: -9000 },
]

export const VILLAGER_STEP_MS = 120

/** Fireflies at dusk (positions; each bobs on its own CSS cycle). */
export const FIREFLIES: { x: number; y: number; delay: number }[] = [
  { x: 140, y: 120, delay: 0 }, { x: 200, y: 160, delay: 700 }, { x: 250, y: 110, delay: 1400 }, { x: 310, y: 150, delay: 300 },
  { x: 330, y: 95, delay: 1100 }, { x: 180, y: 210, delay: 900 }, { x: 290, y: 215, delay: 500 }, { x: 120, y: 95, delay: 1600 },
]
