import { usd } from '@/components/flow/format'
import type { WhatIfResult } from './ending-contract'

export function changeSentence(median: number, spread: number): string {
  if (median === 0 && spread === 0) return 'The typical outcome and spread stayed the same.'
  if (median === 0) return spread < 0 ? 'The typical outcome stayed the same; futures ended closer together.' : 'The typical outcome stayed the same; futures ended farther apart.'
  if (spread === 0) return median > 0 ? 'Typically better off, with the same spread of outcomes.' : 'Typically worse off, with the same spread of outcomes.'
  if (median > 0) return spread < 0 ? 'Typically better off, and outcomes were less spread out: safer and richer in this simulation.' : 'Typically better off, with a wider range of possible outcomes.'
  return spread < 0 ? 'Typically worse off, with a narrower range of possible outcomes.' : 'Typically worse off, and outcomes were more spread out.'
}

export function ChangeStrip({ result }: { result: WhatIfResult }) {
  const { delta } = result
  return <section className="fv-change-strip" aria-label="Changes with this decision">
    <dl><div><dt>Typical outcome</dt><dd data-direction={Math.sign(delta.median)}>{usd(delta.median,true)}</dd></div>
      <div><dt>Your exact events</dt><dd data-direction={Math.sign(delta.yourEvents)}>{usd(delta.yourEvents,true)}</dd>{!result.yourEventsComparable && <small>estimated from a replay of your game</small>}</div>
      <div><dt>Spread (lucky vs unlucky)</dt><dd>{delta.spread === 0 ? 'Unchanged' : `${delta.spread < 0 ? 'Narrower' : 'Wider'} by ${usd(Math.abs(delta.spread))}`}</dd></div></dl>
    <p>{changeSentence(delta.median, delta.spread)}</p>
    {result.replayFallbacks > 0 && <small>{result.replayFallbacks} later decisions couldn’t apply in some futures.</small>}
  </section>
}
