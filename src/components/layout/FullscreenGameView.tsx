import type { ReactNode } from 'react'
import { GameClock } from '../flow'
import { useGameClock } from '../../hooks/useGameClock'
import { useGameStore } from '../../stores/useGameStore'
import { setSetting, useSettings } from '../../game/settings'

export function FullscreenGameView({ hud, status, blocked = false, onFinish, children }: { hud: ReactNode; status: ReactNode; blocked?: boolean; onFinish?: () => void; children?: ReactNode }) {
  const game = useGameStore(state => state.game)
  const activeEvents = useGameStore(state => state.game?.activeEvents ?? [])
  const setPaused = useGameStore(state => state.setPaused)
  const finishGame = useGameStore(state => state.finishGame)
  const settings = useSettings()
  const clock = useGameClock({ enabled: settings.autoAdvanceSeconds > 0, intervalMs: Math.max(1, settings.autoAdvanceSeconds) * 1_000, blocked: activeEvents.length > 0 || blocked })
  if (!game) return null

  return <section id="town-main" className="fullscreen-game-view" aria-label="Financial Town game">
    <div className="fullscreen-hud-layer">{hud}</div>
    <div className="fullscreen-status-layer">{status}</div>
    <div className="fullscreen-controls-layer">
      <GameClock status={game.status} onAdvance={clock.advanceNow} onPause={setPaused} onFinish={onFinish ?? finishGame} secondsRemaining={clock.secondsRemaining} autoAdvanceEnabled={clock.autoAdvanceEnabled} blocked={activeEvents.length > 0} onToggleAuto={() => setSetting('autoAdvanceSeconds', settings.autoAdvanceSeconds ? 0 : settings.lastAutoAdvanceSeconds)}/>
    </div>
    {children}
  </section>
}
