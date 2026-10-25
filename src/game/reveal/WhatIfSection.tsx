import { useEffect, useId, useMemo, useState } from 'react'
import type { FinishPayload } from '@/stores/useGameStore'
import { Icon, Inset, Select } from '@/ui'
import { endingApi, type ChartLines, type DecisionChoice, type WhatIfResult } from './ending-contract'
import { OutcomeChart, sharedYDomain } from './OutcomeChart'
import { ChangeStrip } from './ChangeStrip'

/** Engine ids starting with `hyp:` are hypothetical "from the start" decisions available even without a policy log. */
const isHypothetical = (decision: DecisionChoice) => decision.id.startsWith('hyp:')

/** The kit `Select` has no option groups; this mirrors its markup so real and hypothetical decisions can be grouped. */
function GroupedSelect({ label, value, groups, onChange }: { label: string; value: string; groups: { label: string; options: { value: string; label: string }[] }[]; onChange: (value: string) => void }) {
  const id = useId()
  return <div className="fv-field"><label htmlFor={id}>{label}</label><div className="fv-select-wrap"><select id={id} className="fv-field-control" value={value} onChange={event => onChange(event.target.value)}>
    {groups.map(group => <optgroup key={group.label} label={group.label}>{group.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>)}
  </select><Icon name="arrow-right" compact/></div></div>
}

export function WhatIfSection({ payload, original }: { payload: FinishPayload; original: ChartLines }) {
  const decisions = useMemo(() => endingApi.listDecisions?.(payload.config, payload.policyLog) ?? [], [payload.config, payload.policyLog])
  // Start on a concrete decision ("all my decisions" vs the default plan is rarely the interesting comparison).
  const initial = decisions.find(decision => decision.id !== 'all') ?? decisions[0]
  const [selection, setSelection] = useState(() => ({ decision: initial?.id ?? '', alternative: initial?.alternatives[0]?.id ?? '' }))
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
  const toOption = (decision: DecisionChoice) => ({ value: decision.id, label: decision.label })
  const real = decisions.filter(decision => !isHypothetical(decision)), hypothetical = decisions.filter(isHypothetical)
  const groups = [{ label: 'Your decisions', options: real.map(toOption) }, { label: 'What if, from the start', options: hypothetical.map(toOption) }].filter(group => group.options.length > 0)
  const pickDecision = (value: string) => {
    const next = decisions.find(decision => decision.id === value)!
    // Results are keyed by selection, so no reset here: re-choosing the current option keeps its result instead of
    // wiping it (the effect only re-runs when the key changes).
    setSelection({ decision: next.id, alternative: next.alternatives[0]?.id ?? '' })
  }
  return <section className="fv-what-if" aria-labelledby="fv-what-if-title">
    <h2 id="fv-what-if-title">What if you’d chosen differently?</h2>
    {decisions.length === 0 ? <Inset><p className="fv-what-if-empty">You didn’t change any settings this time. Next story, visit a building and make a choice to compare.</p></Inset>
      : <>
        <p className="fv-what-if-lead">Change one decision. The same 1,000 futures run again with the same luck, so the difference is the decision alone.</p>
        <div className="fv-what-if-fields">
          {groups.length > 1 ? <GroupedSelect label="Pick a decision" value={selection.decision} groups={groups} onChange={pickDecision}/>
            : <Select label="Pick a decision" value={selection.decision} options={decisions.map(toOption)} onChange={pickDecision}/>}
          <Select label="Instead…" value={selection.alternative} options={(selected?.alternatives ?? []).map(alternative => ({ value: alternative.id, label: alternative.label }))} onChange={value => setSelection(previous => ({ ...previous, alternative: value }))}/>
        </div>
        <div className="fv-comparison-charts"><OutcomeChart lines={result?.original ?? original} yDomain={domain} title="What you did"/>
          <div aria-busy={pending} className="fv-changed-chart">{result ? <OutcomeChart lines={result.changed} yDomain={domain} title={`If you had: ${result.alternativeLabel}`} highlightLabel="Your exact events, with this change"/> : error ? <p role="alert">{error}</p> : <p role="status"><img className="fv-computing-coin" src="/art/title/favicon.png" alt=""/>Re-running 1,000 futures…</p>}</div></div>
        {result && <ChangeStrip result={result}/>}
      </>}
  </section>
}
