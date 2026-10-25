import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from './Icon'
import './Dropdown.css'

export interface DropdownOption { value: string; label: string }
export interface DropdownGroup { label: string; options: DropdownOption[] }
export interface DropdownProps {
  label: string
  value: string
  onChange: (value: string) => void
  /** Flat options, or `groups` for labelled sections (both may be given; flat options come first). */
  options?: DropdownOption[]
  groups?: DropdownGroup[]
  id?: string
  disabled?: boolean
  hint?: string
}

/** A themed select: a kit field button that opens a parchment listbox. Keyboard: Enter/Space/Arrow keys open, arrows
 * move, Home/End jump, Enter/Space choose, Escape or Tab closes. The button is a combobox for assistive tech. */
export function Dropdown({ label, value, onChange, options = [], groups = [], id: passedId, disabled, hint }: DropdownProps) {
  const generated = useId(), id = passedId ?? generated
  const sections: DropdownGroup[] = [...(options.length ? [{ label: '', options }] : []), ...groups]
  const flat = sections.flatMap(group => group.options)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, flat.findIndex(option => option.value === value)))
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const selected = flat.find(option => option.value === value)
  const optionId = (index: number) => `${id}-option-${index}`

  useEffect(() => {
    if (!open) return
    list.current?.focus()
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])
  useEffect(() => {
    if (!open) return
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: 'nearest' })
  }, [open, activeIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const show = (index = Math.max(0, flat.findIndex(option => option.value === value))) => { if (!disabled && flat.length) { setActiveIndex(index); setOpen(true) } }
  const close = (refocus = true) => { setOpen(false); if (refocus) button.current?.focus() }
  const choose = (index: number) => { const option = flat[index]; if (option) onChange(option.value); close() }
  const move = (delta: number) => setActiveIndex(index => Math.min(flat.length - 1, Math.max(0, index + delta)))

  const onButtonKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') { event.preventDefault(); show() }
  }
  const onListKey = (event: KeyboardEvent<HTMLUListElement>) => {
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); move(1); break
      case 'ArrowUp': event.preventDefault(); move(-1); break
      case 'Home': event.preventDefault(); setActiveIndex(0); break
      case 'End': event.preventDefault(); setActiveIndex(flat.length - 1); break
      case 'Enter': case ' ': event.preventDefault(); choose(activeIndex); break
      case 'Escape': event.preventDefault(); close(); break
      case 'Tab': close(false); break
      default: {
        if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return
        const needle = event.key.toLowerCase()
        const index = flat.findIndex((option, position) => position > activeIndex && option.label.toLowerCase().startsWith(needle))
        const wrapped = index === -1 ? flat.findIndex(option => option.label.toLowerCase().startsWith(needle)) : index
        if (wrapped !== -1) setActiveIndex(wrapped)
      }
    }
  }

  let position = -1
  return <div ref={root} className={`fv-field fv-dropdown ${open ? 'fv-dropdown--open' : ''}`}>
    <span id={`${id}-label`} className="fv-dropdown__label">{label}</span>
    <button ref={button} id={id} type="button" className="fv-field-control fv-dropdown__button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-listbox`} aria-labelledby={`${id}-label`} aria-describedby={hint ? `${id}-hint` : undefined} disabled={disabled} onClick={() => open ? close() : show()} onKeyDown={onButtonKey}>
      <span className="fv-dropdown__value">{selected?.label ?? ''}</span><Icon name="arrow-right" compact/>
    </button>
    {hint && <span id={`${id}-hint`} className="fv-field__hint">{hint}</span>}
    {open && <ul ref={list} id={`${id}-listbox`} className="fv-dropdown__list" role="listbox" tabIndex={-1} aria-labelledby={`${id}-label`} aria-activedescendant={optionId(activeIndex)} onKeyDown={onListKey} onBlur={event => { if (!root.current?.contains(event.relatedTarget as Node)) setOpen(false) }}>
      {sections.map((group, groupIndex) => {
        const items = group.options.map(option => { position += 1; const index = position; return <li key={option.value} id={optionId(index)} role="option" aria-selected={option.value === value} className={`fv-dropdown__option ${index === activeIndex ? 'fv-dropdown__option--active' : ''}`} onPointerMove={() => setActiveIndex(index)} onClick={() => choose(index)}>{option.label}</li> })
        return group.label
          ? <li key={`g${groupIndex}`} role="presentation" className="fv-dropdown__group"><ul role="group" aria-labelledby={`${id}-group-${groupIndex}`}><li id={`${id}-group-${groupIndex}`} role="presentation" className="fv-dropdown__group-label">{group.label}</li>{items}</ul></li>
          : items
      })}
    </ul>}
  </div>
}
