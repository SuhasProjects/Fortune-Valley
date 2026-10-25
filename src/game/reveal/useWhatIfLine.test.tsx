// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { WhatIfResult } from './ending-contract'

const mocks = vi.hoisted(() => ({ explain: vi.fn() }))
vi.mock('@/services/aiClient', async importOriginal => ({ ...await importOriginal<object>(), explainWhatIf: mocks.explain }))
import { ChangeStrip } from './ChangeStrip'
import { useWhatIfLine, WHATIF_LINE_DEBOUNCE_MS } from './useWhatIfLine'

const original = { months: 2, start: -14000, p10: -15000, median: -13000, p90: -10000, yourEvents: -12000, spread: 5000 }
const result = (alternativeLabel: string, median = 1240): WhatIfResult => ({ original, changed: { ...original, median: original.median + median, spread: 3000 }, delta: { p10: 1000, median, p90: -1000, yourEvents: -310, spread: -2000 }, decisionLabel: 'Save $300/month', alternativeLabel, yourEventsComparable: true, replayFallbacks: 0 })

function Harness({ key_, result }: { key_: string; result: WhatIfResult }) {
  const line = useWhatIfLine(key_, result, -14000)
  return <ChangeStrip result={result} line={line}/>
}

afterEach(() => { cleanup(); mocks.explain.mockReset(); vi.useRealTimers() })

it('shows the template line first, debounces, caches per key and aborts a superseded request', async () => {
  vi.useFakeTimers()
  const pending: { resolve: (v: unknown) => void; signal?: AbortSignal }[] = []
  mocks.explain.mockImplementation(async (_c, opts: { fetchImpl: typeof fetch }) => new Promise(resolve => {
    const entry: typeof pending[number] = { resolve }
    pending.push(entry)
    globalThis.fetch = (async (_i: unknown, init?: RequestInit) => { entry.signal = init?.signal ?? undefined; return new Response('{}') }) as unknown as typeof fetch
    void opts.fetchImpl('/api/ai', {})
  }))
  const view = render(<Harness key_="0:undo" result={result('Keep what you had before')}/>)
  const sentence = () => document.querySelector('.fv-change-sentence')!
  expect(sentence().textContent).toMatch(/hurt less/)
  expect(sentence().getAttribute('data-source')).toBe('fallback')
  expect(mocks.explain).not.toHaveBeenCalled()
  await act(async () => { vi.advanceTimersByTime(WHATIF_LINE_DEBOUNCE_MS + 1) })
  expect(mocks.explain).toHaveBeenCalledTimes(1)
  // Switching alternatives aborts the first request and starts a fresh debounce.
  view.rerender(<Harness key_="0:half" result={result('Save half', -400)}/>)
  expect(pending[0]!.signal?.aborted).toBe(true)
  await act(async () => { vi.advanceTimersByTime(WHATIF_LINE_DEBOUNCE_MS + 1) })
  expect(mocks.explain).toHaveBeenCalledTimes(2)
  await act(async () => pending[1]!.resolve({ kind: 'whatif', source: 'ai', text: 'Saving less each month leaves more cash now but a thinner cushion later.', warnings: [] }))
  expect(sentence().textContent).toBe('Saving less each month leaves more cash now but a thinner cushion later.')
  expect(sentence().getAttribute('data-source')).toBe('ai')
  // A late answer for the aborted key never shows.
  await act(async () => pending[0]!.resolve({ kind: 'whatif', source: 'ai', text: 'stale', warnings: [] }))
  expect(screen.queryByText('stale')).toBeNull()
  // Going back to a cached key shows the AI line without a new request.
  view.rerender(<Harness key_="0:undo" result={result('Keep what you had before')}/>)
  await act(async () => { vi.advanceTimersByTime(WHATIF_LINE_DEBOUNCE_MS + 1) })
  expect(mocks.explain).toHaveBeenCalledTimes(3)
  view.rerender(<Harness key_="0:half" result={result('Save half', -400)}/>)
  await act(async () => { vi.advanceTimersByTime(WHATIF_LINE_DEBOUNCE_MS + 1) })
  expect(mocks.explain).toHaveBeenCalledTimes(3)
  expect(sentence().textContent).toBe('Saving less each month leaves more cash now but a thinner cushion later.')
})
