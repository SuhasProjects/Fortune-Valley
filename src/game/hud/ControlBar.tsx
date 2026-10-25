import type { GameStatus } from '../../types/domain'
import { Board, Button, Divider } from '../../ui'
import './hud.css'
export interface ControlBarProps {
  status: GameStatus; onAdvance: () => void; onPause: (paused: boolean) => void; onFinish: () => void
  secondsRemaining?: number; autoAdvanceEnabled?: boolean; blocked?: boolean; onToggleAuto?: () => void
}
export function ControlBar({ status, onAdvance, onPause, onFinish, secondsRemaining, autoAdvanceEnabled, blocked, onToggleAuto }: ControlBarProps) {
  const seconds = Math.max(0, Math.floor(secondsRemaining ?? 0))
  const countdown = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  return <Board padding="sm" className="fv-control-bar" role="group" aria-label="Time controls">{secondsRemaining !== undefined && <><div className="fv-countdown" role="timer" aria-live="off"><span>{blocked ? 'Decision waiting' : autoAdvanceEnabled ? 'Next month in' : 'Auto-time off'}</span><strong>{countdown}</strong></div><Divider vertical dashed/></>}{onToggleAuto && <Button variant="ghost" size="sm" aria-pressed={!!autoAdvanceEnabled} disabled={status === 'finished'} onClick={onToggleAuto}>{autoAdvanceEnabled ? 'Auto on' : 'Auto off'}</Button>}<Button size="sm" className="fv-pause-button" aria-label={status === 'paused' ? 'Resume (Space)' : 'Pause (Space)'} title={status === 'paused' ? 'Resume · Space' : 'Pause · Space'} disabled={status === 'finished'} onClick={() => onPause(status === 'playing')}><span className={`fv-glyph fv-glyph--${status === 'paused' ? 'play' : 'pause'}`} aria-hidden="true"/>{status === 'paused' ? 'Resume' : 'Pause'}</Button><Button size="sm" variant="primary" title="N = next month" disabled={status !== 'playing'} onClick={onAdvance}>Next month →</Button><Button size="sm" variant="text" onClick={onFinish} disabled={status === 'finished'}>Finish &amp; reveal</Button></Board>
}
