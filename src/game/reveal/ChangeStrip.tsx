import { usd } from '@/components/flow/format'
import { Inset } from '@/ui'
import type { WhatIfResult } from './ending-contract'

export function changeSentence(median: number, spread: number): string {
  if (median === 0 && spread === 0) return 'The typical outcome and spread stayed the same.'
  if (median === 0) return spread < 0 ? 'The typical outcome stayed the same; futures ended closer together.' : 'The typical outcome stayed the same; futures ended farther apart.'
  if (spread === 0) return median > 0 ? 'Typically better off, with the same spread of outcomes.' : 'Typically worse off, with the same spread of outcomes.'
  if (median > 0) return spread < 0 ? 'Typically better off, and outcomes were less spread out: safer and richer in this simulation.' : 'Typically better off, with a wider range of possible outcomes.'
  return spread < 0 ? 'Typically worse off, with a narrower range of possible outcomes.' : 'Typically worse off, and outcomes were more spread out.'
}

export function ChangeStrip({ result }: { result: WhatIfResult }) {
  // Display rounding only: whole dollars decide the sign so "-$0" never shows as a loss.
  const round = (value: number) => Math.round(value) || 0
  const delta = { median: round(result.delta.median), yourEvents: round(result.delta.yourEvents), spread: round(result.delta.spread) }
  return <section className="fv-change-strip" aria-label="Changes with this decision">
    <div className="fv-change-tiles">
      <Inset title="Typical"><strong className="fv-change-value" data-direction={Math.sign(delta.median)}>{usd(delta.median, true)}</strong></Inset>
      <Inset title="Your run"><strong className="fv-change-value" data-direction={Math.sign(delta.yourEvents)}>{usd(delta.yourEvents, true)}</strong>{!result.yourEventsComparable && <small>estimated from a replay of your game</small>}</Inset>
      <Inset title="Spread"><strong className="fv-change-value" data-direction={-Math.sign(delta.spread) || 0}>{delta.spread === 0 ? 'Unchanged' : `${delta.spread < 0 ? 'Narrower' : 'Wider'} by ${usd(Math.abs(delta.spread))}`}</strong></Inset>
    </div>
    <p className="fv-change-sentence">{changeSentence(delta.median, delta.spread)}</p>
    {result.replayFallbacks > 0 && <small>{result.replayFallbacks} later decisions couldn’t apply in some futures.</small>}
  </section>
}
