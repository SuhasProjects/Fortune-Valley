import { useEffect } from 'react'
import type { BuildingId } from '../../types/domain'

const keys: Record<string, BuildingId> = { '1': 'bank', '2': 'office', '3': 'hospital', '4': 'home', '5': 'market' }
const editing = (target: EventTarget | null) => target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)
/** Space and Enter on a focused button activate that button natively; the global pause shortcut must not fire too. */
const activatesControl = (target: EventTarget | null) => target instanceof HTMLElement && target.closest('button, a[href], [role="button"], [role="switch"], [role="tab"], summary') !== null

export interface ShortcutActions {
  pause: () => void
  advance: () => void
  openBuilding: (id: BuildingId) => void
  timeline: () => void
  activity: () => void
  escape: () => void
  guide: () => void
  modalOpen: boolean
}

/**
 * Global keys: Space pause/resume, N next month, 1–5 buildings, T timeline, A activity, ? guide, Esc close/pause menu.
 * Ignored while typing in a field; only Escape works while a window is open.
 */
export function useShortcuts(actions: ShortcutActions) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || editing(event.target)) return
      if (event.key === 'Escape') { event.preventDefault(); actions.escape(); return }
      if (actions.modalOpen) return
      const building = keys[event.key]
      if (building) { actions.openBuilding(building); return }
      if (event.key === ' ') { if (activatesControl(event.target)) return; event.preventDefault(); actions.pause() }
      else if (event.key.toLowerCase() === 'n') actions.advance()
      else if (event.key.toLowerCase() === 't') actions.timeline()
      else if (event.key.toLowerCase() === 'a') actions.activity()
      else if (event.key === '?') actions.guide()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions])
}
