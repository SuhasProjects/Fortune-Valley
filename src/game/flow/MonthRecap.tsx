import { useEffect, useRef, useState } from 'react'
import type { GameConfig, GameState } from '../../types/domain'
import { monthLabel, usd } from '../../components/flow/format'
import { netWorthOf } from '../../engine'
import { Board } from '../../ui'
import { recapChips, recapNetWorthDelta } from './recapChips'
import './flow.css'

export const RECAP_LIFETIME_MS = 5_000

/**
 * Slim parchment strip under the HUD after every month advance (auto or `Next month`): month, date, net worth
 * with its change, then signed chips for the month's cash-flow groups. Shows for ~5 s, is replaced when the next
 * month lands, and never takes focus. The live region stays mounted so screen readers announce each recap.
 */
export function MonthRecap({ game, config, reduceMotion }: { game: GameState; config: GameConfig; reduceMotion?: boolean }) {
  const [shown, setShown] = useState<number | null>(null)
  const previous = useRef(game.monthIndex)
  useEffect(() => {
    const landed = game.monthIndex === previous.current + 1
    previous.current = game.monthIndex
    if (!landed) return
    setShown(game.monthIndex)
    const timeout = window.setTimeout(() => setShown(null), RECAP_LIFETIME_MS)
    return () => window.clearTimeout(timeout)
  }, [game.monthIndex])
  const visible = shown !== null && shown === game.monthIndex
  const delta = visible ? recapNetWorthDelta(game) : null
  return <div className="fv-month-recap-host" role="status" aria-live="polite" aria-label="Month recap">
    {visible && <Board key={shown} padding="sm" className="fv-month-recap" data-reduce-motion={reduceMotion || undefined}>
      <p className="fv-month-recap__line">
        <strong>Month {game.monthIndex}</strong> · {monthLabel(config.startMonth, game.monthIndex)} · Net worth {usd(netWorthOf(game))}
        {delta !== null && delta !== 0 && <> <span className={`fv-month-recap__delta fv-month-recap__delta--${delta > 0 ? 'up' : 'down'}`}>({delta > 0 ? '▲' : '▼'} {usd(Math.abs(delta))})</span></>}
      </p>
      <ul className="fv-month-recap__chips" aria-label="This month's cash flow">
        {recapChips(game).map(chip => <li key={chip.group} className={`fv-chip fv-chip--${chip.amount > 0 ? 'up' : 'down'}`}>{usd(chip.amount, true)} {chip.label}</li>)}
      </ul>
    </Board>}
  </div>
}
