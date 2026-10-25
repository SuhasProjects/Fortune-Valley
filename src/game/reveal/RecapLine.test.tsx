// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { fixtureFinishedState } from '@/fixtures'

const mocks = vi.hoisted(() => ({ recap: vi.fn() }))
vi.mock('@/services/aiClient', async importOriginal => ({ ...await importOriginal<object>(), recapRun: mocks.recap }))
import { RecapLine } from './RecapLine'

afterEach(() => { cleanup(); mocks.recap.mockReset() })

it('shows the template recap at once, then swaps in the AI recap and tag', async () => {
  let resolve!: (v: { kind: 'recap'; source: 'ai'; text: string; warnings: string[] }) => void
  mocks.recap.mockImplementation(() => new Promise(r => { resolve = r }))
  render(<RecapLine state={fixtureFinishedState}/>)
  expect(screen.getByText('Recap')).toBeTruthy()
  expect(screen.getByText(/^The run opened at/)).toBeTruthy()
  expect(mocks.recap).toHaveBeenCalledTimes(1)
  expect(mocks.recap.mock.calls[0]![0].timeline.length).toBeLessThanOrEqual(25)
  await act(async () => resolve({ kind: 'recap', source: 'ai', text: 'In January 2026 the player saved $300 a month. In July a repair cost $900. It ended at $4,000.', warnings: [] }))
  expect(screen.getByText('AI recap')).toBeTruthy()
  expect(screen.getByText(/In January 2026 the player saved/)).toBeTruthy()
})

it('keeps the template when the gateway falls back, and aborts on unmount', async () => {
  let signal: AbortSignal | undefined
  mocks.recap.mockImplementation(async (_recap, opts: { fetchImpl: typeof fetch }) => {
    try { await opts.fetchImpl('/api/ai', {}) } catch { /* no server in jsdom */ }
    return { kind: 'recap', source: 'fallback', text: 'ignored', warnings: [] }
  })
  const original = globalThis.fetch
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => { signal = init?.signal ?? undefined; return new Response('{}', { status: 503 }) }) as unknown as typeof fetch
  const view = render(<RecapLine state={fixtureFinishedState}/>)
  await act(async () => {})
  expect(screen.getByText('Recap')).toBeTruthy()
  expect(screen.queryByText('ignored')).toBeNull()
  view.unmount()
  expect(signal?.aborted).toBe(true)
  globalThis.fetch = original
})
