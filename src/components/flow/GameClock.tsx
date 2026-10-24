export function GameClock({ status, onAdvance, onPause, onFinish, secondsRemaining, autoAdvanceEnabled, blocked, onToggleAuto }: { status: 'setup'|'playing'|'paused'|'finished'; onAdvance: () => void; onPause: (paused: boolean) => void; onFinish: () => void; secondsRemaining?: number; autoAdvanceEnabled?: boolean; blocked?: boolean; onToggleAuto?: () => void }) {
  const countdown = secondsRemaining === undefined ? null : `${Math.floor(secondsRemaining / 60).toString().padStart(2, '0')}:${(secondsRemaining % 60).toString().padStart(2, '0')}`
  return <div className="clock-controls" aria-label="Time controls">
    {countdown && <div className="month-countdown" role="timer" aria-live="off"><span>{blocked ? 'Decision waiting' : autoAdvanceEnabled ? 'Next month in' : 'Auto-time off'}</span><strong>{countdown}</strong></div>}
    {onToggleAuto && <button className="text-button auto-time-toggle" onClick={onToggleAuto} disabled={status === 'finished'} aria-pressed={autoAdvanceEnabled}>{autoAdvanceEnabled ? 'Auto on' : 'Auto off'}</button>}
    <button className="pixel-button" onClick={() => onPause(status === 'playing')} disabled={status === 'finished'}>{status === 'paused' ? '▶ Resume' : 'Ⅱ Pause'}</button>
    <button className="pixel-button pixel-button--gold" onClick={onAdvance} disabled={status !== 'playing'}>Next month →</button>
    <button className="text-button" onClick={onFinish} disabled={status === 'finished'}>Finish &amp; reveal</button>
  </div>
}
