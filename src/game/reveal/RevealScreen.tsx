import { useRef, useState, useEffect, type ComponentType } from 'react'
import { createGame, netWorthOf } from '@/engine'
import { useGameStore, type FinishPayload } from '@/stores/useGameStore'
import { usd } from '@/components/flow/format'
import { TitleStage, Ledger, MenuButton, readReduceMotion } from '../title/contracts'
import { TitleScene } from '../title/TitleScene'
import { originalLines } from './ending-contract'
import { OutcomeChart, sharedYDomain } from './OutcomeChart'
import { WhatIfSection } from './WhatIfSection'
import './reveal.css'

const worlds = import.meta.glob<{ TownWorld: ComponentType<{ timeOfDay: 'dusk' }> }>('/src/game/world/TownWorld.tsx', { eager: true })
const TownWorld = Object.values(worlds)[0]?.TownWorld

export function RevealScreen({ payload, onPlayAgain }: { payload: FinishPayload; onPlayAgain: () => void }) {
  const { monteCarlo: mc } = payload
  const start = payload.finalState.netWorthHistory[0] ?? netWorthOf(createGame(payload.config))
  const lines = originalLines(mc,start)
  const heading = useRef<HTMLHeadingElement>(null)
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState('')
  const requestExplanation = useGameStore(state => state.requestExplanation)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; heading.current?.focus(); return () => { mounted.current = false } }, [])
  return <div data-fv-reveal="true"><TitleStage label="Simulation results" world={TownWorld ? <TownWorld timeOfDay="dusk"/> : <TitleScene dusk/>}>
    <div className="fv-reveal-ui" data-reduce-motion={readReduceMotion()}>
      <Ledger className="fv-reveal-ledger">
        <header className="fv-reveal-heading"><span>Your Next Chapter</span><h1 ref={heading} tabIndex={-1}>You finished month {payload.finalState.monthIndex} with <strong>{usd(mc.observedNetWorth)}</strong></h1>
          <p>8 in 10 of your {mc.pathsCompleted.toLocaleString()} futures ended between <strong>{usd(mc.p10)}</strong> and <strong>{usd(mc.p90)}</strong>.</p><small>A range of possibilities, not a grade or a forecast.</small></header>
        <section aria-label="Your simulated futures"><h2>Same strategy, {mc.pathsCompleted.toLocaleString()} futures</h2><OutcomeChart lines={lines} yDomain={sharedYDomain(lines)} title={`Your ${mc.pathsCompleted.toLocaleString()} futures`}/></section>
        <WhatIfSection payload={payload} original={lines}/>
        <section className="fv-reveal-explanation" aria-labelledby="fv-why"><h2 id="fv-why">Why?</h2>
          <div aria-live="polite">{payload.explanation ? <><span className="offline-tag">{payload.explanation.source === 'ai' ? 'AI explanation' : 'Offline explanation (template)'}</span><p>{payload.explanation.text}</p></> : <p>Preparing your explanation…</p>}</div>
          <form onSubmit={async event => {
            event.preventDefault(); if (!question.trim() || asking) return
            setAsking(true); setAskError('')
            try { await requestExplanation(question.trim()) } catch { if (mounted.current) setAskError('The explanation could not be prepared. Please try again.') }
            finally { if (mounted.current) setAsking(false) }
          }}><label htmlFor="fv-results-question">Ask about your results</label><div className="fv-ask-row"><input className="pixel-panel" id="fv-results-question" maxLength={500} value={question} onChange={event => setQuestion(event.target.value)}/><MenuButton type="submit" disabled={asking || !question.trim()}>{asking ? 'Asking…' : 'Ask'}</MenuButton></div>{asking && <p role="status">Preparing an explanation…</p>}{askError && <p role="alert">{askError}</p>}</form>
        </section>
        <details className="fv-reveal-details"><summary>Details</summary><ul>{mc.assumptionsSummary.map(note => <li key={note}>{note}</li>)}</ul><p>Seed {mc.seed} · {mc.pathsCompleted} paths · {mc.replayFallbacks} replay fallbacks · computed in {mc.elapsedMs} ms.</p>{!mc.observedHorizonMatches && <p>The simulated horizon differs from the months you played. Your actual outcome uses the played horizon.</p>}</details>
        <MenuButton primary className="fv-play-again" onClick={onPlayAgain}>Choose a new story</MenuButton>
      </Ledger>
    </div>
  </TitleStage></div>
}
