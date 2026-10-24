import type { ReactNode } from 'react'
import { GameClock } from '../flow'
import { useGameClock } from '../../hooks/useGameClock'
import { useGameStore } from '../../stores/useGameStore'

export function FullscreenGameView({ hud, scene, status, children }: { hud: ReactNode; scene: ReactNode; status: ReactNode; children?: ReactNode }) {
  const game = useGameStore(state => state.game)
  const activeEvents = useGameStore(state => state.game?.activeEvents ?? [])
  const setPaused = useGameStore(state => state.setPaused)
  const finishGame = useGameStore(state => state.finishGame)
  const clock = useGameClock({ intervalMs: 60_000, blocked: activeEvents.length > 0 })
  if (!game) return null

  return <section className="fullscreen-game-view" aria-label="Financial Town game">
    <div className="fullscreen-town-layer">{scene}</div>
    <div className="fullscreen-hud-layer">{hud}</div>
    <div className="fullscreen-status-layer">{status}</div>
    <div className="fullscreen-controls-layer">
      <GameClock status={game.status} onAdvance={clock.advanceNow} onPause={setPaused} onFinish={finishGame} secondsRemaining={clock.secondsRemaining} autoAdvanceEnabled={clock.autoAdvanceEnabled} blocked={clock.blocked} onToggleAuto={() => clock.setAutoAdvanceEnabled(value => !value)}/>
    </div>
    {children}
  </section>
}
