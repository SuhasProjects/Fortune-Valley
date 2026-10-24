import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react'
import './Surfaces.css'

export interface BoardProps extends HTMLAttributes<HTMLElement> { as?: ElementType; padding?: 'sm' | 'md' | 'lg'; children: ReactNode }
export function Board({ as: Component = 'div', padding = 'md', className = '', children, ...rest }: BoardProps) {
  return <Component className={`fv-board fv-board--${padding} ${className}`} {...rest}>{children}</Component>
}
export function WoodFrame({ children, className = '' }: { children: ReactNode; className?: string }) { return <div className={`fv-wood-frame ${className}`}>{children}</div> }
export function Plaque({ children, tone = 'parchment' }: { children: ReactNode; tone?: 'parchment' | 'wood' }) { return <span className={`fv-plaque fv-plaque--${tone}`}>{children}</span> }
export function Tag({ children, tone = 'dark' }: { children: ReactNode; tone?: 'dark' | 'gold' | 'red' | 'green' }) { return <span className={`fv-tag fv-tag--${tone}`}>{children}</span> }
export function Inset({ children, title }: { children: ReactNode; title?: string }) { return <section className="fv-inset">{title && <h3>{title}</h3>}{children}</section> }
export function Divider({ vertical = false, dashed = false }: { vertical?: boolean; dashed?: boolean }) { return <span aria-hidden="true" className={`fv-divider ${vertical ? 'fv-divider--vertical' : ''} ${dashed ? 'fv-divider--dashed' : ''}`}/> }
export function ScrollArea({ children, maxHeight }: { children: ReactNode; maxHeight?: CSSProperties['maxHeight'] }) { return <div className="fv-scroll-area" style={{ maxHeight }}>{children}</div> }
