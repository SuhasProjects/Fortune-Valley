import { useEffect, useState, type ReactNode } from 'react'
import { useGameStore } from '../../stores/useGameStore'
import { WorldBackdrop } from './PixelArt'
import '../../styles/game-viewport.css'

export function FullscreenGameView({ children, topBar, toasts }: { children: ReactNode; topBar?: ReactNode; toasts?: ReactNode }) {
  const [activityOpen, setActivityOpen] = useState(false)
  const notifications = useGameStore(state => state.game?.notifications ?? [])
  const unread = notifications.filter(notification => !notification.read).length
  const openHistory = useGameStore(state => state.setHistoryOpen)
  useEffect(() => {
    document.body.classList.add('fullscreen-game-active')
    return () => { document.body.classList.remove('fullscreen-game-active') }
  }, [])
  return <main className="fullscreen-game">
    <WorldBackdrop/>
    <a className="skip-link" href="#town-main">Skip to town</a>
    <div className="viewport-stage" id="town-main" tabIndex={-1}>{children}</div>
    <div className="viewport-hud">{topBar}</div>
    <aside className="viewport-activity" aria-label="Activity controls">
      <div className="activity-toggles"><button className="pixel-button" aria-expanded={activityOpen} aria-controls="recent-activity" onClick={() => setActivityOpen(open => !open)}>{activityOpen ? 'Hide recent activity' : `Recent activity (${unread})`}</button><button className="pixel-button" onClick={() => openHistory(true)}>View all activity</button></div>
      <div className="activity-popover" id="recent-activity" hidden={!activityOpen}>{toasts}{!notifications.length && <p className="pixel-panel">Your activity will appear after the first month.</p>}</div>
    </aside>
    <footer className="viewport-disclaimer">Fictional educational simulation · Assumptions are illustrative · USD</footer>
  </main>
}
