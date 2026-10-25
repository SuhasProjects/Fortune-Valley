import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Icon } from './Icon'
import './Fields.css'

type FieldShared = { label: string; hint?: string; error?: string; prefix?: string }
export type FieldProps = FieldShared & (({ multiline?: false } & InputHTMLAttributes<HTMLInputElement>) | ({ multiline: true } & TextareaHTMLAttributes<HTMLTextAreaElement>))
export function Field(props: FieldProps) {
  const generated = useId()
  const { label, hint, error, prefix, id = generated, multiline, ...rest } = props
  const describedBy = [rest['aria-describedby'], hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  const shared = { id, className: `fv-field-control ${rest.className ?? ''}`, 'aria-invalid': error ? true as const : undefined, 'aria-describedby': describedBy }
  return <div className="fv-field"><label htmlFor={id}>{label}</label>{multiline ? <textarea {...rest as TextareaHTMLAttributes<HTMLTextAreaElement>} {...shared}/> : prefix ? <span className="fv-field__wrap"><span className="fv-field__prefix" aria-hidden="true">{prefix}</span><input {...rest as InputHTMLAttributes<HTMLInputElement>} {...shared}/></span> : <input {...rest as InputHTMLAttributes<HTMLInputElement>} {...shared}/>}{hint && <span id={`${id}-hint`} className="fv-field__hint">{hint}</span>}{error && <span id={`${id}-error`} className="fv-field__error" role="alert">{error}</span>}</div>
}
export interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'prefix' | 'type'> {
  label: string; value: number; onChange: (value: number) => void; prefix?: '$'; error?: string
}
export function NumberField({ label, value, onChange, prefix, error, ...rest }: NumberFieldProps) {
  return <Field {...rest} label={label} prefix={prefix} type="number" inputMode="decimal" value={value} error={error} onChange={event => { if (Number.isFinite(event.currentTarget.valueAsNumber)) onChange(event.currentTarget.valueAsNumber) }}/>
}
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> { label: string; options: { value: string; label: string }[]; onChange: (value: string) => void }
export function Select({ label, options, onChange, id: passedId, ...rest }: SelectProps) {
  const generated = useId(), id = passedId ?? generated
  return <div className="fv-field"><label htmlFor={id}>{label}</label><div className="fv-select-wrap"><select {...rest} id={id} className="fv-field-control" onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><Icon name="arrow-right" compact/></div></div>
}
const POS_MAX = 1000
/** Money-friendly step that grows with magnitude: $5 under $100 ... $250 above $10k. */
export function niceStep(value: number): number {
  const v = Math.abs(value)
  return v < 100 ? 5 : v < 500 ? 10 : v < 1000 ? 25 : v < 2500 ? 50 : v < 10_000 ? 100 : 250
}
/** Round to the nearest nice step for its magnitude, then clamp to [min, max]. */
export function snapNice(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || value <= min) return min
  if (value >= max) return max
  const step = niceStep(value), snapped = Math.round(value / step) * step
  return Math.min(max, Math.max(min, snapped))
}
/** Log scale: position 0 is `min`; positions 1..1000 run from `floor` (or `min` when larger) up to `max` geometrically. */
export function logScale(min: number, max: number, floor = 10) {
  const lo = Math.max(min, floor), ratio = Math.max(max / lo, 1.000001)
  const toValue = (pos: number) => pos <= 0 ? min : lo * Math.pow(ratio, (Math.min(pos, POS_MAX) - 1) / (POS_MAX - 1))
  const toPos = (value: number) => value <= min || value < lo ? 0 : Math.round(1 + (POS_MAX - 1) * Math.log(Math.min(value, max) / lo) / Math.log(ratio))
  return { lo, toValue, toPos, decades: [10, 100, 1000, 10_000, 100_000].filter(tick => tick >= lo && tick <= max) }
}
/** One keyboard step in log mode: a nice step up or down from `value`, times `count`, clamped. */
export function stepNice(value: number, direction: 1 | -1, count: number, min: number, max: number): number {
  let next = value
  for (let i = 0; i < count; i++) next = direction > 0 ? next + niceStep(next) : next - niceStep(next - 1e-9)
  return snapNice(next, min, max)
}
const compactMoney = (value: number) => value >= 1000 ? `$${value / 1000}k` : `$${value}`
export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max' | 'step' | 'type'> {
  label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number; format?: (value: number) => string; error?: string
  /** `log` spreads a wide money range so small amounts are reachable; positions snap to nice steps. Default `linear`. */
  scale?: 'linear' | 'log'
  /** First non-zero stop in log mode when `min` is 0. Default $10. */
  floor?: number
  /** Keep the label for assistive tech only (when a neighbouring field already shows it). */
  labelHidden?: boolean
}
export function Slider({ label, value, onChange, min, max, step = 1, format = String, error, id: passedId, className = '', scale = 'linear', floor = 10, labelHidden, ...rest }: SliderProps) {
  const generated = useId(), id = passedId ?? generated
  const describedBy = [rest['aria-describedby'], error && `${id}-error`].filter(Boolean).join(' ') || undefined
  const log = scale === 'log', model = log ? logScale(min, max, floor) : undefined
  const safe = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min
  const pos = model ? model.toPos(safe) : safe
  const fraction = log ? pos / POS_MAX : max > min ? (safe - min) / (max - min) : 0
  const formatted = format(safe)
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    rest.onKeyDown?.(event)
    if (!log || event.defaultPrevented || rest.disabled) return
    const moves: Record<string, [1 | -1, number]> = { ArrowRight: [1, 1], ArrowUp: [1, 1], ArrowLeft: [-1, 1], ArrowDown: [-1, 1], PageUp: [1, 5], PageDown: [-1, 5] }
    const next = event.key === 'Home' ? min : event.key === 'End' ? max : moves[event.key] ? stepNice(safe, ...moves[event.key]!, min, max) : undefined
    if (next === undefined) return
    event.preventDefault(); if (next !== safe) onChange(next)
  }
  return <div className="fv-field"><label htmlFor={id}><span className={labelHidden ? 'fv-sr-only' : undefined}>{label}</span><output htmlFor={id}>{formatted}</output></label>
    <div className={`fv-slider-wrap ${log ? 'fv-slider-wrap--log' : ''}`.trim()}>
      <input aria-label={labelHidden ? label : undefined} {...rest} className={`fv-slider ${className}`.trim()} id={id} type="range" min={log ? 0 : min} max={log ? POS_MAX : max} step={log ? 1 : step} value={pos} aria-valuemin={min} aria-valuemax={max} aria-valuenow={safe} aria-invalid={rest['aria-invalid'] ?? (error ? true : undefined)} aria-describedby={describedBy} aria-valuetext={formatted} onKeyDown={onKeyDown} onChange={event => { const raw = event.currentTarget.valueAsNumber; onChange(model ? snapNice(model.toValue(raw), min, max) : raw) }}/>
      <span className="fv-slider__fill" aria-hidden="true" style={{ '--fv-fraction': fraction } as React.CSSProperties}/>
      {model && model.decades.length > 0 && <span className="fv-slider__ticks" aria-hidden="true">{model.decades.map(tick => <span key={tick} className="fv-slider__tick" style={{ '--fv-fraction': model.toPos(tick) / POS_MAX } as React.CSSProperties}>{compactMoney(tick)}</span>)}</span>}
    </div>
    {error && <span id={`${id}-error`} className="fv-field__error" role="alert">{error}</span>}</div>
}
export interface ToggleProps { label: string; checked: boolean; onChange: (checked: boolean) => void }
export function Toggle({ label, checked, onChange }: ToggleProps) { return <button className="fv-toggle" type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}><span className="fv-toggle__sprite" aria-hidden="true"/>{label}</button> }
