import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGameStore } from '../stores/useGameStore'

export interface GameClockOptions {
  enabled?: boolean
  intervalMs?: number
  blocked?: boolean
}

/** Default auto-advance pace: one month every 15 s (the Options window offers 15/30/60/120 s or off). */
export const DEFAULT_AUTO_ADVANCE_MS = 15_000

const documentHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

/**
 * UI clock only: all financial work still runs through advanceOneMonth().
 * One one-second interval owns the countdown and is always disposed on rerender/unmount. The countdown holds
 * (keeping its remaining seconds) while `blocked` (a window, menu or pending decision) or while the tab is hidden.
 */
export function useGameClock({ enabled = true, intervalMs = DEFAULT_AUTO_ADVANCE_MS, blocked = false }: GameClockOptions = {}) {
  const status = useGameStore(s => s.game?.status)
  const monthIndex = useGameStore(s => s.game?.monthIndex)
  const advance = useGameStore(s => s.advanceOneMonth)
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(enabled)
  const [hidden, setHidden] = useState(documentHidden)
  const durationSeconds = useMemo(() => Math.max(1, Math.ceil(intervalMs / 1000)), [intervalMs])
  const [secondsRemaining, setSecondsRemaining] = useState(durationSeconds)
  const secondsRef = useRef(durationSeconds)

  const resetCountdown = useCallback(() => {
    secondsRef.current = durationSeconds
    setSecondsRemaining(durationSeconds)
  }, [durationSeconds])
  const advanceNow = useCallback(() => {
    if (status !== 'playing') return
    advance()
    resetCountdown()
  }, [advance, resetCountdown, status])

  useEffect(resetCountdown, [monthIndex, resetCountdown])
  useEffect(() => setAutoAdvanceEnabled(enabled), [enabled])
  useEffect(() => {
    const onVisibility = () => setHidden(documentHidden())
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])
  useEffect(() => {
    if (!autoAdvanceEnabled || blocked || hidden || status !== 'playing') return
    const timer = window.setInterval(() => {
      const next = secondsRef.current - 1
      if (next <= 0) {
        secondsRef.current = durationSeconds
        setSecondsRemaining(durationSeconds)
        advance()
      } else {
        secondsRef.current = next
        setSecondsRemaining(next)
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [advance, autoAdvanceEnabled, blocked, durationSeconds, hidden, status])

  return { secondsRemaining, resetCountdown, advanceNow, autoAdvanceEnabled, setAutoAdvanceEnabled, blocked }
}
