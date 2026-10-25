import { describe, expect, it } from 'vitest'
import { EDGE_BARE } from './layout'
import { FRINGE_STEP, VARIANTS, fringe, hash, tileLayout } from './EdgeBorder'
import { EDGE_TILE, MAP_H, MAP_W } from '../stage/scale'

describe('edge border', () => {
  it('tiles every visible art px outside the map, none fully under it, with all four variants and both mirrors in play', () => {
    // 900x1200 at zoom 2: 450x600 art px, the map centred (x -15..465 of 480, y -156..444 of 288).
    const tiles = tileLayout(15, -156, 465, 444)
    expect(tiles.some((t) => t.y < 0), 'rows above the map').toBe(true)
    expect(tiles.some((t) => t.y + EDGE_TILE > MAP_H), 'rows below the map').toBe(true)
    for (const t of tiles) expect(t.x >= 0 && t.y >= 0 && t.x + EDGE_TILE <= MAP_W && t.y + EDGE_TILE <= MAP_H, `tile ${t.x},${t.y} hidden under the map`).toBe(false)
    for (let y = -156; y < 444; y += 7) for (let x = 15; x < 465; x += 7) {
      const inMap = x >= 0 && y >= 0 && x < MAP_W && y < MAP_H
      if (!inMap) expect(tiles.some((t) => x >= t.x && x < t.x + EDGE_TILE && y >= t.y && y < t.y + EDGE_TILE), `${x},${y} covered`).toBe(true)
    }
    expect(new Set(tiles.map((t) => t.variant)).size).toBe(VARIANTS)
    expect(new Set(tiles.map((t) => t.mirror)).size).toBe(2)
    expect(tiles.filter((t) => t.row % 2 !== 0).every((t) => (t.x + EDGE_TILE / 2) % EDGE_TILE === 0), 'odd rows shifted half a tile').toBe(true)
  })

  it('starts at fromRow for the title and is deterministic', () => {
    const tiles = tileLayout(-80, -100, 560, 400, 146)
    expect(tiles.every((t) => t.y + EDGE_TILE > 146)).toBe(true)
    expect(tileLayout(-80, -100, 560, 400, 146)).toEqual(tiles)
    expect(hash(3, 4)).toBe(hash(3, 4))
    expect(hash(3, 4)).not.toBe(hash(4, 3))
  })

  it('fringes every edge at FRINGE_STEP spacing, straddling the edge, never across a road or river', () => {
    for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
      const props = fringe(edge, EDGE_BARE[edge])
      const along = edge === 'top' || edge === 'bottom' ? MAP_W : MAP_H
      expect(props.length).toBeGreaterThanOrEqual(along / FRINGE_STEP - 2 - EDGE_BARE[edge].length * 3)
      for (const p of props) {
        const feet = edge === 'top' || edge === 'bottom' ? p.x + 7 : p.y + 10 // roughly the anchor
        for (const [a, b] of EDGE_BARE[edge]) expect(feet < a - 2 || feet > b + 2, `${edge} prop at ${feet} on a bare span ${a}-${b}`).toBe(true)
      }
    }
  })
})
