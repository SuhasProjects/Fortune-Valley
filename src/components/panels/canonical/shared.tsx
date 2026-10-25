import { Field, Tag } from '../../../ui';
import { useEffect, useId, useRef, useState } from 'react';
import type { GameAction, GameState, LedgerCategory } from '../../../types/domain';
import { monthLabel } from '../../../engine';
import type { PanelDispatch } from '../panelTypes';

export const money = (value: number) => Number.isFinite(value) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value) : 'Unavailable';
export const percent = (value: number) => Number.isFinite(value) ? new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(value) : 'Unavailable';
export const editable = (state: GameState) => state.status === 'playing' || state.status === 'paused';

export function amountError(raw: string, min: number, max: number, step = .01): string | undefined {
  const value = Number(raw);
  if (!raw.trim() || !Number.isFinite(value)) return 'Enter a valid USD amount.';
  if (value < min || value > max) return `Enter ${money(min)} to ${money(max)}.`;
  const steps = (value - min) / step;
  if (Math.abs(steps - Math.round(steps)) > .000001) return `Use increments of ${money(step)}.`;
}
export function useDraft(saved: number) {
  const [raw, setRaw] = useState(String(saved));
  useEffect(() => setRaw(String(saved)), [saved]);
  return [raw, setRaw] as const;
}
export function useAction(dispatch: PanelDispatch) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string }>();
  const locked = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!message || message.error) return;
    const timer = setTimeout(() => setMessage(undefined), 2000);
    return () => clearTimeout(timer);
  }, [message]);
  async function send(action: GameAction) {
    if (locked.current) return false;
    locked.current = true; setPending(true); setMessage(undefined);
    try {
      const result = await dispatch(action);
      if (mounted.current) setMessage(result?.ok ? { error: false, text: 'Saved.' } : { error: true, text: result && !result.ok ? result.message : "Couldn't save. Try again." });
      return result?.ok === true;
    } catch {
      if (mounted.current) setMessage({ error: true, text: "Couldn't save. Try again." });
      return false;
    } finally { locked.current = false; if (mounted.current) setPending(false); }
  }
  return { pending, send, feedback: <div aria-live="polite">{pending ? 'Saving…' : message && <p role={message.error ? 'alert' : 'status'}>{message.error ? <span className="fv-field__error">{message.text}</span> : <Tag tone="green">{message.text}</Tag>}</p>}</div> };
}

/** Accessible amount input; all limits come from the canonical state/config. */
export function MoneyInput({ label, raw, onChange, min = 0, max, step = .01, disabled = false }: {
  label: string; raw: string; onChange: (value: string) => void; min?: number; max: number; step?: number; disabled?: boolean;
}) {
  const id = useId(); const [touched, setTouched] = useState(false);
  useEffect(() => { if (!raw) setTouched(false); }, [raw]);
  const error = amountError(raw, min, max, step);
  return <div className="ft-money-field"><Field label={label} prefix="$" id={id} aria-label={`${label} (USD)`} type="number" inputMode="decimal" value={raw} min={min} max={max} step={step} disabled={disabled} onChange={event => { onChange(event.target.value); setTouched(true); }} onBlur={() => setTouched(true)} error={touched ? error : undefined} /></div>;
}

export function LedgerHistory({ state, categories }: { state: GameState; categories: LedgerCategory[] }) {
  const rows = [...state.ledger].reverse().filter(row => categories.includes(row.category)).slice(0, 12);
  return rows.length ? <ul>{rows.map(row => <li key={row.id}>{monthLabel(state.startMonth, row.monthIndex)} · {row.account} · {row.description}: {money(row.amountSigned)}</li>)}</ul> : <p>No recorded activity yet.</p>;
}
