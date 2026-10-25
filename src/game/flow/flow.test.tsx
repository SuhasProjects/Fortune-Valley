// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { GameNotification, TimelineEntry } from '../../types/domain'
import { scenarios } from '../../data/scenarios'
import { useGameStore } from '../../stores/useGameStore'
import { ToastStack } from './ToastStack'
import { TimelineWindow } from './TimelineWindow'
import { ActivityWindow } from './ActivityWindow'
import { useShortcuts } from './useShortcuts'
import { GameScreen } from '../GameScreen'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); vi.useRealTimers() })

const notices: GameNotification[] = [
  { id: 'old', monthIndex: 1, kind: 'positive', summary: 'Payday', amountSigned: 100, read: false },
  { id: 'decision', monthIndex: 1, kind: 'decision', summary: 'Choose a job', relatedBuilding: 'office', read: false },
  { id: 'new', monthIndex: 2, kind: 'negative', summary: 'Repair bill', amountSigned: -40, read: false },
]

describe('flow components', () => {
  it('prioritizes decisions, opens their building, and expires ordinary toasts', () => {
    vi.useFakeTimers()
    const dismiss = vi.fn()
    const open = vi.fn()
    const { container } = render(<ToastStack notifications={notices} onDismiss={dismiss} onOpenBuilding={open} onViewAll={() => {}}/>)
    expect(screen.getByRole('region', { name: 'Recent financial activity' })).toBeTruthy()
    const summaries = [...container.querySelectorAll('.notice strong')].map(node => node.textContent)
    expect(summaries).toEqual(['Choose a job', 'Repair bill', 'Payday'])
    fireEvent.click(screen.getByRole('button', { name: 'Go to Town Office' }))
    expect(open).toHaveBeenCalledWith('office')
    vi.advanceTimersByTime(5_999)
    expect(dismiss).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(dismiss).toHaveBeenCalledWith('old')
    expect(dismiss).toHaveBeenCalledWith('new')
    expect(dismiss).not.toHaveBeenCalledWith('decision')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Choose a job' }))
    expect(dismiss).toHaveBeenCalledWith('decision')
  })

  it('shows at most three unread toasts and a view-all button', () => {
    const many: GameNotification[] = Array.from({ length: 5 }, (_, index) => ({ id: `n${index}`, monthIndex: index, kind: 'info', summary: `Note ${index}`, read: false }))
    const { container } = render(<ToastStack notifications={[...many, { ...many[0]!, id: 'read', read: true }]} onDismiss={() => {}} onViewAll={() => {}}/>)
    expect(container.querySelectorAll('.notice')).toHaveLength(3)
    expect(container.querySelector('.notice strong')?.textContent).toBe('Note 4')
    expect(screen.getByRole('button', { name: 'View all activity' })).toBeTruthy()
  })

  it('shows newest timeline entries first and filters surprises', () => {
    const entries: TimelineEntry[] = [
      { id: 'choice', monthIndex: 1, type: 'choice', description: 'Saved more', netWorthAfter: 100 },
      { id: 'shock', monthIndex: 2, type: 'shock', description: 'Car repair', netWorthAfter: 50 },
    ]
    render(<TimelineWindow entries={entries} startMonth="2026-01" onClose={() => {}}/>)
    expect(screen.getByRole('dialog', { name: 'Your timeline' })).toBeTruthy()
    expect(screen.getAllByRole('listitem')[0]?.textContent).toContain('Car repair')
    fireEvent.click(screen.getByRole('tab', { name: 'Surprises' }))
    expect(screen.getByText('Car repair')).toBeTruthy()
    expect(screen.queryByText('Saved more')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Milestones' }))
    expect(screen.getByText('Your story starts here…')).toBeTruthy()
  })

  it('marks activity read and routes building actions', () => {
    const mark = vi.fn(); const open = vi.fn()
    render(<ActivityWindow notifications={notices} onClose={() => {}} onMarkAllRead={mark} onOpenBuilding={open}/>)
    expect(screen.getByRole('dialog', { name: 'Town activity' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Town Office' }))
    expect(mark).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledWith('office')
  })
})

function ShortcutHarness({ modalOpen = false, advance, building, pause = () => {} }: { modalOpen?: boolean; advance: () => void; building: (id: 'bank' | 'office' | 'hospital' | 'home' | 'market') => void; pause?: () => void }) {
  useShortcuts({ pause, advance, openBuilding: building, timeline: () => {}, activity: () => {}, escape: () => {}, guide: () => {}, modalOpen })
  return <><input aria-label="Editable"/><button type="button">Focused control</button></>
}

describe('keyboard shortcuts', () => {
  it('opens buildings and ignores shortcuts in inputs or while a modal is open', () => {
    const advance = vi.fn(); const building = vi.fn()
    const { rerender } = render(<ShortcutHarness advance={advance} building={building}/>)
    fireEvent.keyDown(window, { key: '2' })
    expect(building).toHaveBeenCalledWith('office')
    fireEvent.keyDown(screen.getByLabelText('Editable'), { key: 'n' })
    expect(advance).not.toHaveBeenCalled()
    rerender(<ShortcutHarness modalOpen advance={advance} building={building}/>)
    fireEvent.keyDown(window, { key: 'n' })
    expect(advance).not.toHaveBeenCalled()
  })

  it('leaves Space to a focused button instead of toggling pause twice', () => {
    const pause = vi.fn()
    render(<ShortcutHarness advance={() => {}} building={() => {}} pause={pause}/>)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Focused control' }), { key: ' ' })
    expect(pause).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, { key: ' ' })
    expect(pause).toHaveBeenCalledOnce()
  })
})

describe('game screen flow', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame()
    useGameStore.getState().startGame(scenarios[1]!)
  })

  it('opens the pause menu with Escape, pauses the game, and resumes', () => {
    render(<GameScreen/>)
    fireEvent.keyDown(window, { key: 'Escape' })
    const paused = screen.getByRole('dialog', { name: 'Paused' })
    expect(useGameStore.getState().game?.status).toBe('paused')
    fireEvent.click(within(paused).getByRole('button', { name: 'Resume' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useGameStore.getState().game?.status).toBe('playing')
  })

  it('labels the top-left pause button as the pause menu with a pixel pause glyph', () => {
    render(<GameScreen/>); const button = screen.getByRole('button', { name: 'Pause menu' }); expect(button.querySelector('.fv-glyph--pause')).toBeTruthy(); expect(button.textContent).toBe('')
  })
  it('offers Options and Guide from the pause menu and returns to it', () => {
    render(<GameScreen/>)
    fireEvent.click(screen.getByRole('button', { name: 'Pause menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Options' }))
    expect(screen.getByRole('dialog', { name: 'Options' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Guide' }))
    expect(screen.getByRole('dialog', { name: 'Guide' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeTruthy()
  })

  it('asks before finishing early and keeps playing on cancel', () => {
    render(<GameScreen/>)
    fireEvent.click(screen.getByRole('button', { name: /Finish & reveal/ }))
    const dialog = screen.getByRole('dialog', { name: 'Finish early?' })
    expect(dialog.textContent).toContain('0 of 24 months')
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useGameStore.getState().finishPayload).toBeNull()
    expect(useGameStore.getState().game?.status).toBe('playing')
  })

  it('shows the counting overlay and calls finishGame exactly once', async () => {
    const original = useGameStore.getState().finishGame
    const finishGame = vi.fn()
    useGameStore.setState({ finishGame })
    try {
      render(<GameScreen/>)
      fireEvent.click(screen.getByRole('button', { name: /Finish & reveal/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Finish now' }))
      expect(screen.getByText('Counting 1,000 possible futures…')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /Finish & reveal/ }))
      expect(screen.queryByRole('dialog', { name: 'Finish early?' })).toBeNull()
      await waitFor(() => expect(finishGame).toHaveBeenCalledOnce(), { timeout: 3_000 })
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(finishGame).toHaveBeenCalledOnce()
    } finally {
      useGameStore.setState({ finishGame: original })
    }
  })

  it('clears the action error toast after five seconds', () => {
    vi.useFakeTimers()
    render(<GameScreen/>)
    act(() => { useGameStore.getState().dispatchAction({ type: 'set_allocation', allocation: { stock: 0.7, bond: 0.7, etf: 0 } }) })
    expect(screen.getByRole('alert').textContent).toMatch(/sum to 1/)
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(useGameStore.getState().lastActionError).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
