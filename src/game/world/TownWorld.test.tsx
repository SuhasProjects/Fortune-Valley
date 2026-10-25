// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TownWorld, villagerKeyframes } from './TownWorld'
import { BUILDINGS, BUILDING_IDS } from './landmarks'
import { BUILDING_LAYOUT, CLOCK, CORE_CORNER_TREES, PROPS, RING_PROPS, SMOKE, VILLAGERS, VILLAGER_STEP_MS } from './layout'
import { SPRITES } from '../art/manifest'
import { CORE_OFFSET_X, CORE_OFFSET_Y, CORE_H, CORE_W, MAP_H, MAP_W } from '../stage/scale'

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

  it('walks two villagers along axis-aligned path segments, hidden under reduced motion', () => {
    stubReducedMotion(false)
    const { unmount } = render(<TownWorld/>)
    const villagers = document.querySelectorAll<HTMLElement>('.fv-villager')
    expect(villagers).toHaveLength(2)
    for (const el of villagers) expect(el.getAttribute('aria-hidden')).toBe('true')
    for (const v of VILLAGERS) {
      for (let i = 1; i < v.path.length; i++) expect(v.path[i]!.x === v.path[i - 1]!.x || v.path[i]!.y === v.path[i - 1]!.y, v.id).toBe(true)
      const { css, duration } = villagerKeyframes(v)
      const steps = v.path.slice(1).reduce((n, p, i) => n + Math.abs(p.x - v.path[i]!.x) + Math.abs(p.y - v.path[i]!.y), 0) * 2
      expect(duration).toBe(steps * VILLAGER_STEP_MS)
      expect(css).toContain(`@keyframes fv-walk-${v.id}`)
      expect(css).toContain('scaleX(-1)')
      expect(css).not.toMatch(/steps\(0,/)
    }
    expect(document.querySelector('style')!.textContent).toContain('fv-walk-a')
    unmount()
    stubReducedMotion(true)
    render(<TownWorld/>)
    expect(screen.getByRole('region').className).toContain('fv-still')
    expect(document.querySelectorAll('.fv-villager')).toHaveLength(0)
  })
})
