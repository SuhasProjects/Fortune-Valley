import { motion, AnimatePresence } from 'framer-motion'
import type { GameNotification } from '../../types/domain'
import { usd } from './format'
export function NotificationStack({ notifications, onOpenBuilding, onViewAll, onDismiss, showHistoryButton = true }: { showHistoryButton?: boolean; notifications: GameNotification[]; onOpenBuilding?: (target: NonNullable<GameNotification['relatedBuilding']>) => void; onViewAll: () => void; onDismiss: (id: string) => void }) {
  const visible = notifications.filter(n => !n.read).slice(-3).reverse()
  return <aside className="notification-stack" aria-label="Recent financial activity" aria-live="polite">
    <AnimatePresence>{visible.map(n => <motion.article className={`pixel-panel notice notice--${n.kind}`} key={n.id} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>
      <div><small>Month {n.monthIndex}</small><button className="icon-button" aria-label={`Dismiss ${n.summary}`} onClick={() => onDismiss(n.id)}>×</button></div>
      <strong>{n.summary}</strong>{n.amountSigned !== undefined && <span className={n.amountSigned < 0 ? 'money-negative' : 'money-positive'}>{usd(n.amountSigned, true)}</span>}
      {n.details && <p>{n.details}</p>}{n.relatedBuilding && onOpenBuilding && <button onClick={() => onOpenBuilding(n.relatedBuilding!)}>Open {n.relatedBuilding}</button>}
    </motion.article>)}</AnimatePresence>
    {showHistoryButton && notifications.length > 0 && <button className="pixel-button history-button" onClick={onViewAll}>View all activity</button>}
  </aside>
}
