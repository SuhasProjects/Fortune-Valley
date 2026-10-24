import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameNotification } from '../../types/domain'
import { buildings } from '../../components/town/buildings'
import { usd } from '../../components/flow/format'
import { useSettings } from '../settings'

interface ToastProps {
  notification: GameNotification
  dismiss: (id: string) => void
  openBuilding?: (building: NonNullable<GameNotification['relatedBuilding']>) => void
}

function Toast({ notification: item, dismiss, openBuilding }: ToastProps) {
  const [hovered, setHovered] = useState(false)
  const remaining = useRef(6_000)
  const started = useRef(0)
  useEffect(() => {
    if (item.kind === 'decision' || hovered) return
    started.current = Date.now()
    const timeout = window.setTimeout(() => dismiss(item.id), remaining.current)
    return () => {
      window.clearTimeout(timeout)
      remaining.current = Math.max(0, remaining.current - (Date.now() - started.current))
    }
  }, [dismiss, hovered, item.id, item.kind])
  const icon = item.kind === 'decision' ? '🔔' : item.kind === 'positive' ? '●' : item.kind === 'negative' ? '◒' : '▤'
  return <motion.article className={`pixel-panel notice notice--${item.kind}`} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
    <div><small>{icon} · Month {item.monthIndex}</small><button className="icon-button" aria-label={`Dismiss ${item.summary}`} onClick={() => dismiss(item.id)}>×</button></div>
    <strong>{item.summary}</strong>
    {item.amountSigned !== undefined && <span className={item.amountSigned < 0 ? 'money-negative' : 'money-positive'}>{usd(item.amountSigned, true)}</span>}
    {item.details && <p>{item.details}</p>}
    {item.relatedBuilding && openBuilding && <button className={item.kind === 'decision' ? 'pixel-button pixel-button--gold' : 'pixel-button'} onClick={() => openBuilding(item.relatedBuilding!)}>{item.kind === 'decision' ? `Go to ${buildings[item.relatedBuilding].title}` : `Open ${buildings[item.relatedBuilding].title}`}</button>}
  </motion.article>
}

export function ToastStack({ notifications, onOpenBuilding, onViewAll, onDismiss }: { notifications: GameNotification[]; onOpenBuilding?: ToastProps['openBuilding']; onViewAll: () => void; onDismiss: (id: string) => void }) {
  const { reduceMotion } = useSettings()
  const visible = notifications.filter(item => !item.read).sort((a, b) => Number(b.kind === 'decision') - Number(a.kind === 'decision') || b.monthIndex - a.monthIndex).slice(0, 3)
  return <aside className="notification-stack" aria-label="Recent financial activity" aria-live="polite">
    <AnimatePresence initial={false}>{visible.map(item => <Toast key={item.id} notification={item} dismiss={onDismiss} openBuilding={onOpenBuilding}/>)}</AnimatePresence>
    {notifications.length > 0 && <button className="pixel-button history-button" onClick={onViewAll}>View all activity</button>}
    {reduceMotion && <span className="sr-only">Animations reduced</span>}
  </aside>
}
