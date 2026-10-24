/** Temporary bridges until the other agents' Phase 0 contracts are merged.
 * Each bridge uses the real shared component automatically when it becomes available.
 * No financial calculations or replacement UI materials belong here.
 */
import { useEffect, useState, type ButtonHTMLAttributes, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { PanelHost } from '@/components/town/PanelHost'
import './title.css'

type StageProps = { world: ReactNode; label: string; children?: ReactNode }
type ModalProps = { title: string; onClose: () => void; children: ReactNode; width?: 'sm' | 'md' | 'lg' }
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'lg'; primary?: boolean; variant?: 'wood' | 'primary' | 'ghost' | 'text' }
const stages = import.meta.glob<{ GameStage: ComponentType<StageProps> }>('/src/game/stage/GameStage.tsx', { eager: true })
const kits = import.meta.glob<{ Button: ComponentType<ButtonProps>; Board: ComponentType<{ children?: ReactNode; className?: string }>; Modal: ComponentType<ModalProps> }>('/src/ui/index.ts', { eager: true })
const audio = import.meta.glob<{ sfx: (name: 'click') => void }>('/src/game/audio/sfx.ts', { eager: true })
const settings = import.meta.glob<{ OptionsWindow: ComponentType<{ onClose: () => void }> }>('/src/game/settings/OptionsWindow.tsx', { eager: true })
const SharedStage = Object.values(stages)[0]?.GameStage
const kit = Object.values(kits)[0]

export function clickSound() { Object.values(audio)[0]?.sfx('click') }

export function useTitleScale() {
  const measure = () => typeof window === 'undefined' ? 4 : Math.max(2, Math.floor(Math.min(window.innerWidth / 320, window.innerHeight / 180)))
  const [px, setPx] = useState(measure)
  useEffect(() => {
    const resize = () => setPx(measure())
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  return px
}

export function TitleStage(props: StageProps) {
  const px = useTitleScale()
  if (SharedStage) return <div className="fv-owned"><SharedStage {...props}/></div>
  return <main className="fv-owned fv-title-stage" aria-label={props.label} style={{ '--px': `${px}px` } as CSSProperties}>
    <div className="fv-title-world">{props.world}</div><div className="fv-title-ui">{props.children}</div>
  </main>
}

export function MenuButton({ size, primary, className = '', ...props }: ButtonProps) {
  if (kit?.Button) return <kit.Button {...props} size={size} variant={primary ? 'primary' : 'wood'} className={className}/>
  return <button type="button" {...props} className={`pixel-button ${primary ? 'pixel-button--gold' : ''} ${className}`}/>
}

export function Ledger({ children, className = '' }: { children: ReactNode; className?: string }) {
  if (kit?.Board) return <kit.Board className={className}>{children}</kit.Board>
  return <section className={`pixel-panel ${className}`}>{children}</section>
}

export function TitleModal(props: ModalProps) {
  return <div className="fv-owned fv-title-modal">{kit?.Modal ? <kit.Modal {...props}/> : <PanelHost title={props.title} onClose={props.onClose}>{props.children}</PanelHost>}</div>
}

const SETTINGS_KEY = 'fortune-valley-settings-v1'
export function readReduceMotion() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').reduceMotion === true } catch { return false }
}

export function TitleOptions({ onClose, onMotionChange }: { onClose: () => void; onMotionChange: () => void }) {
  const [reduce, setReduce] = useState(readReduceMotion)
  const SharedOptions = Object.values(settings)[0]?.OptionsWindow
  if (SharedOptions) return <SharedOptions onClose={() => { onMotionChange(); onClose() }}/>
  return <TitleModal title="Options" onClose={onClose}>
    <label><input type="checkbox" checked={reduce} onChange={event => {
      const value = event.target.checked
      setReduce(value)
      try {
        const previous = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...previous, reduceMotion: value }))
      } catch { /* Motion still changes when storage is unavailable. */ }
      onMotionChange()
    }}/> Reduce motion</label><p>Freeze the valley, vines, and chart animations.</p>
  </TitleModal>
}
