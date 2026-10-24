import type { CSSProperties } from 'react'
import './Icon.css'

export const iconNames = ['coin', 'calendar', 'leaf', 'ledger', 'purse', 'clock', 'pause', 'play', 'arrow-right', 'arrow-up-right', 'close', 'question', 'gear', 'book', 'scroll', 'bell', 'check', 'warning', 'sound-on', 'sound-off', 'save', 'home', 'cross', 'briefcase', 'bank', 'basket', 'quill', 'star'] as const
export type IconName = typeof iconNames[number]
export interface IconProps { name: IconName; size?: 10 | 16; label?: string; compact?: boolean }
export function Icon({ name, size = 10, label, compact = false }: IconProps) {
  const pixels = compact ? 6 : size
  return <img className="fv-icon" src={`/art/ui/icons/${name}${compact ? '-small' : size === 16 ? '-16' : ''}.png`} width={pixels} height={pixels} style={{ '--icon-size': pixels } as CSSProperties} alt={label ?? ''} aria-hidden={label ? undefined : true} draggable={false} />
}
