import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../stores/useGameStore'

/** One mounted owner per active viewport. Time is wall-clock based, not tick-count based. */
export function useGameClock(enabled = true, intervalMs = 60_000) {
  const duration = Math.max(1000, intervalMs)
  const status = useGameStore(state => state.game?.status)
  const month = useGameStore(state => state.game?.monthIndex)
  const eventCount = useGameStore(state => state.game?.activeEvents.length ?? 0)
  const remaining = useRef(duration)
  const previousTick = useRef(Date.now())
  const [remainingMs, setRemainingMs] = useState(duration)
  const blocked = eventCount > 0

  useEffect(() => {
    remaining.current = duration
    setRemainingMs(duration)
  }, [duration, month])

  useEffect(() => {
    if (!enabled || status !== 'playing' || blocked) return
    previousTick.current = Date.now()
    const timer = window.setInterval(() => {
      const now = Date.now()
      const elapsed = Math.max(0, now - previousTick.current)
      previousTick.current = now
      const live = useGameStore.getState()
      // The live check also covers events/status changes before React commits an effect.
      if (!live.game || live.game.status !== 'playing' || live.game.activeEvents.length) return
      remaining.current = Math.max(0, remaining.current - elapsed)
      if (remaining.current === 0) {
        // Reset before dispatch so a stalled/no-op callback cannot trigger repeated advances.
        remaining.current = duration
        live.advanceOneMonth()
      }
      setRemainingMs(remaining.current)
    }, 250)
    return () => window.clearInterval(timer)
  }, [enabled, status, blocked, duration])

  function advanceManually() {
    const live = useGameStore.getState()
    if (!live.game || live.game.status !== 'playing') return
    remaining.current = duration
    previousTick.current = Date.now()
    setRemainingMs(duration)
    live.advanceOneMonth()
  }

  return { secondsRemaining: Math.ceil(remainingMs / 1000), blocked, advanceManually }
}
