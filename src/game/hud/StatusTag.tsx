import { useGameStore } from '../../stores/useGameStore'
import { Tag, useReducedMotion } from '../../ui'
import { isDemoMode } from '../../demo/demoMode'
import './hud.css'
export function StatusTag() {
  const status = useGameStore(state => state.game?.status)
  const aiStatus = useGameStore(state => state.aiStatus)
  const reduced = useReducedMotion()
  // The /demo route keeps the Sage and offers offline on purpose; its tag still reads as a ready assistant.
  const demo = isDemoMode() && status !== 'paused' && status !== 'finished'
  const text = demo ? 'AI READY' : status === 'paused' ? 'PAUSED' : status === 'finished' ? 'STORY COMPLETE' : aiStatus === 'loading' ? 'PREPARING OPPORTUNITY' : aiStatus === 'online' ? 'AI CONNECTED' : 'OFFLINE READY'
  return <div className="fv-status-tag" role="status" data-reduce-motion={reduced || undefined}><Tag tone={demo ? 'green' : undefined}>{aiStatus === 'loading' && <span className="fv-status-dot" aria-hidden="true"/>}{text}</Tag></div>
}
