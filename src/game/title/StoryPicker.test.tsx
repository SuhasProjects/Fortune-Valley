// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StoryPicker } from './StoryPicker'
import { scenarios } from '@/data/scenarios'
import { useGameStore } from '@/stores/useGameStore'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('offers all four lives and starts the original fixed-seed config', () => {
  const start = vi.spyOn(useGameStore.getState(), 'startGame')
  render(<StoryPicker/>)
  expect(screen.getAllByRole('button')).toHaveLength(4)
  for (const config of scenarios) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(config.title) }))
    expect(start).toHaveBeenLastCalledWith(config)
    expect(useGameStore.getState().config?.seed).toBe(config.seed)
  }
})
