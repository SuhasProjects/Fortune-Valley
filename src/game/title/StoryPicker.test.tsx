// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StoryPicker } from './StoryPicker'
import { CustomStoryLetter } from './CustomStoryLetter'
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
it('custom story example chips carry their full sentence and fill the letter when clicked', () => {
  const { container } = render(<CustomStoryLetter/>)
  const chips = screen.getByRole('group', { name: 'Example situations' }).querySelectorAll('button')
  expect(chips).toHaveLength(3)
  expect(chips[0]!.querySelector('b')?.textContent).toBe('Example 1')
  expect(chips[0]!.textContent).toContain("I'm 24, earn $48k, rent is $1,400 and I have $9k of card debt.")
  fireEvent.click(chips[1]!)
  expect((container.querySelector('#fv-story-prompt') as HTMLTextAreaElement).value).toBe('How could I build an emergency fund while raising two children?')
})
