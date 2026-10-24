import { useGameStore } from '../../stores/useGameStore'
import { Tag, useReducedMotion } from '../../ui'
import './hud.css'
export function StatusTag() {
  const status = useGameStore(state => state.game?.status)
  const aiStatus = useGameStore(state => state.aiStatus)
  const reduced = useReducedMotion()
  const text = status === 'paused' ? 'PAUSED' : status === 'finished' ? 'STORY COMPLETE' : aiStatus === 'loading' ? 'PREPARING OPPORTUNITY' : aiStatus === 'online' ? 'AI CONNECTED' : 'OFFLINE READY'
  return <div className="fv-status-tag" role="status" data-reduce-motion={reduced || undefined}><Tag>{aiStatus === 'loading' && <span className="fv-status-dot" aria-hidden="true"/>}{text}</Tag></div>
}
