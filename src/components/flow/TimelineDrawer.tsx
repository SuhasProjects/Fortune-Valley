import type { TimelineEntry } from '@/types/domain';
import { usd } from './format';

export function TimelineDrawer({ open, entries, onClose }: { open: boolean; entries: TimelineEntry[]; onClose: () => void }) {
  if (!open) return null;
  const important = entries.slice().reverse();
  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="timeline-drawer pixel-panel" role="dialog" aria-modal="true" aria-labelledby="timeline-title">
        <header>
          <div><small>YOUR FINANCIAL STORY</small><h2 id="timeline-title">Timeline</h2></div>
          <button className="icon-button" aria-label="Close timeline" onClick={onClose}>×</button>
        </header>
        {important.length === 0 ? (
          <p className="empty-copy">Advance time or change a policy to start your timeline.</p>
        ) : (
          <ol>
            {important.map((entry) => (
              <li key={entry.id} className={`timeline-${entry.type}`}>
                <span>Month {entry.monthIndex} · net worth {usd(entry.netWorthAfter)}</span>
                <strong>{entry.type.replace('_', ' ')}</strong>
                <p>{entry.description}</p>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
