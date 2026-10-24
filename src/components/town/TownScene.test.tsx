// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TownScene } from './TownScene'
import { buildingIds, buildings } from './buildings'

afterEach(cleanup)
describe('town navigation contract', () => {
  it('opens the canonical target for each of the five buildings', () => {
    const open = vi.fn()
    render(<TownScene onBuildingClick={open}/>)
    for (const building of buildingIds) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`Open ${buildings[building].title}:`) }))
      expect(open).toHaveBeenLastCalledWith(building)
    }
    expect(open).toHaveBeenCalledTimes(5)
  })
  it('marks only the relevant building and never advances time on background clicks', () => {
    const open = vi.fn()
    render(<TownScene onBuildingClick={open} eventBuilding="hospital"/>)
    expect(screen.getByRole('button', { name: /Health House.*Decision waiting/ })).toBeTruthy()
    expect(screen.getAllByLabelText('Decision waiting')).toHaveLength(1)
    fireEvent.click(screen.getByRole('region'))
    expect(open).not.toHaveBeenCalled()
  })
})
