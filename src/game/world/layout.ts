import type { BuildingId } from '@/types/domain'
import type { SpriteName } from '../art/manifest'
import { CORE_OFFSET_Y, HUD_H } from '../stage/scale'

/**
 * Where everything sits on the 480x288 map, in art pixels (sprite top-left corners). The core town reproduces
 * the reference image's layout: positions were measured from it by scripts/art (see AGENT_1.md §6). The outer
 * ring is scenery that only shows on wide or tall windows (1440x900 shows map x 60–420, y 32–257).
 */
export interface PlacedSprite { sprite: SpriteName; x: number; y: number; animate?: boolean }

export const BUILDING_LAYOUT: Record<BuildingId, { x: number; y: number }> = {
  bank: { x: 115, y: 84 },
  office: { x: 205, y: 76 },
  hospital: { x: 295, y: 87 },
  home: { x: 151, y: 148 },
  market: { x: 259, y: 150 },
}

/**
 * Clearance between the HUD's bottom edge and the highest roof, art px, on top of the 1 px hover lift. Zero: at a
 * 180-row viewport the Town Office's tower peak, the plaza and the bottom row's plaques use every row between the
 * HUD and the control bar.
 */
export const ROOF_CLEARANCE = 0
/**
 * The map row that sits at the top of the viewport when the viewport is the shortest it can be (the 180-row core).
 * Centred on the core normally; moved up (showing less of the ring above the town) when the HUD would otherwise
 * cover the top row of buildings. TownWorld clamps its window to this; the bottom row still clears the control bar.
 */
export const WINDOW_TOP_MAX = Math.min(CORE_OFFSET_Y, Math.min(...Object.values(BUILDING_LAYOUT).map((b) => b.y)) - 1 - ROOF_CLEARANCE - HUD_H)

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
  { sprite: 'world/props/fountain', x: 221, y: 131, animate: true },
  { sprite: 'world/props/lamp', x: 178, y: 118 },
  { sprite: 'world/props/bench', x: 272, y: 128 },
  { sprite: 'world/props/flowers-white', x: 166, y: 127, animate: true },
  { sprite: 'world/props/flowers-mixed', x: 336, y: 205, animate: true },
  { sprite: 'world/props/flowers-white', x: 110, y: 212, animate: true },
  ...CORE_CORNER_TREES,
  lily(90, 175), lily(110, 183), lily(126, 197), lily(140, 219),
]

/** Scenery in the outer ring: never inside the core, never on a path or building (enforced by TownWorld.test). */
export const RING_PROPS: PlacedSprite[] = [
  // Top: a pine line broken by round trees, with the north road (x 189–194) passing between a mailbox and a signpost.
  pine(2, 14), tree(22, 8), pine(14, 40), bush(40, 40), pine(46, 18), pine(66, 8), tree(90, 16), pine(118, 12), tree(142, 4),
  pine(160, 18), { sprite: 'world/extra/mailbox', x: 178, y: 38 }, { sprite: 'world/extra/signpost', x: 200, y: 34 },
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
  lily(10, 163), lily(36, 167), lily(62, 171),
  pine(60, 204), pine(40, 222), tree(8, 232), rock(68, 236), pine(64, 250),
  // Right: a well, pines, and the pond (water x 418–460, y 141–161) with rocks and a bench.
  { sprite: 'world/extra/well', x: 404, y: 62 }, tree(440, 60), pine(460, 70), pine(404, 86), tree(452, 100),
  { sprite: 'world/props/bench', x: 426, y: 166 }, { sprite: 'world/extra/signpost', x: 468, y: 138 },
  rock(400, 150), rock(436, 112), rock(408, 160), rock(458, 164), lily(430, 146), lily(444, 150),
  bush(460, 170), pine(404, 176), pine(456, 186), tree(430, 200), { sprite: 'world/extra/stump', x: 412, y: 214 },
  // Bottom: the river (x 146–170) with lily pads, fences along the south road (x 229–252), the market lane (x 313–329).
  pine(96, 240), { sprite: 'world/extra/stump', x: 122, y: 252 }, lily(152, 243), lily(158, 267), rock(188, 244),
  tree(200, 256), fence(256, 246), fence(268, 246), { sprite: 'world/props/flowers-mixed', x: 260, y: 258, animate: true },
  tree(284, 250), crate(300, 238), crate(332, 240), bush(330, 262), pine(344, 236), pine(372, 248),
  tree(396, 254), { sprite: 'world/props/flowers-white', x: 404, y: 236, animate: true }, pine(424, 238), rock(452, 250), pine(458, 236),
]

export const PROPS: PlacedSprite[] = [...CORE_PROPS, ...RING_PROPS]

/** Chimney tops: Your Home and Health House puff smoke. */
export const SMOKE: { x: number; y: number }[] = [
  { x: 169, y: 139 },
  { x: 350, y: 78 },
]

export const LAMP = { x: 178, y: 118 }

/**
 * Art px between the bottom of a "decision waiting" badge and the top of its building's sprite. Negative: the badge
 * hangs over the roof peak (its bottom 14 px below the sprite top), so even above the Town Office, whose peak sits
 * right under the HUD at a 180-row viewport, the whole badge (2 px bob included) stays clear of the HUD.
 */
export const BADGE_GAP = -14

/** The Town Office clock hand: sprite top-left relative to the office sprite (face centre at 34,19 in office.txt). */
export const CLOCK = { sprite: 'world/extra/clock-hand' as const, x: 31, y: 16 }

/**
 * Villagers walk their route once (feet positions, map px; the sprite's anchor is its feet), then vanish at the last
 * waypoint (a door or a point just off the map edge), rest hidden for `rest` ms and reappear at the start.
 * Segments may be diagonal; one art px (Chebyshev) per VILLAGER_STEP_MS. Every waypoint sits on a road or the
 * plaza ring (scripts/art/roads.mjs), which TownWorld.test samples; nobody crosses the fountain or a building.
 */
export interface Villager { id: string; sprite: SpriteName; route: { x: number; y: number }[]; delay: number; rest: number }
const pt = (x: number, y: number) => ({ x, y })
/** The eight vertices of the plaza ring road (radius 22 around the fountain at 240,145; scripts/art/roads.mjs PLAZA), clockwise from north. */
export const RING = { n: pt(240, 123), ne: pt(256, 129), e: pt(262, 145), se: pt(256, 161), s: pt(240, 167), sw: pt(224, 161), w: pt(218, 145), nw: pt(224, 129) }
/** Where each building's door meets its path (feet position on the bottom row of the sprite). */
export const DOORS: Record<BuildingId, { x: number; y: number }> = { bank: pt(151, 133), office: pt(239, 125), hospital: pt(332, 133), home: pt(187, 192), market: pt(310, 198) }
export const VILLAGERS: Villager[] = [
  // Town Office door, round the north-west of the plaza, west along the road, up Pine Bank's path and in.
  { id: 'a', sprite: 'world/ring/villager-a', route: [DOORS.office, RING.nw, RING.w, pt(205, 145), pt(151, 145), DOORS.bank], delay: -4000, rest: 9000 },
  // Market Hall door, down the lane and off the south edge.
  { id: 'b', sprite: 'world/ring/villager-b', route: [DOORS.market, pt(310, 207), pt(322, 207), pt(322, 296)], delay: -14000, rest: 12000 },
  // In from the north edge, down the north road, round the south side of the plaza, out along the east road past the pond.
  { id: 'c', sprite: 'world/ring/villager-c', route: [pt(192, -6), pt(192, 116), RING.w, RING.sw, RING.s, RING.se, RING.e, pt(392, 145), pt(410, 130), pt(490, 130)], delay: -20000, rest: 8000 },
  // In from the west edge along the river road, round the south of the plaza, down the south road and home.
  { id: 'd', sprite: 'world/ring/villager-d', route: [pt(-8, 145), pt(205, 145), RING.w, RING.sw, RING.s, pt(240, 206), pt(187, 206), DOORS.home], delay: -31000, rest: 10000 },
  // Health House to the Town Office, round the north-east of the plaza.
  { id: 'e', sprite: 'world/ring/villager-e', route: [DOORS.hospital, pt(332, 145), RING.e, RING.ne, DOORS.office], delay: -9000, rest: 14000 },
  // Up the south road from the bottom edge, round the east of the plaza and out past the pond.
  { id: 'f', sprite: 'world/ring/villager-a', route: [pt(240, 296), RING.s, RING.se, RING.e, pt(392, 145), pt(410, 130), pt(490, 130)], delay: -47000, rest: 16000 },
]

export const VILLAGER_STEP_MS = 120

/** Fireflies at dusk (positions; each bobs on its own CSS cycle). */
export const FIREFLIES: { x: number; y: number; delay: number }[] = [
  { x: 140, y: 120, delay: 0 }, { x: 200, y: 160, delay: 700 }, { x: 250, y: 110, delay: 1400 }, { x: 310, y: 150, delay: 300 },
  { x: 330, y: 95, delay: 1100 }, { x: 180, y: 210, delay: 900 }, { x: 290, y: 215, delay: 500 }, { x: 120, y: 95, delay: 1600 },
]
