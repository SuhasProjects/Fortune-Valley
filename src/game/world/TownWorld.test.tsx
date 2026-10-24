// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TownWorld } from './TownWorld'
import { BUILDINGS, BUILDING_IDS } from './landmarks'
import { BUILDING_LAYOUT, PROPS, SMOKE } from './layout'
import { SPRITES } from '../art/manifest'
import { CORE_OFFSET_X, CORE_OFFSET_Y, CORE_H, CORE_W } from '../stage/scale'

afterEach(cleanup)

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
    for (const s of SMOKE) expect(inCore(s.x, s.y, 7, 10)).toBe(true)
  })
})
