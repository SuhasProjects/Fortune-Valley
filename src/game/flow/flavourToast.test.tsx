// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { GameNotification } from '../../types/domain'
import { scenarios } from '../../data/scenarios'
import { useGameStore } from '../../stores/useGameStore'
import { ToastStack } from './ToastStack'

afterEach(cleanup)

const shockNote: GameNotification = { id: 'N_s_3_1', monthIndex: 3, kind: 'negative', summary: 'Car repair / accident: $1,800 (you paid $1,800)', details: 'A car repair cost $1,800, and with no auto coverage you paid the full amount.', relatedBuilding: 'hospital', amountSigned: -1800, shockKind: 'auto', eventId: 'EVA_s_3_0', read: false }

describe('shock flavour toast', () => {
  it('shows the engine text first, then swaps in the headline and scene while keeping the engine amount', () => {
    const { container, rerender } = render(<ToastStack notifications={[shockNote]} onDismiss={() => {}} onViewAll={() => {}}/>)
    expect(container.querySelector('.notice strong')?.textContent).toBe(shockNote.summary)
    expect(container.querySelector('.notice p')?.textContent).toBe(shockNote.details)
    const money = container.querySelector('.fv-money')?.textContent
    expect(money).toContain('1,800')
    rerender(<ToastStack notifications={[{ ...shockNote, flavour: { headline: 'Limb hits windshield', scene: 'A tree limb came down on the car overnight. The windshield repair cost $1,800.', source: 'ai' } }]} onDismiss={() => {}} onViewAll={() => {}}/>)
    expect(container.querySelector('.notice strong')?.textContent).toBe('Limb hits windshield')
    expect(container.querySelector('.fv-toast__scene')?.textContent).toContain('tree limb')
    expect(container.querySelector('.fv-money')?.textContent).toBe(money)
  })

  it('store attaches one flavour per shock notification and mirrors it onto the timeline entry', async () => {
    const store = useGameStore.getState()
    store.resetGame()
    store.startGame(scenarios[1]!)
    const game = useGameStore.getState().game!
    useGameStore.setState({ game: { ...game, notifications: [...game.notifications, shockNote], timeline: [...game.timeline, { id: 'T_1', monthIndex: 3, type: 'shock', description: 'Car repair / accident: cost $1,800', eventId: 'EVA_s_3_0', netWorthAfter: 0 }] } })
    await useGameStore.getState().requestShockFlavour('N_s_3_1')
    const after = useGameStore.getState().game!
    const note = after.notifications.find(n => n.id === 'N_s_3_1')!
    expect(note.flavour?.source).toBe('fallback')
    expect(note.flavour?.scene).toContain('$1,800')
    expect(note.amountSigned).toBe(-1800)
    expect(note.summary).toBe(shockNote.summary)
    expect(after.timeline.find(t => t.eventId === 'EVA_s_3_0')?.flavour).toEqual(note.flavour)
    // Second call is a no-op: cached by notification id.
    const before = useGameStore.getState().game
    await useGameStore.getState().requestShockFlavour('N_s_3_1')
    expect(useGameStore.getState().game).toBe(before)
  })
})
