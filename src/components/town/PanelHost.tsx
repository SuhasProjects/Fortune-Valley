import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { BuildingId } from '../../types/domain'
import { buildings } from './buildings'
export interface PanelHostProps { building?: BuildingId; title?: string; onClose: () => void; children: ReactNode }
export function PanelHost({ building, title, onClose, children }: PanelHostProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const heading = useId()
  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter(element => element.getClientRects().length > 0)
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current
    dialog?.showModal()
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { dialog?.close(); document.body.style.overflow = oldOverflow; previous?.focus() }
  }, [])
  return <dialog ref={ref} className="panel-dialog pixel-panel" aria-labelledby={heading} onKeyDown={containTab} onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { if (e.target === e.currentTarget) { const box = e.currentTarget.getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) onClose() } }}><header className="panel-heading"><div><span className="eyebrow">{building ? buildings[building].hint : 'YOUR FINANCIAL STORY'}</span><h2 id={heading}>{title ?? (building ? buildings[building].title : 'Your story')}</h2></div><button autoFocus className="pixel-button close-panel" aria-label="Close panel" onClick={onClose}>×</button></header><div className="panel-content">{children}</div></dialog>
}
