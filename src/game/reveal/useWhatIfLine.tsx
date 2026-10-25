import { useEffect, useRef, useState } from 'react'
import { explainWhatIf } from '@/services/aiClient'
import { fallbackWhatIf } from '@/services/aiFallback'
import type { ChartLines, WhatIfResult } from './ending-contract'

export type WhatIfLine = { text: string; source: 'ai' | 'fallback' }
/** Debounce before asking the AI, so flicking through alternatives does not fire a request per stop. */
export const WHATIF_LINE_DEBOUNCE_MS = 400

export function toComparison(result: WhatIfResult, startNetWorth: number) {
  const pick = (l: ChartLines) => ({ p10: l.p10, median: l.median, p90: l.p90, yourEvents: l.yourEvents })
  return { decisionLabel: result.decisionLabel, alternativeLabel: result.alternativeLabel, original: pick(result.original), changed: pick(result.changed), delta: result.delta, startNetWorth, months: result.changed.months }
}

/**
 * The one-sentence "why" under the what-if tiles. Shows the sign-based template at once, then swaps in the
 * AI line. Cached per (decision, alternative) key for the life of the screen; a new key aborts the in-flight
 * request; the fetch is debounced so quick flicks through the dropdowns cost one request, not five.
 */
export function useWhatIfLine(key: string, result: WhatIfResult | undefined, startNetWorth: number): WhatIfLine | undefined {
  const cache = useRef(new Map<string, WhatIfLine>())
  const [line, setLine] = useState<{ key: string; line: WhatIfLine } | null>(null)
  useEffect(() => {
    if (!result) return
    const cached = cache.current.get(key)
    if (cached) { setLine({ key, line: cached }); return }
    const comparison = toComparison(result, startNetWorth)
    setLine({ key, line: { text: fallbackWhatIf(comparison), source: 'fallback' } })
    const controller = new AbortController()
    const fetchWithAbort: typeof fetch = (input, init) => fetch(input, { ...init, signal: controller.signal })
    const timer = setTimeout(() => {
      void explainWhatIf(comparison, { fetchImpl: fetchWithAbort }).then(response => {
        if (controller.signal.aborted) return
        const next = { text: response.text, source: response.source }
        if (response.source === 'ai') cache.current.set(key, next)
        setLine({ key, line: next })
      })
    }, WHATIF_LINE_DEBOUNCE_MS)
    return () => { clearTimeout(timer); controller.abort() }
  }, [key, result, startNetWorth])
  return line?.key === key ? line.line : undefined
}
