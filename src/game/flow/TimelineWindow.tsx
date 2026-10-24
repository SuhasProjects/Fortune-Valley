import { useState } from 'react'
import type { TimelineEntry, TimelineEntryType } from '../../types/domain'
import { PanelHost } from '../../components/town/PanelHost'
import { monthLabel, usd } from '../../components/flow/format'

type Filter = 'all' | 'choices' | 'surprises' | 'milestones'
const matches: Record<Exclude<Filter, 'all'>, TimelineEntryType[]> = {
  choices: ['choice', 'policy_change'], surprises: ['shock', 'ai_event'], milestones: ['milestone'],
}
const icons: Record<TimelineEntryType, string> = { choice: '◆', shock: '!', milestone: '★', policy_change: '↻', ai_event: '✦' }

export function TimelineWindow({ entries, startMonth, onClose }: { entries: TimelineEntry[]; startMonth: string; onClose: () => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const visible = [...entries].reverse().filter(entry => filter === 'all' || matches[filter].includes(entry.type))
  return <PanelHost title="Your timeline" onClose={onClose}>
    <div className="timeline-tabs" role="tablist" aria-label="Timeline filters">{(['all', 'choices', 'surprises', 'milestones'] as Filter[]).map(item => <button key={item} className="pixel-button" role="tab" aria-selected={filter === item} onClick={() => setFilter(item)}>{item[0]!.toUpperCase() + item.slice(1)}</button>)}</div>
    {visible.length ? <ol className="story-list">{visible.map(entry => <li key={entry.id}><span className="eyebrow">{icons[entry.type]} · {monthLabel(startMonth, entry.monthIndex)} · {entry.type.replaceAll('_', ' ')}</span><p>{entry.description}</p><strong>Net worth {usd(entry.netWorthAfter)}</strong></li>)}</ol> : <p>Your story starts here…</p>}
  </PanelHost>
}
