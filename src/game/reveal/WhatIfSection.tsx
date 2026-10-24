import { useEffect, useMemo, useState } from 'react'
import type { FinishPayload } from '@/stores/useGameStore'
import { hasPolicyDecisions } from '@/engine'
import { Inset, Select } from '@/ui'
import { endingApi, type ChartLines, type WhatIfResult } from './ending-contract'
import { OutcomeChart, sharedYDomain } from './OutcomeChart'
import { ChangeStrip } from './ChangeStrip'

export function WhatIfSection({ payload, original }: { payload: FinishPayload; original: ChartLines }) {
  const decisions = useMemo(() => endingApi.listDecisions?.(payload.config, payload.policyLog) ?? [], [payload.config, payload.policyLog])
  const [selection, setSelection] = useState(() => ({ decision: decisions[0]?.id ?? '', alternative: decisions[0]?.alternatives[0]?.id ?? '' }))
  const [response, setResponse] = useState<{ key: string; result?: WhatIfResult; error?: string } | null>(null)
  const selected = decisions.find(decision => decision.id === selection.decision)
  const key = `${selection.decision}:${selection.alternative}`
  const result = response?.key === key ? response.result : undefined
  const error = response?.key === key ? response.error : undefined
  const ready = Boolean(selected && selection.alternative)
  const pending = ready && !result && !error

  useEffect(() => {
    if (!ready || !selected) return
    const controller = new AbortController()
    let current = true
    void endingApi.runWhatIfAsync({
      config: payload.config, policyLog: payload.policyLog, finishMonteCarlo: payload.monteCarlo,
      startNetWorth: original.start, observedNetWorth: payload.monteCarlo.observedNetWorth,
      decisionId: selection.decision, alternativeId: selection.alternative,
    }, controller.signal).then(value => {
      if (current && !controller.signal.aborted) setResponse({ key, result: value })
    }).catch(reason => {
      if (current && !controller.signal.aborted) setResponse({ key, error: reason instanceof Error ? reason.message : 'This comparison could not be completed. Try another choice.' })
    })
    return () => { current = false; controller.abort() }
  }, [ready, key, selection.decision, selection.alternative, payload.config, payload.policyLog, payload.monteCarlo, original.start])

  const domain = result ? sharedYDomain(result.original, result.changed) : sharedYDomain(original)
  const noDecisions = !hasPolicyDecisions(payload.policyLog) || decisions.length === 0
  return <section className="fv-what-if" aria-labelledby="fv-what-if-title">
    <h2 id="fv-what-if-title">What if you’d chosen differently?</h2>
    {noDecisions ? <Inset><p className="fv-what-if-empty">You didn’t change any settings this time. Next story, visit a building and make a choice to compare.</p></Inset>
      : <>
        <p className="fv-what-if-lead">Change one past decision. The same 1,000 futures run again with the same luck.</p>
        <div className="fv-what-if-fields">
          <Select label="Pick a decision" value={selection.decision} options={decisions.map(decision => ({ value: decision.id, label: decision.label }))} onChange={value => {
            const next = decisions.find(decision => decision.id === value)!
            setResponse(null)
            setSelection({ decision: next.id, alternative: next.alternatives[0]?.id ?? '' })
          }}/>
          <Select label="Instead…" value={selection.alternative} options={(selected?.alternatives ?? []).map(alternative => ({ value: alternative.id, label: alternative.label }))} onChange={value => { setResponse(null); setSelection(previous => ({ ...previous, alternative: value })) }}/>
        </div>
        <div className="fv-comparison-charts"><OutcomeChart lines={result?.original ?? original} yDomain={domain} title="What you did"/>
          <div aria-busy={pending} className="fv-changed-chart">{result ? <OutcomeChart lines={result.changed} yDomain={domain} title={`If you had: ${result.alternativeLabel}`} highlightLabel="Your exact events, with this change"/> : error ? <p role="alert">{error}</p> : <p role="status"><img className="fv-computing-coin" src="/art/title/favicon.png" alt=""/>Re-running 1,000 futures…</p>}</div></div>
        {result && <ChangeStrip result={result}/>}
      </>}
  </section>
}
