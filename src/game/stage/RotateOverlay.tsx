import { useEffect, useState, type ReactNode } from 'react'
import './rotate.css'

/**
 * Phones and small tablets held upright. `pointer: coarse` keeps tall desktop browser windows out (they just get the
 * stage's tall-window layout, see scale.ts); the `max-device-width` list item is the fallback for touch browsers that
 * do not report a coarse pointer. Tablets 900 CSS px and wider keep working in portrait.
 */
export const PORTRAIT_PHONE = '(max-width: 899px) and (orientation: portrait) and (pointer: coarse), (max-device-width: 899px) and (orientation: portrait) and (hover: none)'

function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null
  const [matches, setMatches] = useState(() => get()?.matches ?? false)
  useEffect(() => {
    const mq = get()
    if (!mq) return
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return matches
}

/**
 * Wraps the app: on a phone held upright the game stays mounted (state, clock and save untouched) but is made inert
 * and hidden from assistive tech, and a full-screen parchment notice asks for landscape. Everything else renders as is.
 */
export function RotateGuard({ children }: { children: ReactNode }) {
  const portrait = useMediaQuery(PORTRAIT_PHONE)
  return <>
    <div className="fv-rotate-guard" inert={portrait || undefined} aria-hidden={portrait || undefined}>{children}</div>
    {portrait && <RotateOverlay/>}
  </>
}

/** The notice itself: a hanging-sign heading, a phone that turns in four steps, one line of copy. */
export function RotateOverlay() {
  return <div className="fv-rotate fv-owned" role="dialog" aria-modal="true" aria-live="polite" aria-labelledby="fv-rotate-title" aria-describedby="fv-rotate-copy" data-testid="rotate-overlay">
    <div className="fv-rotate__phone" aria-hidden="true"><span/></div>
    <div className="fv-sign fv-sign--small fv-rotate__sign"><h1 id="fv-rotate-title">Turn your phone sideways</h1></div>
    <p id="fv-rotate-copy">Fortune Valley plays in landscape. Your town is waiting right where you left it.</p>
  </div>
}
