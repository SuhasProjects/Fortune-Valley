// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../App'
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
    fireEvent.click(screen.getByRole('button', { name: 'New Story' }))
    fireEvent.click(screen.getByRole('button', { name: /College Student/ }))
    fireEvent.click(screen.getByRole('button', { name: /Open Pine Bank/ }))
    expect(screen.getByText('Controlled bank content')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Next month/ }))
    expect(useGameStore.getState().game?.monthIndex).toBe(1)
    expect(screen.getByText(`Month 1 / ${useGameStore.getState().config!.durationMonths}`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Pause \(Space\)/ }))
    expect((screen.getByRole('button', { name: /Next month/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(useGameStore.getState().game?.status).toBe('paused')
  })
  it('opens full notification history and passes the actual finish payload to reveal', async () => {
    render(<App/>)
    fireEvent.click(screen.getByRole('button', { name: 'New Story' }))
    fireEvent.click(screen.getByRole('button', { name: /Entry-Level Worker/ }))
    fireEvent.click(screen.getByRole('button', { name: /Next month/ }))
    // A quiet month posts no notices (no monthly summary toast), so open the journal by its shortcut.
    fireEvent.keyDown(window, { key: 'a' })
    expect(screen.getByRole('dialog', { name: 'Town activity' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    fireEvent.click(screen.getByRole('button', { name: /Finish & reveal/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Finish now' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: /You finished month 1 with/ })).toBeTruthy(), { timeout: 20_000 })
  })
})
