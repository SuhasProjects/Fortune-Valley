/** Shared glue for the title and ending screens: the stage wrapper, scale, click sound, reduced-motion flag
 * and the Options dialog. UI materials come straight from the kit in `src/ui`; no financial math lives here.
 */
import type { ReactNode } from 'react'
import { Modal } from '@/ui'
import { sfx } from '@/game/audio/sfx'
import { GameStage, useStageScale } from '@/game/stage/GameStage'
import { OptionsWindow } from '@/game/settings/OptionsWindow'
import './title.css'

export function clickSound() { sfx('click') }

export function useTitleScale() {
  return useStageScale().px
}

export function TitleStage(props: { world: ReactNode; label: string; children?: ReactNode }) {
  return <main className="fv-owned" aria-label={props.label}><GameStage {...props}/></main>
}

const SETTINGS_KEY = 'fortune-valley-settings-v2'
export function readReduceMotion() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').reduceMotion === true } catch { return false }
}

export function TitleOptions({ onClose, onMotionChange }: { onClose: () => void; onMotionChange: () => void }) {
  const close = () => { onMotionChange(); onClose() }
  return <Modal title="Options" onClose={close}>
    <div className="fv-title-options"><OptionsWindow onClose={close}/></div>
  </Modal>
}
