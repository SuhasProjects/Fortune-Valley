import { useEffect, useRef, useState } from 'react'
import type { GameNotification } from '../../types/domain'
import { BUILDINGS } from '../world/landmarks'
import { Board, Button, Icon, IconButton, Money } from '../../ui'
import { useSettings } from '../settings'
import { notificationIcons } from './ActivityWindow'
import './flow.css'

export const TOAST_LIFETIME_MS = 10_000

interface ToastProps {
  notification: GameNotification
  dismiss: (id: string) => void
  openBuilding?: (building: NonNullable<GameNotification['relatedBuilding']>) => void
  reduceMotion?: boolean
}

function Toast({ notification: item, dismiss, openBuilding, reduceMotion }: ToastProps) {
  const [hovered, setHovered] = useState(false)
  const remaining = useRef(TOAST_LIFETIME_MS)
  const started = useRef(0)
  useEffect(() => {
    if (hovered) return
    started.current = Date.now()
    const timeout = window.setTimeout(() => dismiss(item.id), remaining.current)
    return () => {
      window.clearTimeout(timeout)
      remaining.current = Math.max(0, remaining.current - (Date.now() - started.current))
    }
  }, [dismiss, hovered, item.id, item.kind])
  const building = item.relatedBuilding
  return <div className={`fv-toast__enter${reduceMotion ? ' fv-toast__enter--still' : ''}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
    <Board as="article" className={`fv-toast fv-toast--${item.kind} notice notice--${item.kind}`}>
      <div className="fv-toast__head"><Icon name={notificationIcons[item.kind]} compact/><span>Month {item.monthIndex}</span><IconButton size="sm" variant="ghost" icon="close" label={`Dismiss ${item.summary}`} onClick={() => dismiss(item.id)}/></div>
      <strong>{item.flavour?.headline ?? item.summary}</strong>
      {item.amountSigned !== undefined && <Money value={item.amountSigned} signed/>}
      {item.flavour ? <p className="fv-toast__scene">{item.flavour.scene}</p> : item.details && <p>{item.details}</p>}
      {building && openBuilding && <Button size="sm" variant={item.kind === 'decision' ? 'primary' : 'wood'} iconRight="arrow-right" onClick={() => openBuilding(building)}>{item.kind === 'decision' ? `Go to ${BUILDINGS[building].title}` : `Open ${BUILDINGS[building].title}`}</Button>}
    </Board>
  </div>
}

/** Up to three unread notices under the HUD. Decisions sort first; every toast fades after ten seconds (hover holds it). A waiting decision keeps its building badge. */
export function ToastStack({ notifications, onOpenBuilding, onViewAll, onDismiss }: { notifications: GameNotification[]; onOpenBuilding?: ToastProps['openBuilding']; onViewAll: () => void; onDismiss: (id: string) => void }) {
  const { reduceMotion } = useSettings()
  const visible = notifications.filter(item => !item.read).sort((a, b) => Number(b.kind === 'decision') - Number(a.kind === 'decision') || b.monthIndex - a.monthIndex).slice(0, 3)
  return <section className="fv-toasts" aria-label="Recent financial activity" aria-live="polite">
    {visible.map(item => <Toast key={item.id} notification={item} dismiss={onDismiss} openBuilding={onOpenBuilding} reduceMotion={reduceMotion}/>)}
    {notifications.length > 0 && <Button size="sm" icon="scroll" className="fv-view-all" onClick={onViewAll}>View all activity</Button>}
  </section>
}
