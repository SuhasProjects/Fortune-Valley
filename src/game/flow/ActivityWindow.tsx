import type { BuildingId, GameNotification } from '../../types/domain'
import { BUILDINGS } from '../world/landmarks'
import { Button, Icon, Modal, Money, Tag, type IconName } from '../../ui'
import './flow.css'

export const notificationIcons: Record<GameNotification['kind'], IconName> = { info: 'book', positive: 'coin', negative: 'warning', decision: 'bell' }

/** Every notification, newest first. Dialog name: `Town activity`. */
export function ActivityWindow({ notifications, onClose, onMarkAllRead, onOpenBuilding }: { notifications: GameNotification[]; onClose: () => void; onMarkAllRead: () => void; onOpenBuilding: (building: BuildingId) => void }) {
  const items = [...notifications].reverse()
  return <Modal title="Town activity" onClose={onClose} headerExtra={<Button size="sm" icon="check" onClick={onMarkAllRead} disabled={notifications.every(item => item.read)}>Mark all read</Button>}>
    {items.length ? <ol className="fv-journal">{items.map(item => <li key={item.id} className={item.read ? 'is-read' : 'is-unread'}>
      <span className="fv-journal__meta"><Icon name={notificationIcons[item.kind]} compact/>Month {item.monthIndex} · {item.kind}{!item.read && <Tag tone="gold">New</Tag>}</span>
      <h3>{item.summary}</h3>
      {item.details && <p>{item.details}</p>}
      {(item.amountSigned !== undefined || item.relatedBuilding) && <span className="fv-journal__row">
        {item.amountSigned !== undefined ? <Money value={item.amountSigned} signed/> : <span/>}
        {item.relatedBuilding && <Button size="sm" iconRight="arrow-right" onClick={() => onOpenBuilding(item.relatedBuilding!)}>Open {BUILDINGS[item.relatedBuilding].title}</Button>}
      </span>}
    </li>)}</ol> : <p className="fv-journal-empty">Nothing has happened in town yet.</p>}
  </Modal>
}
