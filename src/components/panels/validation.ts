import type { MoneyField } from './contracts';
export function parseAmount(raw: string, field: MoneyField): { value: number; error?: never } | { error: string; value?: never } {
  const value = Number(raw);
  if (!raw.trim() || !Number.isFinite(value)) return { error: 'Enter a valid amount.' };
  if (value < field.min || value > field.max) return { error: `Enter an amount from ${field.min} to ${field.max} USD.` };
  const steps = (value - field.min) / field.step;
  if (!(field.step > 0) || Math.abs(steps - Math.round(steps)) > 0.000001) return { error: `Use increments of ${field.step} USD.` };
  return { value };
}
export function validWeights(weights: string[]): boolean {
  const values = weights.map(Number);
  return weights.every(w => w.trim() !== '') && values.every(v => Number.isFinite(v) && v >= 0 && v <= 100) && Math.abs(values.reduce((a, b) => a + b, 0) - 100) < 0.000001;
}
