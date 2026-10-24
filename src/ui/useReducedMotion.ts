import { useSyncExternalStore } from 'react'
import { useSettings } from '../game/settings/useSettings'

// The host override also lets isolated previews request less motion.
let reduceMotion = false
const listeners = new Set<() => void>()
export function setUiReducedMotion(value: boolean) {
  reduceMotion = value
  listeners.forEach(listener => listener())
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  media?.addEventListener('change', listener)
  return () => { listeners.delete(listener); media?.removeEventListener('change', listener) }
}
export function useReducedMotion() {
  const settings = useSettings()
  const reduced = useSyncExternalStore(subscribe, () => reduceMotion || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, () => true)
  return settings.reduceMotion || reduced
}
