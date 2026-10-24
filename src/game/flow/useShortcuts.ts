import { useEffect } from 'react'
import type { BuildingId } from '../../types/domain'

const keys: Record<string, BuildingId> = { '1': 'bank', '2': 'office', '3': 'hospital', '4': 'home', '5': 'market' }
const editing = (target: EventTarget | null) => target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)

export function useShortcuts(actions: { pause: () => void; advance: () => void; openBuilding: (id: BuildingId) => void; timeline: () => void; activity: () => void; escape: () => void; guide: () => void; modalOpen: boolean }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (editing(event.target)) return
      if (event.key === 'Escape') { event.preventDefault(); actions.escape(); return }
      if (actions.modalOpen) return
      const building = keys[event.key]
      if (building) { actions.openBuilding(building); return }
      if (event.key === ' ') { event.preventDefault(); actions.pause() }
      else if (event.key.toLowerCase() === 'n') actions.advance()
      else if (event.key.toLowerCase() === 't') actions.timeline()
      else if (event.key.toLowerCase() === 'a') actions.activity()
      else if (event.key === '?') actions.guide()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions])
}
