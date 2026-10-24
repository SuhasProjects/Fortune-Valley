import type { BuildingId } from '@/types/domain'
import type { SpriteName } from '../art/manifest'

/**
 * Where everything sits on the 480x288 map, in art pixels (sprite top-left corners). The core town reproduces
 * the reference image's layout: positions were measured from it by scripts/art (see AGENT_1.md §6). The outer
 * ring is scenery that only shows on wide or tall windows.
 */
export interface PlacedSprite { sprite: SpriteName; x: number; y: number; animate?: boolean }

export const BUILDING_LAYOUT: Record<BuildingId, { x: number; y: number }> = {
  bank: { x: 115, y: 72 },
  office: { x: 205, y: 72 },
  hospital: { x: 295, y: 77 },
  home: { x: 151, y: 148 },
  market: { x: 259, y: 150 },
}

const tree = (x: number, y: number): PlacedSprite => ({ sprite: 'world/props/tree-round', x, y, animate: true })
const bush = (x: number, y: number): PlacedSprite => ({ sprite: 'world/props/bush', x, y, animate: true })

export const PROPS: PlacedSprite[] = [
  // Core (from the reference)
  { sprite: 'world/props/fountain', x: 221, y: 127, animate: true },
  { sprite: 'world/props/lamp', x: 192, y: 123 },
  { sprite: 'world/props/bench', x: 295, y: 132 },
  { sprite: 'world/props/flowers-white', x: 170, y: 130, animate: true },
  { sprite: 'world/props/flowers-mixed', x: 336, y: 205, animate: true },
  { sprite: 'world/props/flowers-white', x: 110, y: 212, animate: true },
  tree(97, 69), tree(353, 68), tree(97, 185), tree(353, 185),
  { sprite: 'world/props/lilypad', x: 106, y: 173, animate: true },
  { sprite: 'world/props/lilypad', x: 122, y: 190, animate: true },
  { sprite: 'world/props/lilypad', x: 96, y: 205, animate: true },
  { sprite: 'world/props/lilypad', x: 112, y: 228, animate: true },
  // Outer ring
  tree(16, 6), tree(58, 14), tree(132, 10), tree(170, 24), tree(262, 8), tree(300, 20), tree(392, 10), tree(436, 18),
  tree(8, 232), tree(440, 60), tree(452, 100), tree(430, 200), tree(450, 236), tree(200, 256), tree(284, 250), tree(396, 254),
  tree(70, 128), tree(20, 150),
  bush(40, 40), bush(230, 30), bush(420, 44), bush(330, 262), bush(460, 170), bush(12, 180),
  { sprite: 'world/props/flowers-mixed', x: 80, y: 60, animate: true },
  { sprite: 'world/props/flowers-white', x: 410, y: 232, animate: true },
  { sprite: 'world/props/flowers-mixed', x: 240, y: 268, animate: true },
  { sprite: 'world/props/bench', x: 400, y: 118 },
  { sprite: 'world/props/lilypad', x: 430, y: 146, animate: true },
  { sprite: 'world/props/lilypad', x: 446, y: 152, animate: true },
  { sprite: 'world/props/lilypad', x: 30, y: 262, animate: true },
]

/** Chimney tops: Your Home and Health House puff smoke. */
export const SMOKE: { x: number; y: number }[] = [
  { x: 157, y: 139 },
  { x: 350, y: 68 },
]

export const LAMP = { x: 192, y: 123 }

/** Fireflies at dusk (positions; each bobs on its own CSS cycle). */
export const FIREFLIES: { x: number; y: number; delay: number }[] = [
  { x: 140, y: 120, delay: 0 }, { x: 200, y: 160, delay: 700 }, { x: 250, y: 110, delay: 1400 }, { x: 310, y: 150, delay: 300 },
  { x: 330, y: 95, delay: 1100 }, { x: 180, y: 210, delay: 900 }, { x: 290, y: 215, delay: 500 }, { x: 120, y: 95, delay: 1600 },
]
