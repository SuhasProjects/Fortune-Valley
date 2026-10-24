import { useGameClock } from '../../hooks/useGameClock'
import { useGameStore } from '../../stores/useGameStore'

export function GameTimeControls() {
  const status = useGameStore(state => state.game?.status)
  const setPaused = useGameStore(state => state.setPaused)
  const finish = useGameStore(state => state.finishGame)
  const { secondsRemaining, blocked, advanceManually } = useGameClock()
  const finished = status === 'finished'
  return <div className="viewport-clock">
    <div className="countdown" role="timer" aria-label="Automatic month countdown">
      <strong>{finished ? 'Story complete' : `Next month in ${secondsRemaining}s`}</strong>
      <span>{finished ? 'Review your results when ready' : status === 'paused' ? 'Paused' : blocked ? 'On hold: review the marked event' : 'One month every 60 seconds'}</span>
    </div>
    <div className="clock-controls" aria-label="Time controls">
      <button className="pixel-button" onClick={() => setPaused(status === 'playing')} disabled={finished}>{status === 'paused' ? 'Resume' : 'Pause'}</button>
      <button className="pixel-button pixel-button--gold" onClick={advanceManually} disabled={status !== 'playing'}>Next month →</button>
      <button className="text-button" onClick={finish}>{finished ? 'Review your story →' : 'Finish & reveal'}</button>
    </div>
  </div>
}
