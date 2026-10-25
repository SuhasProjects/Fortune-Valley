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
export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max' | 'step' | 'type'> {
  label: string; value: number; onChange: (value: number) => void; min: number; max: number; step: number; format?: (value: number) => string; error?: string
}
export function Slider({ label, value, onChange, min, max, step, format = String, error, id: passedId, className = '', ...rest }: SliderProps) {
  const generated = useId(), id = passedId ?? generated
  const describedBy = [rest['aria-describedby'], error && `${id}-error`].filter(Boolean).join(' ') || undefined
  const formatted = format(value)
  return <div className="fv-field"><label htmlFor={id}><span>{label}</span><output htmlFor={id}>{formatted}</output></label><input {...rest} className={`fv-slider ${className}`.trim()} id={id} type="range" min={min} max={max} step={step} value={value} aria-invalid={rest['aria-invalid'] ?? (error ? true : undefined)} aria-describedby={describedBy} aria-valuetext={formatted} onChange={event => onChange(event.currentTarget.valueAsNumber)}/>{error && <span id={`${id}-error`} className="fv-field__error" role="alert">{error}</span>}</div>
}
export interface ToggleProps { label: string; checked: boolean; onChange: (checked: boolean) => void }
export function Toggle({ label, checked, onChange }: ToggleProps) { return <button className="fv-toggle" type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}><span className="fv-toggle__sprite" aria-hidden="true"/>{label}</button> }
