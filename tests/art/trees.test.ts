import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { paletteMap, parseGrid, pngBytes, renderSheet } from '../../scripts/art/grid.mjs'
import { SPRITES } from '../../src/game/art/manifest'

it('keeps the complete tree canopy inside both frames and preserves the rooted sway', () => {
  const { colors } = JSON.parse(readFileSync('art-src/palette.json', 'utf8'))
  const palette = paletteMap(colors)
  const parsed = parseGrid(readFileSync('art-src/world/props/tree-round.txt', 'utf8'), palette)
  const rest = parsed.frames[0]!
  const sway = parsed.frames[1]!
  expect(parsed.meta.speed).toBe(900)
  expect(parsed.frames).toHaveLength(2)
  expect(SPRITES['world/props/tree-round']).toMatchObject({ w: parsed.meta.w, h: parsed.meta.h, speed: 900, frames: ['0', '1'] })
  for (const frame of parsed.frames) {
    for (const row of frame.rows) {
      expect(row[0]).toBe('.')
      expect(row.at(-1)).toBe('.')
    }
  }
  // The canopy moves one pixel; the lower branches and trunk stay planted.
  for (let y = 0; y < parsed.meta.h; y++) {
    expect(sway.rows[y]).toEqual(y >= 1 && y <= 13 ? ['.', ...rest.rows[y]!.slice(0, -1)] : rest.rows[y])
  }
  // The restored right silhouette tapers instead of ending at the old crop line.
  const right = (y: number) => rest.rows[y]!.join('').replace(/\.+$/, '').length - 1
  expect(right(9)).toBeGreaterThan(21)
  expect(right(4)).toBeLessThan(right(9))
  expect(right(16)).toBeLessThan(right(9))
  expect(Buffer.from(pngBytes(renderSheet(parsed.frames, palette)))).toEqual(readFileSync('public/art/world/props/tree-round.png'))
})
