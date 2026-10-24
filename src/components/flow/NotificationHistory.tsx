import type { GameNotification } from '@/types/domain';
import { usd } from './format';

export function NotificationHistory({ open, notifications, onClose, onMarkAllRead, onOpenBuilding }: {
  open: boolean;
  notifications: GameNotification[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onOpenBuilding?: (target: NonNullable<GameNotification['relatedBuilding']>) => void;
}) {
  if (!open) return null;
  const entries = notifications.slice().reverse();
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="timeline-drawer pixel-panel" role="dialog" aria-modal="true" aria-labelledby="activity-title">
        <header>
          <div><small>LEDGER-SAFE HISTORY</small><h2 id="activity-title">Activity</h2></div>
          <button className="icon-button" aria-label="Close activity history" onClick={onClose}>×</button>
        </header>
        <button className="pixel-button" onClick={onMarkAllRead} disabled={notifications.every((item) => item.read)}>Mark all read</button>
        {entries.length === 0 ? <p className="empty-copy">No activity has been posted yet.</p> : (
          <ol className="activity-history">
            {entries.map((item) => (
              <li key={item.id} className={item.read ? 'is-read' : 'is-unread'}>
                <span>Month {item.monthIndex} · {item.kind}</span>
                <strong>{item.summary}</strong>
                {item.amountSigned !== undefined && <b className={item.amountSigned < 0 ? 'money-negative' : 'money-positive'}>{usd(item.amountSigned, true)}</b>}
                {item.details && <p>{item.details}</p>}
                {item.relatedBuilding && onOpenBuilding && <button className="text-button" onClick={() => { onOpenBuilding(item.relatedBuilding!); onClose(); }}>Open {item.relatedBuilding}</button>}
              </li>
            ))}
          </ol>
        )}
        <small>Notifications summarize activity. The immutable ledger remains the source of truth for amounts.</small>
      </aside>
    </div>
  );
}
