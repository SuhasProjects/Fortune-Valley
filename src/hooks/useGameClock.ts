import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGameStore } from '../stores/useGameStore'

export interface GameClockOptions {
  enabled?: boolean
  intervalMs?: number
  blocked?: boolean
}

/**
 * UI clock only: all financial work still runs through advanceOneMonth().
 * One one-second interval owns the countdown and is always disposed on rerender/unmount.
 */
export function useGameClock({ enabled = true, intervalMs = 60_000, blocked = false }: GameClockOptions = {}) {
  const status = useGameStore(s => s.game?.status)
  const monthIndex = useGameStore(s => s.game?.monthIndex)
  const advance = useGameStore(s => s.advanceOneMonth)
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(enabled)
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
  useEffect(() => {
    if (!autoAdvanceEnabled || blocked || status !== 'playing') return
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
  }, [advance, autoAdvanceEnabled, blocked, durationSeconds, status])

  return { secondsRemaining, resetCountdown, advanceNow, autoAdvanceEnabled, setAutoAdvanceEnabled, blocked }
}
