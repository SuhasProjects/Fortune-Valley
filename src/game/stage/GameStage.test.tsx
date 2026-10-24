// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { GameStage, useStageScale } from './GameStage'
import { stageScale } from './scale'

afterEach(cleanup)

describe('stage scale', () => {
  it.each([
    [1280, 720, 4], [1366, 768, 4], [1440, 900, 4], [1536, 864, 4], [1920, 1080, 6], [2560, 1440, 8], [800, 600, 2], [390, 844, 2],
  ])('%i×%i → %i', (w, h, px) => {
    expect(stageScale(w, h).px).toBe(px)
  })

  it('reports the visible area in art pixels', () => {
    expect(stageScale(1440, 900)).toEqual({ px: 4, viewW: 360, viewH: 225 })
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
