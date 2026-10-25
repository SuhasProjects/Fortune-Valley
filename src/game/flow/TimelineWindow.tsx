import { useState } from 'react'
import type { TimelineEntry, TimelineEntryType } from '../../types/domain'
import { monthLabel } from '../../components/flow/format'
import { Icon, Modal, Money, Tabs, type IconName } from '../../ui'
import './flow.css'

type Filter = 'all' | 'choices' | 'surprises' | 'milestones'
const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'choices', label: 'Choices' }, { id: 'surprises', label: 'Surprises' }, { id: 'milestones', label: 'Milestones' },
]
const matches: Record<Exclude<Filter, 'all'>, TimelineEntryType[]> = {
  choices: ['choice', 'policy_change'], surprises: ['shock', 'ai_event'], milestones: ['milestone'],
}
const icons: Record<TimelineEntryType, IconName> = { choice: 'quill', shock: 'warning', milestone: 'star', policy_change: 'scroll', ai_event: 'bell' }
const labels: Record<TimelineEntryType, string> = { choice: 'Choice', shock: 'Surprise', milestone: 'Milestone', policy_change: 'Policy change', ai_event: 'Opportunity' }

/** Journal of everything that happened, newest first. Dialog name: `Your timeline`. */
export function TimelineWindow({ entries, startMonth, onClose }: { entries: TimelineEntry[]; startMonth: string; onClose: () => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const visible = [...entries].reverse().filter(entry => filter === 'all' || matches[filter].includes(entry.type))
  return <Modal title="Your timeline" onClose={onClose}>
    <Tabs tabs={filters} value={filter} onChange={value => setFilter(value as Filter)}>
      {visible.length ? <ol className="fv-journal">{visible.map(entry => <li key={entry.id}>
        <span className="fv-journal__meta"><Icon name={icons[entry.type]} compact/>{monthLabel(startMonth, entry.monthIndex)} · {labels[entry.type]}</span>
        <p>{entry.description}</p>
        <span className="fv-journal__row"><span>Net worth after</span><Money value={entry.netWorthAfter}/></span>
      </li>)}</ol> : <p className="fv-journal-empty">Your story starts here…</p>}
    </Tabs>
  </Modal>
}
