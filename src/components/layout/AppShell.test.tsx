// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '../../App'
import { scenarios } from '../../data/scenarios'
import { useGameStore } from '../../stores/useGameStore'

beforeEach(() => {
  useGameStore.getState().resetGame()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(cleanup)
describe('integrated app shell', () => {
  it('keeps the run intact across panel navigation and advances through store controls', () => {
    render(<App panels={{ bank: <p>Controlled bank content</p> }}/>)
    fireEvent.click(screen.getByRole('button', { name: /College Student/ }))
    fireEvent.click(screen.getByRole('button', { name: /Open Pine Bank/ }))
    expect(screen.getByText('Controlled bank content')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Next month/ }))
    expect(useGameStore.getState().game?.monthIndex).toBe(1)
    expect(screen.getByText(`Month 1 / ${useGameStore.getState().config!.durationMonths}`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }))
    expect((screen.getByRole('button', { name: /Next month/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(useGameStore.getState().game?.status).toBe('paused')
  })
  it('opens full notification history and passes the actual finish payload to reveal', () => {
    render(<App renderReveal={payload => <p>Reveal month {payload.finalState.monthIndex}</p>}/>)
    fireEvent.click(screen.getByRole('button', { name: /Entry-Level Worker/ }))
    fireEvent.click(screen.getByRole('button', { name: /Next month/ }))
    fireEvent.click(screen.getByRole('button', { name: 'View all activity' }))
    expect(screen.getByRole('dialog', { name: 'Town activity' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    fireEvent.click(screen.getByRole('button', { name: /Finish & reveal/ }))
    expect(screen.getByText('Reveal month 1')).toBeTruthy()
  })
  it('keeps review reachable after natural completion and restores landing scroll after reveal reset', () => {
    render(<App/>)
    act(() => useGameStore.getState().startGame({ ...scenarios[1]!, durationMonths: 6 }))
    for (let month = 0; month < 6; month++) fireEvent.click(screen.getByRole('button', { name: /Next month/ }))
    expect(useGameStore.getState().game?.status).toBe('finished')
    fireEvent.click(screen.getByRole('button', { name: /Review your story/ }))
    expect(screen.getByRole('dialog', { name: 'Your next chapter' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Choose a new story/ }))
    expect(screen.getByRole('heading', { name: /Your money\.\s*Your little world\./ })).toBeTruthy()
    expect(document.body.classList.contains('fullscreen-game-active')).toBe(false)
    expect(document.body.style.overflow).not.toBe('hidden')
  })

})
