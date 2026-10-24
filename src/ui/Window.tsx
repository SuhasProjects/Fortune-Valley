import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { IconButton } from './Button'
import { Plaque, ScrollArea, WoodFrame } from './Surfaces'
import { useReducedMotion } from './useReducedMotion'
import './Window.css'

export interface WindowProps { title: string; plaque?: ReactNode; headerExtra?: ReactNode; onClose?: () => void; children: ReactNode; width?: 'sm' | 'md' | 'lg' }
export function Window({ title, plaque, headerExtra, onClose, children, width = 'md' }: WindowProps) {
  return <WoodFrame className={`fv-window fv-window--${width}`}><header className="fv-window__header">{plaque}<h2><Plaque>{title}</Plaque></h2>{headerExtra}{onClose && <IconButton autoFocus icon="close" label="Close panel" onClick={onClose}/>}</header><div className="fv-window__body"><ScrollArea>{children}</ScrollArea></div></WoodFrame>
}
export interface ModalProps extends Omit<WindowProps, 'onClose'> { onClose: () => void }
export function Modal({ title, onClose, ...rest }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const heading = useId()
  const reduced = useReducedMotion()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current
    dialog?.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter(element => element.getClientRects().length > 0 && !element.closest('[hidden], [inert]'))
    const first = controls[0], last = controls.at(-1)
    if (!first) { event.preventDefault(); ref.current?.focus() }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
  return <dialog ref={ref} className="fv-modal" aria-labelledby={heading} data-reduce-motion={reduced || undefined} onKeyDown={containTab} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => {
    if (event.target !== event.currentTarget) return
    const box = event.currentTarget.getBoundingClientRect()
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
  }}><span id={heading} className="fv-sr-only">{title}</span><Window title={title} onClose={onClose} {...rest}/></dialog>
}
