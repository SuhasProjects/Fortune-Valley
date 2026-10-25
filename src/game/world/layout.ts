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
const tuft = at('world/extra/grass-tuft')
const tuft2 = at('world/extra/grass-tuft-2')
const shrooms = at('world/extra/mushrooms')
const log = at('world/extra/log')
const stump = at('world/extra/stump')
const whiteFlowers = at('world/props/flowers-white', true)
const mixedFlowers = at('world/props/flowers-mixed', true)

/**
 * Map columns a window's left or right edge can fall on (the window is centred on the map, so at the laptop sizes
 * we support the left edge lands on x 55–86 and the right on x 394–426). No prop may straddle either band, or it
 * would be cut in half at the side of the screen on some monitor (TownWorld.test "edge bands").
 */
export const EDGE_BANDS: readonly (readonly [number, number])[] = [[55, 86], [394, 426]]

/**
 * Where a road or the river runs off the map (art px along each edge, from scripts/art's ground mask): the border's
 * fringe (EdgeBorder) leaves these bare so nothing grows across a road.
 */
export const EDGE_BARE = { top: [[187, 196]], bottom: [[153, 173], [235, 244], [318, 325]], left: [[140, 149], [159, 179]], right: [[124, 134]] } as Record<'top' | 'bottom' | 'left' | 'right', [number, number][]>

/** The four round trees the reference puts in the core's corners; the only ring-ish objects allowed inside the core. */
export const CORE_CORNER_TREES: PlacedSprite[] = [tree(97, 69), tree(353, 68), tree(97, 185), tree(353, 185)]

/** Props inside the 320x180 core (from the reference), plus small scenery along the core's edges. */
export const CORE_PROPS: PlacedSprite[] = [
  { sprite: 'world/props/fountain', x: 221, y: 131, animate: true },
  { sprite: 'world/props/lamp', x: 178, y: 118 },
  { sprite: 'world/props/bench', x: 272, y: 128 },
  whiteFlowers(166, 127), mixedFlowers(336, 205), whiteFlowers(110, 212),
  ...CORE_CORNER_TREES,
  lily(90, 175), lily(110, 183), lily(126, 197), lily(140, 219),
  // The field left of Pine Bank: the farm's hay, crates and signpost by the river road, with a bush and tufts.
  tuft(88, 64), hay(86, 94), hay(90, 104), crate(88, 114), crate(96, 118), { sprite: 'world/extra/signpost', x: 102, y: 116 },
  mixedFlowers(100, 98), tuft2(92, 126),
  // Along the top edge (the HUD hides rows above ~76 at the common window sizes, so the decor sits just over the eaves).
  shrooms(122, 76), tuft2(130, 78), bush(136, 72), whiteFlowers(154, 71), rock(174, 68), tuft(172, 78),
  mixedFlowers(302, 76), shrooms(320, 80), tuft2(330, 78), rock(340, 78), tuft(346, 78), bush(376, 74), tuft(380, 80), shrooms(384, 76),
  // Between the office and the Health House, and the strip east of the Health House.
  bush(278, 78), mixedFlowers(280, 90), tuft(278, 100), tuft2(286, 104), rock(282, 112), shrooms(286, 120),
  tuft(386, 88), tuft2(368, 96), bush(378, 100), shrooms(372, 112), rock(368, 122), whiteFlowers(376, 124),
  // Right of the Market Hall, under the corner tree.
  rock(360, 154), tree(366, 158), tuft(350, 168), mixedFlowers(356, 172), tuft(348, 180), bush(382, 186), whiteFlowers(378, 198),
  stump(382, 212), shrooms(366, 214), rock(384, 222), bush(350, 222), tuft2(362, 226), log(348, 230), tuft2(304, 214), rock(336, 222),
  // Below Pine Bank, above the lake, and the bottom-left corner of the core by the river mouth.
  tree(120, 152), bush(94, 154), mixedFlowers(106, 152), rock(108, 160), tuft(100, 164), tuft2(140, 158),
  tuft2(92, 206), bush(88, 222), rock(102, 228), shrooms(118, 206),
]

/** Scenery in the outer ring: never inside the core, never on a path or building (enforced by TownWorld.test). */
export const RING_PROPS: PlacedSprite[] = [
  // Top: a pine line broken by round trees, with the north road (x 189–194) passing between a mailbox and a signpost.
  pine(2, 14), tree(22, 8), pine(37, 2), pine(14, 40), bush(2, 46), pine(36, 34), shrooms(30, 30),
  tree(86, 14), pine(106, 2), pine(124, 14), tree(142, 4), tuft(112, 34), tuft2(150, 30), whiteFlowers(96, 38), rock(130, 44),
  pine(160, 18), { sprite: 'world/extra/mailbox', x: 178, y: 38 }, { sprite: 'world/extra/signpost', x: 200, y: 34 },
  pine(210, 10), tree(232, 18), pine(258, 6), pine(278, 20), tree(300, 8), pine(326, 14), tree(348, 22), pine(372, 8),
  shrooms(226, 40), tuft(248, 36), mixedFlowers(262, 40), rock(296, 36), tuft2(316, 44), log(336, 46), tuft(362, 44), shrooms(376, 38),
  tree(428, 2), pine(452, 8), bush(462, 38), tuft2(434, 30), rock(446, 40),
  // Left: the farm plot (soil x 12–63, y 70–121) fenced in, with a scarecrow; its gear sits in the field by the bank.
  fence(10, 64), fence(22, 64), fence(34, 64),
  post(9, 72), post(9, 84), post(9, 96), post(9, 108), post(48, 72), post(48, 84), post(48, 96), post(48, 108),
  fence(10, 116), fence(22, 116), fence(34, 116),
  { sprite: 'world/ring/scarecrow', x: 30, y: 84 },
  tuft(4, 128), mixedFlowers(20, 126), tuft2(40, 130),
  lily(10, 163), lily(36, 167), lily(44, 172),
  pine(30, 196), pine(8, 214), tree(27, 238), rock(10, 250), pine(6, 258), rock(40, 266), tuft(6, 196), shrooms(26, 226), tuft2(42, 262),
  // Right: a well, pines, and the pond (water x 418–460, y 141–161) with rocks and a bench.
  { sprite: 'world/extra/well', x: 428, y: 64 }, tree(450, 56), pine(460, 84), tree(430, 100), rock(456, 112), shrooms(464, 118),
  { sprite: 'world/props/bench', x: 426, y: 166 }, { sprite: 'world/extra/signpost', x: 468, y: 138 },
  rock(458, 164), lily(430, 146), lily(444, 150),
  bush(460, 170), pine(430, 180), pine(456, 186), tree(432, 206), stump(458, 214), tuft2(448, 230), log(428, 232),
  // Bottom: the river (x 146–170) with lily pads, fences along the south road (x 229–252), the market lane (x 313–329).
  pine(96, 240), stump(122, 252), lily(152, 243), lily(158, 267), rock(188, 244), tuft(108, 266), shrooms(132, 240), bush(112, 274),
  tree(200, 256), fence(256, 246), fence(268, 246), mixedFlowers(260, 258), tuft2(176, 262), log(210, 244), tuft(226, 262), shrooms(196, 280),
  tree(284, 250), crate(300, 238), crate(332, 240), bush(330, 262), pine(344, 236), pine(372, 248), tuft(288, 240), tuft2(310, 262), rock(348, 268), shrooms(362, 238),
  whiteFlowers(378, 266), tree(428, 252), pine(456, 236), rock(466, 268), tuft(452, 274), shrooms(436, 240),
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
