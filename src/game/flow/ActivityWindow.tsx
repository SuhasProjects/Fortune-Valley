import type { BuildingId, GameNotification } from '../../types/domain'
import { PanelHost } from '../../components/town/PanelHost'
import { buildings } from '../../components/town/buildings'
import { usd } from '../../components/flow/format'

export function ActivityWindow({ notifications, onClose, onMarkAllRead, onOpenBuilding }: { notifications: GameNotification[]; onClose: () => void; onMarkAllRead: () => void; onOpenBuilding: (building: BuildingId) => void }) {
  return <PanelHost title="Town activity" onClose={onClose}>
    <button className="pixel-button" onClick={onMarkAllRead} disabled={notifications.every(item => item.read)}>Mark all read</button>
    <ol className="story-list">{[...notifications].reverse().map(item => <li key={item.id} className={item.read ? 'notice-read' : 'notice-unread'}><span className="eyebrow">MONTH {item.monthIndex} · {item.kind}{item.read ? '' : ' · NEW'}</span><h3>{item.summary}</h3>{item.details && <p>{item.details}</p>}{item.amountSigned !== undefined && <strong>{usd(item.amountSigned, true)}</strong>}{item.relatedBuilding && <button className="pixel-button" onClick={() => onOpenBuilding(item.relatedBuilding!)}>Open {buildings[item.relatedBuilding].title}</button>}</li>)}</ol>
  </PanelHost>
}
