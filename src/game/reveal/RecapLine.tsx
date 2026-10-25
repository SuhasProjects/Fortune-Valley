import { useEffect, useMemo, useState } from 'react'
import { Tag } from '@/ui'
import type { GameState } from '@/types/domain'
import { recapRun } from '@/services/aiClient'
import { fallbackRecap } from '@/services/aiFallback'
import { summarizeTimeline } from '@/services/summarizeTimeline'

/** Three news-wire sentences under the headline: the template shows at once, the AI version replaces it when it lands. */
export function RecapLine({ state }: { state: GameState }) {
  const recap = useMemo(() => summarizeTimeline(state), [state])
  const [line, setLine] = useState<{ text: string; source: 'ai' | 'fallback' }>(() => ({ text: fallbackRecap(recap), source: 'fallback' }))
  useEffect(() => {
    const controller = new AbortController()
    const fetchWithAbort: typeof fetch = (input, init) => fetch(input, { ...init, signal: controller.signal })
    void recapRun(recap, { fetchImpl: fetchWithAbort }).then(response => { if (!controller.signal.aborted && response.source === 'ai') setLine({ text: response.text, source: 'ai' }) })
    return () => controller.abort()
  }, [recap])
  return <div className="fv-reveal-recap" aria-live="polite" data-source={line.source}>
    <Tag tone={line.source === 'ai' ? 'gold' : 'dark'}>{line.source === 'ai' ? 'AI recap' : 'Recap'}</Tag>
    <p className="fv-reveal-recap-text">{line.text}</p>
  </div>
}
