import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Building, HistoryRow, MoneyField, PanelCommand, PanelProps } from './contracts';
import { parseAmount } from './validation';
export const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
export const percent = (value: number) => new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(value);
export const optionalMoney = (value?: number) => value === undefined ? 'Not available yet' : money(value);
export function useCommand(onCommand: PanelProps['onCommand']) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string }>();
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function send(command: PanelCommand) {
    if (locked.current) return;
    locked.current = true; setPending(true); setFeedback(undefined);
    try {
      const result = await onCommand(command);
      if (mounted.current) setFeedback({ ok: result.ok, text: result.ok ? result.message || 'Change applied.' : result.error });
    } catch {
      if (mounted.current) setFeedback({ ok: false, text: 'The change could not be applied. Please try again.' });
    } finally { locked.current = false; if (mounted.current) setPending(false); }
  }
  return { pending, send, feedback: <div aria-live="polite" aria-atomic="true" className="ft-feedback">{pending ? 'Applying…' : feedback && <span role={feedback.ok ? 'status' : 'alert'}>{feedback.text}</span>}</div> };
}
export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="ft-stat"><dt>{label}</dt><dd>{value}</dd>{hint && <small>{hint}</small>}</div>;
}
export function Frame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <section className="ft-panel" aria-label={title}><header><span className="ft-kicker">Financial Town · Building ledger</span><h2>{title}</h2><p>{subtitle}</p></header>{children}<footer>Fictional educational simulation; assumptions are illustrative. All amounts in USD.</footer></section>;
}
export function AmountControl({ label, field, command, onCommand, disabled = false, note, action = 'Save monthly amount' }: { label: string; field: MoneyField; command: (value: number) => PanelCommand; onCommand: PanelProps['onCommand']; disabled?: boolean; note: string; action?: string }) {
  const [raw, setRaw] = useState(String(field.value));
  useEffect(() => setRaw(String(field.value)), [field.value]);
  const id = useId(); const parsed = parseAmount(raw, field); const task = useCommand(onCommand);
  disabled = disabled || !!field.unavailableReason;
  return <form className="ft-card" onSubmit={e => { e.preventDefault(); if (!disabled && !task.pending && !parsed.error) void task.send(command(parsed.value!)); }}>
    <label htmlFor={id}>{label}</label><p id={`${id}-note`} className="ft-muted">{note}</p>
    <div className="ft-input-row"><span aria-hidden="true">$</span><input id={id} type="number" min={field.min} max={field.max} step={field.step} value={raw} disabled={disabled || task.pending} onChange={e => setRaw(e.target.value)} aria-invalid={Boolean(parsed.error)} aria-describedby={`${id}-note ${id}-error`} /><button disabled={disabled || task.pending || !!parsed.error}>{action}</button></div>
    <p id={`${id}-error`} className="ft-error">{field.unavailableReason || parsed.error}</p>{task.feedback}
  </form>;
}
export function History({ rows, title = 'Recent activity' }: { rows?: HistoryRow[]; title?: string }) {
  return <details className="ft-card"><summary>{title}</summary>{rows?.length ? <ul className="ft-history">{rows.map(row => <li key={row.id}><div><small>{row.month}</small><span>{row.description}</span></div><strong>{money(row.amount)}</strong></li>)}</ul> : <p className="ft-muted">No recorded activity yet.</p>}</details>;
}
export function EventDecision({ building, model, onCommand }: PanelProps & { building: Building }) {
  const task = useCommand(onCommand); const event = model.event;
  if (!event || event.building !== building) return null;
  return <section className="ft-card ft-event" aria-label="Pending decision"><span className="ft-kicker">Opportunity · {event.source === 'fallback' ? 'Offline fallback' : event.source === 'ai' ? 'AI narrative' : 'Engine event'}</span><h3>{event.title}</h3><p>{event.body}</p><div className="ft-choices">{event.options.map(option => <div key={option.id}><button disabled={!model.editable || task.pending || !!option.disabledReason} onClick={() => void task.send({ kind: 'choose_event', eventId: event.id, optionId: option.id })}>{option.label}</button>{(option.description || option.disabledReason) && <small>{option.disabledReason || option.description}</small>}</div>)}</div>{task.feedback}</section>;
}
