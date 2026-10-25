// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { GameStage, useStageScale } from './GameStage'
import { mapWindow, stageScale, uiBox } from './scale'

afterEach(cleanup)

describe('stage scale', () => {
  it.each([
    [1280, 720, 4], [1366, 768, 4], [1440, 900, 4], [1536, 864, 4], [1920, 1080, 6], [2560, 1440, 8], [800, 600, 2], [390, 844, 1], [320, 740, 1],
  ])('%i×%i → %i', (w, h, px) => {
    expect(stageScale(w, h).px).toBe(px)
  })

  it('reports the visible area in art pixels', () => {
    expect(stageScale(1440, 900)).toEqual({ px: 4, viewW: 360, viewH: 225 })
  })

  it('never raises the zoom past the core: odd aspect ratios show past the map instead', () => {
    // Tall windows (portrait monitors, tablets) and ultrawides overflow the 480x288 map on one axis; the core fits on both.
    for (const [w, h, px] of [[800, 1000, 2], [1024, 1366, 3], [900, 1200, 2], [2560, 1080, 6], [3440, 1440, 8], [5120, 1440, 8]] as const) {
      const s = stageScale(w, h)
      expect(s.px, `${w}x${h}`).toBe(px)
      expect(s.viewW, `${w}x${h} core width`).toBeGreaterThanOrEqual(320)
      expect(s.viewH, `${w}x${h} core height`).toBeGreaterThanOrEqual(180)
    }
    expect(mapWindow(800, 1000, stageScale(800, 1000))).toEqual({ left: -80, top: 212, wide: false, tall: true })
    expect(mapWindow(5120, 1440, stageScale(5120, 1440))).toEqual({ left: 640, top: -432, wide: true, tall: false })
    expect(mapWindow(1366, 768, stageScale(1366, 768), 53)).toEqual({ left: -277, top: -192, wide: false, tall: false })
  })

  it('inset the UI layer to the map edges only where the map does not reach the viewport edge', () => {
    for (const [w, h] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080]] as const) expect(uiBox(w, h, stageScale(w, h))).toEqual({ left: 0, top: 0, right: 0, bottom: 0 })
    expect(uiBox(800, 1000, stageScale(800, 1000))).toEqual({ left: 0, top: 212, right: 0, bottom: 212 })
    expect(uiBox(5120, 1440, stageScale(5120, 1440))).toEqual({ left: 640, top: 0, right: 640, bottom: 0 })
    expect(uiBox(1024, 1366, stageScale(1024, 1366))).toEqual({ left: 0, top: 251, right: 0, bottom: 251 })
  })

  it('exposes --px and the scale to children, and locks page scroll while mounted', () => {
    function Probe() { const { px } = useStageScale(); return <span>px={px}</span> }
    const { unmount } = render(<GameStage label="Test stage" world={<div/>}><Probe/></GameStage>)
    const stage = screen.getByRole('group', { name: 'Test stage' })
    const expected = stageScale(window.innerWidth, window.innerHeight).px
    expect(stage.style.getPropertyValue('--px')).toBe(`${expected}px`)
    expect(screen.getByText(`px=${expected}`)).toBeTruthy()
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
