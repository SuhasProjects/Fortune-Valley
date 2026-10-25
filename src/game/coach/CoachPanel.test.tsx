// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createGame } from '../../engine'
import { scenarios } from '../../data/scenarios'
import { useGameStore } from '../../stores/useGameStore'
import { CoachPanel, COACH_CHIPS } from './CoachPanel'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  Element.prototype.scrollIntoView = () => {}
  const config = scenarios[0]!
  useGameStore.setState({ config, game: createGame(config), aiStatus: 'idle', coachOpen: false, coachHistory: [], coachLoading: false, openBuildingId: null })
})

describe('Coach panel', () => {
  it('opens from the speech-bubble button, shows the greeting and the three chips, closes on Escape and returns focus', async () => {
    render(<CoachPanel/>)
    const bubble = screen.getByRole('button', { name: 'Ask the Coach' })
    expect(bubble.getAttribute('aria-expanded')).toBe('false')
    bubble.focus()
    fireEvent.click(bubble)
    const dialog = await screen.findByRole('dialog', { name: 'Coach' })
    expect(bubble.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(/Ask me anything about your money/)).toBeTruthy()
    for (const chip of COACH_CHIPS) expect(screen.getByRole('button', { name: chip })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Your question' })).toBeTruthy()
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(useGameStore.getState().coachOpen).toBe(false)
    expect(document.activeElement).toBe(bubble)
  })

  it('sends a typed question (Enter or Ask), shows the answer with the offline tag when the gateway is down, and keeps history in the store', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    render(<CoachPanel/>)
    fireEvent.click(screen.getByRole('button', { name: 'Ask the Coach' }))
    const input = await screen.findByRole('textbox', { name: 'Your question' })
    const ask = screen.getByRole('button', { name: 'Ask' })
    expect((ask as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'Pay the card or save?' } })
    expect((ask as HTMLButtonElement).disabled).toBe(false)
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    expect((input as HTMLInputElement).value).toBe('')
    await screen.findByText('Pay the card or save?')
    await waitFor(() => expect(useGameStore.getState().coachLoading).toBe(false))
    const history = useGameStore.getState().coachHistory
    expect(history.map(t => t.role)).toEqual(['user', 'coach'])
    expect(history[1]!.source).toBe('fallback')
    expect(screen.getByText(history[1]!.text)).toBeTruthy()
    expect(screen.getByText('Offline')).toBeTruthy()
    expect(screen.queryByRole('button', { name: COACH_CHIPS[0] })).toBeNull() // chips go once the chat has started
    expect(input.getAttribute('maxlength')).toBe('300')
  })

  it('a chip sends its question, and the open building rides along in the request', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { kind: string; question: string; openBuilding: string | null; history: unknown[]; facts: { savingsApy: number } }
      expect(body).toMatchObject({ kind: 'coach', question: COACH_CHIPS[2], openBuilding: 'hospital', history: [] })
      expect(body.facts.savingsApy).toBeGreaterThan(0)
      return new Response(JSON.stringify({ kind: 'coach', source: 'ai', text: 'Your plan costs $180 a month.', warnings: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)
    useGameStore.setState({ openBuildingId: 'hospital' })
    render(<CoachPanel/>)
    fireEvent.click(screen.getByRole('button', { name: 'Ask the Coach' }))
    const chip = await screen.findByRole('button', { name: COACH_CHIPS[2] })
    await act(async () => { fireEvent.click(chip) })
    await screen.findByText('Your plan costs $180 a month.')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(screen.queryByText('Offline')).toBeNull()
    expect(useGameStore.getState().aiStatus).toBe('online')
  })

  it('history is session-only: a new game clears it', async () => {
    useGameStore.setState({ coachHistory: [{ role: 'user', text: 'hi' }, { role: 'coach', text: 'Hello.', source: 'fallback' }], coachOpen: true })
    render(<CoachPanel/>)
    expect(await screen.findByText('Hello.')).toBeTruthy()
    act(() => useGameStore.getState().startGame(scenarios[1]!))
    expect(useGameStore.getState().coachHistory).toEqual([])
    expect(useGameStore.getState().coachOpen).toBe(false)
  })
})
