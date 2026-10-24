import { useEffect } from 'react'
import { useGameStore } from '../stores/useGameStore'

export function useGameClock(enabled: boolean, intervalMs = 1800) {
  const status = useGameStore(s => s.game?.status)
  const advance = useGameStore(s => s.advanceOneMonth)
  useEffect(() => {
    if (!enabled || status !== 'playing') return
    const timer = window.setInterval(advance, Math.max(500, intervalMs))
    return () => window.clearInterval(timer)
  }, [enabled, status, intervalMs, advance])
}
