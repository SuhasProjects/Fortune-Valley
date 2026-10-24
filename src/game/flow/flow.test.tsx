// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { GameNotification, TimelineEntry } from '../../types/domain'
import { ToastStack } from './ToastStack'
import { TimelineWindow } from './TimelineWindow'
import { ActivityWindow } from './ActivityWindow'
import { useShortcuts } from './useShortcuts'

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
    expect(container.querySelector('.notice strong')?.textContent).toBe('Choose a job')
    fireEvent.click(screen.getByRole('button', { name: 'Go to Town Office' }))
    expect(open).toHaveBeenCalledWith('office')
    vi.advanceTimersByTime(6_000)
    expect(dismiss).toHaveBeenCalledWith('old')
    expect(dismiss).toHaveBeenCalledWith('new')
    expect(dismiss).not.toHaveBeenCalledWith('decision')
  })

  it('shows newest timeline entries first and filters surprises', () => {
    const entries: TimelineEntry[] = [
      { id: 'choice', monthIndex: 1, type: 'choice', description: 'Saved more', netWorthAfter: 100 },
      { id: 'shock', monthIndex: 2, type: 'shock', description: 'Car repair', netWorthAfter: 50 },
    ]
    render(<TimelineWindow entries={entries} startMonth="2026-01" onClose={() => {}}/>)
    expect(screen.getAllByRole('listitem')[0]?.textContent).toContain('Car repair')
    fireEvent.click(screen.getByRole('tab', { name: 'Surprises' }))
    expect(screen.getByText('Car repair')).toBeTruthy()
    expect(screen.queryByText('Saved more')).toBeNull()
  })

  it('marks activity read and routes building actions', () => {
    const mark = vi.fn(); const open = vi.fn()
    render(<ActivityWindow notifications={notices} onClose={() => {}} onMarkAllRead={mark} onOpenBuilding={open}/>)
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Town Office' }))
    expect(mark).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledWith('office')
  })
})

function ShortcutHarness({ modalOpen = false, advance, building }: { modalOpen?: boolean; advance: () => void; building: (id: 'bank' | 'office' | 'hospital' | 'home' | 'market') => void }) {
  useShortcuts({ pause: () => {}, advance, openBuilding: building, timeline: () => {}, activity: () => {}, escape: () => {}, guide: () => {}, modalOpen })
  return <input aria-label="Editable"/>
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
})
