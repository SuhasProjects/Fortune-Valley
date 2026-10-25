// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { segmentSteps, TownWorld, villagerKeyframes } from './TownWorld'
import { BUILDINGS, BUILDING_IDS } from './landmarks'
import { BADGE_GAP, BUILDING_LAYOUT, EDGE_BANDS, ROOF_CLEARANCE, WINDOW_TOP_MAX, CLOCK, CORE_CORNER_TREES, CORE_PROPS, DOORS, PROPS, RING_PROPS, SMOKE, VILLAGERS, VILLAGER_STEP_MS } from './layout'
import { SPRITES } from '../art/manifest'
import { BAR_TOP, CORE_OFFSET_X, CORE_OFFSET_Y, CORE_H, CORE_W, HUD_H, MAP_H, MAP_W } from '../stage/scale'

/** The ground materials (480x288): `a` road, `s` plaza stone, `h` grass, `u` water... */
const MASK = readFileSync('art-src/world/ground-mask.txt', 'utf8').split('\n').filter((l) => l && !/^(size|kind|---)/.test(l))
const fountainProp = CORE_PROPS.find((p) => p.sprite === 'world/props/fountain')!
/** The fountain's basin (its sprite box minus the transparent corners and the water jet above the rim). */
const FOUNTAIN = { x: fountainProp.x + 3, y: fountainProp.y + 4, w: SPRITES['world/props/fountain'].w - 6, h: SPRITES['world/props/fountain'].h - 4 }

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const stubReducedMotion = (matches: boolean) => vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches, addEventListener() {}, removeEventListener() {} }))

describe('TownWorld', () => {
  it('opens the canonical target for each of the five buildings, in tab order', () => {
    const open = vi.fn()
    render(<TownWorld onBuildingClick={open}/>)
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.getAttribute('data-building'))).toEqual(BUILDING_IDS)
    for (const id of BUILDING_IDS) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Open ${BUILDINGS[id].title}: ${BUILDINGS[id].hint}$`) }))
      expect(open).toHaveBeenLastCalledWith(id)
    }
    expect(open).toHaveBeenCalledTimes(5)
  })

  it('marks only the relevant buildings and never reacts to background clicks', () => {
    const open = vi.fn()
    render(<TownWorld onBuildingClick={open} eventBuildings={['hospital', 'market']}/>)
    expect(screen.getByRole('button', { name: /Health House.*Decision waiting$/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Market Hall.*Decision waiting$/ })).toBeTruthy()
    expect(screen.getAllByLabelText('Decision waiting')).toHaveLength(2)
    fireEvent.click(screen.getByRole('region'))
    expect(open).not.toHaveBeenCalled()
  })

  it('highlights the open building and renders no buttons when decorative', () => {
    const { unmount } = render(<TownWorld onBuildingClick={() => {}} openBuilding="bank"/>)
    expect(screen.getByRole('button', { name: /Pine Bank/ }).getAttribute('data-open')).toBe('true')
    unmount()
    render(<TownWorld timeOfDay="dusk"/>)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByRole('region').getAttribute('data-time')).toBe('dusk')
    expect(document.querySelector('.fv-dusk')).toBeTruthy()
    expect(document.querySelectorAll('.fv-lights').length).toBe(5)
  })

  it('keeps every core object inside the 320x180 core and every sprite in the manifest', () => {
    const inCore = (x: number, y: number, w: number, h: number) => x >= CORE_OFFSET_X && y >= CORE_OFFSET_Y && x + w <= CORE_OFFSET_X + CORE_W && y + h <= CORE_OFFSET_Y + CORE_H
    for (const id of BUILDING_IDS) {
      const meta = SPRITES[`world/buildings/${id}`]
      expect(meta.frames).toEqual(expect.arrayContaining(['hover', 'lights']))
      expect(inCore(BUILDING_LAYOUT[id].x, BUILDING_LAYOUT[id].y, meta.w, meta.h), id).toBe(true)
    }
    for (const p of PROPS) expect(SPRITES[p.sprite], p.sprite).toBeTruthy()
    for (const v of VILLAGERS) expect(SPRITES[v.sprite].frames.length, v.sprite).toBeGreaterThanOrEqual(4)
    expect(SPRITES[CLOCK.sprite].frames).toHaveLength(12)
    expect(SPRITES['world/extra/hourglass'].frames).toHaveLength(6)
    for (const s of SMOKE) expect(inCore(s.x, s.y, 7, 10)).toBe(true)
  })

  it('keeps ring scenery out of the core (except the four corner trees) and on the map', () => {
    const corners = new Set(CORE_CORNER_TREES)
    for (const p of RING_PROPS) {
      const { w, h } = SPRITES[p.sprite]
      expect(corners.has(p)).toBe(false)
      const outside = p.x + w <= CORE_OFFSET_X || p.x >= CORE_OFFSET_X + CORE_W || p.y + h <= CORE_OFFSET_Y || p.y >= CORE_OFFSET_Y + CORE_H
      expect(outside, `${p.sprite} at ${p.x},${p.y} overlaps the core`).toBe(true)
      expect(p.x >= 0 && p.y >= 0 && p.x + w <= MAP_W && p.y + h <= MAP_H, `${p.sprite} at ${p.x},${p.y} leaves the map`).toBe(true)
    }
    // Ring objects never cover a building.
    for (const id of BUILDING_IDS) {
      const b = BUILDING_LAYOUT[id], m = SPRITES[`world/buildings/${id}`]
      for (const p of RING_PROPS) {
        const { w, h } = SPRITES[p.sprite]
        const apart = p.x + w <= b.x || p.x >= b.x + m.w || p.y + h <= b.y || p.y >= b.y + m.h
        expect(apart, `${p.sprite} at ${p.x},${p.y} covers ${id}`).toBe(true)
      }
    }
  })

  it('rotates the office clock hand with monthIndex', () => {
    const { rerender } = render(<TownWorld monthIndex={0}/>)
    const hand = () => document.querySelector<HTMLElement>('.fv-clock')!
    expect(hand().getAttribute('data-sprite')).toBe(CLOCK.sprite)
    expect(hand().style.getPropertyValue('--i')).toBe('0')
    rerender(<TownWorld monthIndex={5}/>)
    expect(hand().style.getPropertyValue('--i')).toBe('5')
    rerender(<TownWorld monthIndex={17}/>)
    expect(hand().style.getPropertyValue('--i')).toBe('5')
    expect(document.querySelectorAll('.fv-clock')).toHaveLength(1)
  })

  it('walks three to six villagers along the roads, one way, vanishing at the end; hidden under reduced motion', () => {
    stubReducedMotion(false)
    const { unmount } = render(<TownWorld/>)
    const villagers = document.querySelectorAll<HTMLElement>('.fv-villager')
    expect(VILLAGERS.length).toBeGreaterThanOrEqual(3)
    expect(VILLAGERS.length).toBeLessThanOrEqual(6)
    expect(villagers).toHaveLength(VILLAGERS.length)
    for (const el of villagers) expect(el.getAttribute('aria-hidden')).toBe('true')
    for (const v of VILLAGERS) {
      expect(v.route.length).toBeGreaterThanOrEqual(2)
      for (let i = 1; i < v.route.length; i++) expect(segmentSteps(v.route[i - 1]!, v.route[i]!), v.id).toBeGreaterThan(0)
      const { css, duration } = villagerKeyframes(v)
      const steps = v.route.slice(1).reduce((n, p, i) => n + segmentSteps(v.route[i]!, p), 0)
      expect(duration).toBe(steps * VILLAGER_STEP_MS + v.rest)
      expect(css).toContain(`@keyframes fv-walk-${v.id}`)
      expect(css).toContain(`@keyframes fv-show-${v.id}`)
      expect(css).toMatch(/opacity: 0; \} 100% \{ opacity: 0; \}/)
      expect(css).not.toMatch(/steps\(0,/)
    }
    expect(new Set(VILLAGERS.map((v) => v.id)).size).toBe(VILLAGERS.length)
    expect(document.querySelector('style')!.textContent).toContain('fv-walk-a')
    unmount()
    stubReducedMotion(true)
    render(<TownWorld/>)
    expect(screen.getByRole('region').className).toContain('fv-still')
    expect(document.querySelectorAll('.fv-villager')).toHaveLength(0)
  })

  it('every villager route stays on roads and plaza stone, and starts and ends at a door or off the map', () => {
    const inFountain = (x: number, y: number) => x >= FOUNTAIN.x && y >= FOUNTAIN.y && x < FOUNTAIN.x + FOUNTAIN.w && y < FOUNTAIN.y + FOUNTAIN.h
    const inBuilding = (x: number, y: number) => BUILDING_IDS.some((id) => {
      const b = BUILDING_LAYOUT[id], m = SPRITES[`world/buildings/${id}`]
      return x >= b.x + 4 && y >= b.y && x < b.x + m.w - 4 && y < b.y + m.h - 2 // walls: sprites keep transparent side margins; the door step is the bottom two rows
    })
    const offMap = (p: { x: number; y: number }) => p.x < 0 || p.y < 0 || p.x >= MAP_W || p.y >= MAP_H
    const atDoor = (p: { x: number; y: number }) => Object.values(DOORS).some((d) => d.x === p.x && d.y === p.y)
    for (const v of VILLAGERS) {
      expect(offMap(v.route[0]!) || atDoor(v.route[0]!), `${v.id} start`).toBe(true)
      expect(offMap(v.route[v.route.length - 1]!) || atDoor(v.route[v.route.length - 1]!), `${v.id} end`).toBe(true)
      let onPath = 0, total = 0
      for (let i = 1; i < v.route.length; i++) {
        const a = v.route[i - 1]!, b = v.route[i]!
        const n = segmentSteps(a, b)
        for (let k = 0; k <= n; k++) {
          const x = Math.round(a.x + ((b.x - a.x) * k) / n), y = Math.round(a.y + ((b.y - a.y) * k) / n)
          if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue
          expect(inFountain(x, y), `${v.id} crosses the fountain at ${x},${y}`).toBe(false)
          if (k > 0 && k < n) expect(inBuilding(x, y), `${v.id} crosses a building at ${x},${y}`).toBe(false)
          total++
          if (MASK[y]![x] === 'a' || MASK[y]![x] === 's') onPath++
        }
      }
      expect(onPath / total, `${v.id}: ${onPath}/${total} samples on a path`).toBeGreaterThanOrEqual(0.9)
    }
  })

  it('props never stand on a road (the fountain sits on its plaza)', () => {
    for (const p of PROPS) {
      if (p.sprite === 'world/props/fountain') continue
      const { w, h } = SPRITES[p.sprite]
      let onPath = 0
      for (let y = Math.max(0, p.y); y < Math.min(MAP_H, p.y + h); y++) for (let x = Math.max(0, p.x); x < Math.min(MAP_W, p.x + w); x++) if (MASK[y]![x] === 'a') onPath++
      expect(onPath, `${p.sprite} at ${p.x},${p.y} covers ${onPath} road px`).toBe(0)
    }
  })

  it('keeps the top row of buildings clear of the HUD at the shortest viewport, badge and hover lift included', () => {
    // A 320x180 viewport shows map rows WINDOW_TOP_MAX..+180; the HUD covers the first HUD_H of them and the
    // control bar the last BAR_TOP. Hover lifts a building 1 px; the badge sits BADGE_GAP px above it; plaques hang 9 px below.
    expect(WINDOW_TOP_MAX).toBeLessThanOrEqual(CORE_OFFSET_Y)
    expect(WINDOW_TOP_MAX).toBeGreaterThanOrEqual(CORE_OFFSET_Y - 8)
    const hudBottom = WINDOW_TOP_MAX + HUD_H, barTop = WINDOW_TOP_MAX + CORE_H - BAR_TOP
    for (const id of BUILDING_IDS) {
      const b = BUILDING_LAYOUT[id], m = SPRITES[`world/buildings/${id}`]
      expect(b.y - 1, `${id} roof under the HUD`).toBeGreaterThanOrEqual(hudBottom + ROOF_CLEARANCE)
      expect(b.y + m.h + 9, `${id} plaque under the control bar`).toBeLessThanOrEqual(barTop)
    }
    // The badge bobs up 2 px; even then it stays clear of the HUD above every building.
    for (const id of BUILDING_IDS) expect(BUILDING_LAYOUT[id].y - BADGE_GAP - SPRITES['world/fx/badge'].h - 2, `${id} badge under the HUD`).toBeGreaterThanOrEqual(hudBottom)
  })

  it('edge bands: no prop straddles a column where a window edge can fall, so nothing is half-cut at the side of the screen', () => {
    expect(EDGE_BANDS).toEqual([[55, 86], [394, 426]])
    for (const p of PROPS) {
      const { w } = SPRITES[p.sprite]
      for (const [a, b] of EDGE_BANDS) expect(p.x + w <= a || p.x >= b, `${p.sprite} at ${p.x},${p.y} (w ${w}) straddles screen-edge band ${a}–${b}`).toBe(true)
    }
  })

  it('props stand on grass, farm soil or a bank, never on water (lily pads float, the fountain has its plaza)', () => {
    for (const p of PROPS) {
      if (p.sprite === 'world/props/fountain' || p.sprite === 'world/props/lilypad') continue
      const { w, h } = SPRITES[p.sprite]
      let wet = 0, dry = 0
      for (let y = Math.max(0, p.y + h - 3); y < Math.min(MAP_H, p.y + h); y++) for (let x = Math.max(0, p.x); x < Math.min(MAP_W, p.x + w); x++) {
        if (MASK[y]![x] === 'u') wet++
        else if ('hjfw'.includes(MASK[y]![x]!)) dry++
      }
      expect(wet, `${p.sprite} at ${p.x},${p.y} stands in water`).toBe(0)
      expect(dry, `${p.sprite} at ${p.x},${p.y} has no ground under it`).toBeGreaterThan(0)
    }
  })

  it('keeps every prop sprite fully on the map, 2 px in from its edges', () => {
    for (const p of PROPS) {
      const { w, h } = SPRITES[p.sprite]
      expect(p.x >= 2 && p.y >= 2 && p.x + w <= MAP_W - 2 && p.y + h <= MAP_H - 2, `${p.sprite} at ${p.x},${p.y} (${w}x${h}) is clipped by the map edge`).toBe(true)
    }
  })

  it('draws the Town Office with a roof peak above its clock tower, and the clock on the tower face', () => {
    const rows = readFileSync('art-src/world/buildings/office.txt', 'utf8').split('\n').filter((l) => /^[.A-Za-z0-9]{68}$/.test(l))
    const m = SPRITES['world/buildings/office']
    expect(rows).toHaveLength(m.h)
    const width = (y: number) => rows[y]!.replace(/^\.+|\.+$/g, '').length
    expect(width(1)).toBeLessThanOrEqual(5) // tower peak
    for (let y = 2; y <= 9; y++) expect(width(y), `row ${y} narrows towards the peak`).toBeGreaterThan(width(y - 1))
    expect(width(9)).toBe(60) // the eaves: the full roof width from the original drawing
    expect(rows[CLOCK.y + 3]![CLOCK.x + 3]).toBe('S') // the hand pivot pin drawn at the face centre
  })

  it('centres each badge above its building, above every prop, exactly once per marked building', () => {
    render(<TownWorld onBuildingClick={() => {}} eventBuildings={['office', 'bank']}/>)
    const badges = document.querySelectorAll<HTMLElement>('.fv-badge')
    expect(badges).toHaveLength(2)
    for (const el of badges) {
      const id = el.dataset.badge as 'office' | 'bank'
      const b = BUILDING_LAYOUT[id], m = SPRITES[`world/buildings/${id}`], badge = SPRITES['world/fx/badge']
      const px = 4
      expect(Math.abs(parseFloat(el.style.left) / px + badge.w / 2 - (b.x + m.w / 2))).toBeLessThanOrEqual(1)
      expect(parseFloat(el.style.top) / px + badge.h).toBe(b.y - BADGE_GAP)
      expect(Number(el.style.zIndex)).toBeGreaterThan(MAP_H + 100)
      expect(el.closest('button')).toBeNull()
    }
  })
})
