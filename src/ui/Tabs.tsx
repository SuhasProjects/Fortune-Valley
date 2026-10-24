import { useId, useRef, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import './Tabs.css'
export interface TabsProps { tabs: { id: string; label: string; icon?: IconName }[]; value: string; onChange: (value: string) => void; children: ReactNode }
export function Tabs({ tabs, value, onChange, children }: TabsProps) {
  const id = useId(), ref = useRef<HTMLDivElement>(null)
  return <div className="fv-tabs"><div role="tablist" aria-label="Sections" ref={ref}>{tabs.map((tab, index) => <button type="button" role="tab" className="fv-tab" id={`${id}-${tab.id}`} key={tab.id} aria-controls={`${id}-panel`} aria-selected={value === tab.id} tabIndex={value === tab.id ? 0 : -1} onClick={() => onChange(tab.id)} onKeyDown={event => {
    let next: number
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return
    event.preventDefault(); onChange(tabs[next]!.id); ref.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus()
  }}>{tab.icon && <Icon name={tab.icon}/ >}{tab.label}</button>)}</div><div role="tabpanel" tabIndex={0} id={`${id}-panel`} aria-labelledby={`${id}-${value}`}>{children}</div></div>
}

