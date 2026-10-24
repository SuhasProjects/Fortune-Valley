import { useEffect, useRef, useState } from 'react'
import { useGameStore, selectDebtTotal, selectNetWorth } from '../../stores/useGameStore'
import { monthLabel, usd } from '../../components/flow/format'
import { Board, Button, Divider, Icon, Money, type IconName, useReducedMotion } from '../../ui'
import './hud.css'

function Value({ label, icon, value }: { label: string; icon: IconName; value: number }) {
  const previous = useRef(value)
  const [tick, setTick] = useState<{ delta: number; key: number } | null>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    const delta = value - previous.current
    previous.current = value
    if (!delta) return
    setTick({ delta, key: Date.now() })
    const timer = setTimeout(() => setTick(null), 600)
    return () => clearTimeout(timer)
  }, [value])
  return <div className="fv-hud__stat"><Icon name={icon}/><dl><dt>{label}</dt><dd className={tick ? `fv-value-tick fv-value-tick--${tick.delta > 0 ? 'up' : 'down'}` : ''} data-reduce-motion={reduced || undefined}><Money value={value}/>{tick && !reduced && <span key={tick.key} className="fv-value-delta" aria-hidden="true">{usd(tick.delta, true)}</span>}</dd></dl></div>
}
export function Hud({ onOpenTimeline }: { onOpenTimeline: () => void }) {
  const game = useGameStore(state => state.game)
  const config = useGameStore(state => state.config)
  const debt = useGameStore(selectDebtTotal), netWorth = useGameStore(selectNetWorth)
  if (!game || !config) return null
  return <Board as="header" role="region" padding="sm" className="fv-hud" aria-label="Financial overview"><div className="fv-hud__brand"><span className="fv-hud__brand-icon"><Icon name="coin"/></span><div><strong>FORTUNE VALLEY</strong><span title={config.title}>{config.title}</span></div></div><Divider vertical/><div className="fv-hud__date"><Icon name="calendar"/><div><strong>{monthLabel(config.startMonth, game.monthIndex)}</strong><span>Month {game.monthIndex} / {config.durationMonths}</span></div></div><Divider vertical/><Value label="Cash" icon="coin" value={game.cash}/><Divider vertical/><Value label="Savings" icon="leaf" value={game.savings}/><Divider vertical/><Value label="Debt" icon="ledger" value={debt}/><Divider vertical/><Value label="Net worth" icon="purse" value={netWorth}/><Button size="sm" iconRight="arrow-up-right" onClick={onOpenTimeline}>Timeline</Button></Board>
}
