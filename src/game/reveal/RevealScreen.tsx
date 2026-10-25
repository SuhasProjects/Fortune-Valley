import { useRef, useState, useEffect } from 'react'
import { createGame, netWorthOf } from '@/engine'
import { Board, Button, Field, Plaque, Tag } from '@/ui'
import { useGameStore, type FinishPayload } from '@/stores/useGameStore'
import { usd } from '@/components/flow/format'
import { TitleStage, readReduceMotion } from '../title/contracts'
import { TownWorld } from '@/game/world/TownWorld'
import { originalLines } from './ending-contract'
import { OutcomeChart, sharedYDomain } from './OutcomeChart'
import { WhatIfSection } from './WhatIfSection'
import { RecapLine } from './RecapLine'
import './reveal.css'

export function RevealScreen({ payload, onPlayAgain }: { payload: FinishPayload; onPlayAgain: () => void }) {
  const { monteCarlo: mc } = payload
  const start = payload.finalState.netWorthHistory[0] ?? netWorthOf(createGame(payload.config))
  const lines = originalLines(mc, start)
  const heading = useRef<HTMLHeadingElement>(null)
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState('')
  const requestExplanation = useGameStore(state => state.requestExplanation)
  const mounted = useRef(true)
  const paths = mc.pathsCompleted.toLocaleString()
  useEffect(() => { mounted.current = true; heading.current?.focus(); return () => { mounted.current = false } }, [])
  return <TitleStage label="Simulation results" world={<TownWorld timeOfDay="dusk"/>}>
    <div className="fv-reveal-ui" data-reduce-motion={readReduceMotion()}>
      <Board className="fv-reveal-ledger" padding="lg">
        <header className="fv-reveal-heading"><Plaque>Your Next Chapter</Plaque>
          <h1 ref={heading} tabIndex={-1}>You finished month {payload.finalState.monthIndex} with <strong>{usd(mc.observedNetWorth)}</strong></h1>
          <RecapLine state={payload.finalState}/></header>
        <section className="fv-reveal-futures" aria-label="Your simulated futures"><h2>Same strategy, {paths} futures</h2><OutcomeChart lines={lines} yDomain={sharedYDomain(lines)} title={`Your ${paths} futures`} hideTitle/></section>
        <WhatIfSection payload={payload} original={lines}/>
        <section className="fv-reveal-explanation" aria-labelledby="fv-why"><h2 id="fv-why">Why?</h2>
          <div aria-live="polite" className="fv-reveal-answer">{payload.explanation ? <><Tag tone={payload.explanation.source === 'ai' ? 'gold' : 'dark'}>{payload.explanation.source === 'ai' ? 'AI explanation' : 'Offline explanation (template)'}</Tag><p>{payload.explanation.text}</p></> : <p>Preparing your explanation…</p>}</div>
          <form className="fv-ask-row" onSubmit={async event => {
            event.preventDefault(); if (!question.trim() || asking) return
            setAsking(true); setAskError('')
            try { await requestExplanation(question.trim()) } catch { if (mounted.current) setAskError('The explanation could not be prepared. Please try again.') }
            finally { if (mounted.current) setAsking(false) }
          }}>
            <Field label="Ask about your results" id="fv-results-question" maxLength={500} value={question} onChange={event => setQuestion(event.target.value)}/>
            <Button type="submit" disabled={asking || !question.trim()}>{asking ? 'Asking…' : 'Ask'}</Button>
          </form>
          {asking && <p role="status">Preparing an explanation…</p>}{askError && <p role="alert">{askError}</p>}
        </section>
        <details className="fv-reveal-details"><summary>Details</summary><ul>{mc.assumptionsSummary.map(note => <li key={note}>{note}</li>)}</ul><p>Seed {mc.seed} · {mc.pathsCompleted} paths · {mc.replayFallbacks} replay fallbacks · computed in {mc.elapsedMs} ms.</p>{!mc.observedHorizonMatches && <p>The simulated horizon differs from the months you played. Your actual outcome uses the played horizon.</p>}</details>
        <div className="fv-play-again"><Button variant="primary" size="lg" onClick={onPlayAgain}>Choose a new story</Button></div>
      </Board>
    </div>
  </TitleStage>
}
