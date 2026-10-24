import { useEffect, useSyncExternalStore } from 'react'

// Until Agent 4's useSettings lands, accept its persisted setting through this
// small bridge. The host can also set data-reduce-motion on the stage for CSS.
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
  return useSyncExternalStore(subscribe, () => reduceMotion || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, () => true)
}
export function useMotionAttribute(ref: React.RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion()
  useEffect(() => { ref.current?.toggleAttribute('data-reduce-motion', reduced) }, [ref, reduced])
}
