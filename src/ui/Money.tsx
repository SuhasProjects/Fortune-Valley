import { usd } from '../components/flow/format'
import './Money.css'
export function Money({ value, signed = false, tone = 'auto' }: { value: number; signed?: boolean; tone?: 'auto' | 'neutral' }) {
  const color = tone === 'neutral' ? 'neutral' : value < 0 ? 'negative' : signed && value > 0 ? 'positive' : 'neutral'
  return <span className={`fv-money fv-money--${color}`}>{usd(value, signed)}</span>
}
