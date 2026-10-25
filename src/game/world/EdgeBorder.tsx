import type { CSSProperties } from 'react'
import { Sprite } from '../art/Sprite'
import { SPRITES, type SpriteName } from '../art/manifest'
import { EDGE_TILE, MAP_H, MAP_W } from '../stage/scale'
import './edge.css'

/**
 * The valley past the 480x288 map on tall or ultrawide windows (scale.ts): 48x48 grass tiles in four variants
 * (`world/edge-tile`, scripts/art/edge-tile.mjs) chosen per tile by a hash of its position, some mirrored, with every
 * other row shifted half a tile so no grid reads through; plus a fringe of tufts, bushes, rocks and flowers scattered
 * across the map's edge so the boundary is an irregular line of growth, not a seam. Everything is positioned in map
 * art px times `px`, relative to the stage, with the map's top-left at (`left`, `top`) CSS px.
 */
export interface EdgeBorderProps {
  left: number; top: number; px: number
  /** Viewport size in CSS px. */
  width: number; height: number
  /** Map rows above this get no tiles (the title's sky and hills stand there). */
  fromRow?: number
  /** Which map edges to fringe (those the window shows past). */
  edges: { top: boolean; bottom: boolean; left: boolean; right: boolean }
  /** Map-edge spans (art px along the edge) left bare: where a road or river runs off the map. */
  bare?: { top?: [number, number][]; bottom?: [number, number][]; left?: [number, number][]; right?: [number, number][] }
  dusk?: boolean
}

export const VARIANTS = 4
export const FRINGE_STEP = 14

/** Deterministic 32-bit hash of a tile or fringe slot; stable across renders so the border never shimmers. */
export const hash = (a: number, b: number, salt = 0) => {
  let h = Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(salt + 1, 83492791)
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
  return (h ^ (h >>> 15)) >>> 0
}

const FRINGE: SpriteName[] = ['world/extra/grass-tuft', 'world/extra/grass-tuft-2', 'world/props/bush', 'world/extra/rock', 'world/props/flowers-white', 'world/extra/grass-tuft', 'world/extra/mushrooms', 'world/props/flowers-mixed', 'world/extra/grass-tuft-2', 'world/extra/log']

export interface Tile { col: number; row: number; x: number; y: number; variant: number; mirror: boolean }

/** Tiles that cover the visible stage outside the map (map art px). Odd rows start half a tile to the left. */
export function tileLayout(x0: number, y0: number, x1: number, y1: number, fromRow = -Infinity): Tile[] {
  const T = EDGE_TILE
  const out: Tile[] = []
  for (let row = Math.floor(Math.max(y0, fromRow) / T); row * T < y1; row++) {
    const shift = row & 1 ? T / 2 : 0
    for (let col = Math.floor((x0 + shift) / T); col * T - shift < x1; col++) {
      const x = col * T - shift, y = row * T
      if (x >= 0 && y >= Math.max(0, fromRow) && x + T <= MAP_W && y + T <= MAP_H) continue // hidden under the map
      const h = hash(col, row)
      out.push({ col, row, x, y, variant: (h >>> 4) % VARIANTS, mirror: (h & 1) === 1 })
    }
  }
  return out
}

export interface FringeProp { sprite: SpriteName; x: number; y: number }

/** Props along one map edge, one every FRINGE_STEP art px with hashed jitter, their anchors straddling the edge. */
export function fringe(edge: 'top' | 'bottom' | 'left' | 'right', bare: [number, number][] = [], fromRow = -Infinity): FringeProp[] {
  const along = edge === 'top' || edge === 'bottom' ? MAP_W : MAP_H
  const out: FringeProp[] = []
  for (let i = 0, salt = ['top', 'bottom', 'left', 'right'].indexOf(edge); i * FRINGE_STEP < along; i++) {
    const h = hash(i, 0, salt)
    const at = i * FRINGE_STEP + (h % 9) - 4
    if (at < 0 || at >= along) continue
    if (bare.some(([a, b]) => at >= a - 6 && at <= b + 6)) continue
    const sprite = FRINGE[(h >>> 8) % FRINGE.length]!
    const meta = SPRITES[sprite]
    const [ax, ay] = meta.anchor ?? [Math.floor(meta.w / 2), meta.h - 1]
    const across = ((h >>> 16) % 7) - 3 // -3..3 art px either side of the edge
    const x = edge === 'top' || edge === 'bottom' ? at - ax : (edge === 'left' ? 0 : MAP_W) + across - ax
    const y = edge === 'left' || edge === 'right' ? at - ay : (edge === 'top' ? 0 : MAP_H) + across - ay
    if (edge !== 'top' && edge !== 'bottom' && at < fromRow) continue
    out.push({ sprite, x, y })
  }
  return out
}

export function EdgeBorder({ left, top, px, width, height, fromRow = -Infinity, edges, bare = {}, dusk = false }: EdgeBorderProps) {
  const x0 = Math.floor(-left / px), y0 = Math.floor(-top / px)
  const x1 = Math.ceil((width - left) / px), y1 = Math.ceil((height - top) / px)
  const tiles = tileLayout(x0, y0, x1, y1, fromRow)
  const props = (['top', 'bottom', 'left', 'right'] as const).filter((e) => edges[e]).flatMap((e) => fringe(e, bare[e], fromRow))
  const at = (x: number, y: number): CSSProperties => ({ left: left + x * px, top: top + y * px })
  // The dusk wash covers everything but the map, which has its own (clip-path even-odd ring around the map rect).
  const L = left, T = top, R = left + MAP_W * px, B = top + MAP_H * px
  const ring = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${L}px ${T}px, ${L}px ${B}px, ${R}px ${B}px, ${R}px ${T}px, ${L}px ${T}px)`
  return <div className="fv-edge" aria-hidden="true" data-tiles={tiles.length}>
    {tiles.map((t) => <Sprite key={`${t.col},${t.row}`} name="world/edge-tile" frame={t.variant} className={`fv-edge__tile${t.mirror ? ' fv-edge__tile--mirror' : ''}`} style={at(t.x, t.y)}/>)}
    {props.map((p, i) => <Sprite key={i} name={p.sprite} className="fv-edge__fringe" style={{ ...at(p.x, p.y), zIndex: p.y + SPRITES[p.sprite].h }}/>)}
    {dusk && <div className="fv-edge__dusk" style={{ clipPath: ring }}/>}
  </div>
}
