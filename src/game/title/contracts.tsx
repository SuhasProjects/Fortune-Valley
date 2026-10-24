/** Temporary bridges until the other agents' Phase 0 contracts are merged.
 * Each bridge uses the real shared component automatically when it becomes available.
 * No financial calculations or replacement UI materials belong here.
 */
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from 'react'
import { PanelHost } from '@/components/town/PanelHost'
import { sfx } from '@/game/audio/sfx'
import { GameStage, useStageScale } from '@/game/stage/GameStage'
import { OptionsWindow } from '@/game/settings/OptionsWindow'
import './title.css'

type StageProps = { world: ReactNode; label: string; children?: ReactNode }
type ModalProps = { title: string; onClose: () => void; children: ReactNode; width?: 'sm' | 'md' | 'lg' }
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'lg'; primary?: boolean; variant?: 'wood' | 'primary' | 'ghost' | 'text' }
const kits = import.meta.glob<{ Button: ComponentType<ButtonProps>; Board: ComponentType<{ children?: ReactNode; className?: string }>; Modal: ComponentType<ModalProps> }>('/src/ui/index.ts', { eager: true })
const kit = Object.values(kits)[0]

export function clickSound() { sfx('click') }

export function useTitleScale() {
  return useStageScale().px
}

export function TitleStage(props: StageProps) {
  return <main className="fv-owned" aria-label={props.label}><GameStage {...props}/></main>
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
  const close = () => { onMotionChange(); onClose() }
  return <TitleModal title="Options" onClose={close}>
    <OptionsWindow onClose={close}/>
  </TitleModal>
}
