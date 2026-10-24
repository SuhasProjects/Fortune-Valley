import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EventCard, monthLabel, usd } from '../components/flow'
import { selectDebtTotal, selectNetWorth, useGameStore } from '../stores/useGameStore'
import { PanelHost } from '../components/town/PanelHost'
import { FullscreenGameView } from '../components/layout/FullscreenGameView'
import type { BuildingId } from '../types/domain'
import { ConnectedBuildingPanel } from '../components/panels/ConnectedBuildingPanel'
import { PixelIcon } from '../components/layout/PixelArt'
import { ToastStack } from './flow/ToastStack'
import { useShortcuts } from './flow/useShortcuts'
import { OptionsWindow } from './settings'
import { sfx } from './audio/sfx'
import { GameStage } from './stage/GameStage'
import { TownWorld } from './world/TownWorld'

export function GameScreen({ panels = {} }: { panels?: Partial<Record<BuildingId, ReactNode>> }) {
  const store = useGameStore()
  const netWorth = useGameStore(selectNetWorth)
  const debt = useGameStore(selectDebtTotal)
  const [menu, setMenu] = useState<'pause' | 'options' | 'guide' | null>(null)
  const [finishConfirm, setFinishConfirm] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [monthBanner, setMonthBanner] = useState(false)
  const [saved, setSaved] = useState(false)
  const previousMonth = useRef<number | null>(null)
  const previousCash = useRef<number | null>(null)
  const previousTypeB = useRef(0)
  useEffect(() => {
    if (!store.lastActionError) return
    const timeout = window.setTimeout(store.clearActionError, 5_000)
    return () => window.clearTimeout(timeout)
  }, [store.lastActionError, store.clearActionError])
  if (!store.game || !store.config) return null
  const { game, config } = store
  const panel = store.openBuildingId
  const modalOpen = Boolean(panel || store.timelineOpen || store.historyOpen || menu || finishConfirm)
  const closeTop = () => {
    if (finishConfirm) setFinishConfirm(false)
    else if (menu) setMenu(null)
    else if (store.historyOpen) store.setHistoryOpen(false)
    else if (store.timelineOpen) store.closeTimeline()
    else if (panel) store.closeBuilding()
    else { setMenu('pause'); store.setPaused(true) }
  }
  const beginFinish = async () => {
    setFinishConfirm(false)
    setFinishing(true)
    sfx('reveal')
    const started = performance.now()
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const remaining = Math.max(0, 900 - (performance.now() - started))
    window.setTimeout(() => store.finishGame(), remaining)
  }
  const requestFinish = () => game.monthIndex < config.durationMonths ? setFinishConfirm(true) : void beginFinish()
  useShortcuts({ pause: () => store.setPaused(game.status === 'playing'), advance: store.advanceOneMonth, openBuilding: store.openBuilding, timeline: store.openTimeline, activity: () => store.setHistoryOpen(true), escape: closeTop, guide: () => setMenu('guide'), modalOpen })
  useEffect(() => {
    if (previousMonth.current !== null && previousMonth.current !== game.monthIndex) {
      setMonthBanner(true); sfx('month')
      if (previousCash.current !== null && game.cash > previousCash.current) sfx('coin')
      const timeout = window.setTimeout(() => setMonthBanner(false), 1_200)
      previousMonth.current = game.monthIndex; previousCash.current = game.cash
      return () => window.clearTimeout(timeout)
    }
    previousMonth.current = game.monthIndex; previousCash.current = game.cash
  }, [game.monthIndex, game.cash])
  useEffect(() => {
    const count = game.activeEvents.filter(event => event.type === 'B').length
    if (count > previousTypeB.current) sfx('alert')
    previousTypeB.current = count
  }, [game.activeEvents])
  useEffect(() => {
    if (!store.savedGame?.savedAt) return
    setSaved(true)
    const timeout = window.setTimeout(() => setSaved(false), 1_500)
    return () => window.clearTimeout(timeout)
  }, [store.savedGame?.savedAt])
  useEffect(() => {
    const click = (event: MouseEvent) => { if ((event.target as Element | null)?.closest('button')) sfx('click') }
    document.addEventListener('click', click)
    return () => document.removeEventListener('click', click)
  }, [])
  const hud = <header className="town-hud"><div className="hud-brand"><span className="brand-mark"><PixelIcon/></span><div className="wordmark">FINANCIAL TOWN<small>{config.title}</small></div></div><dl className="hud-stats"><div className="hud-date"><dt><PixelIcon kind="calendar"/>{monthLabel(config.startMonth,game.monthIndex)}</dt><dd>Month {game.monthIndex} / {config.durationMonths}</dd></div><div><dt><PixelIcon kind="coin"/>Cash</dt><dd>{usd(game.cash)}</dd></div><div><dt><PixelIcon kind="leaf"/>Savings</dt><dd>{usd(game.savings)}</dd></div><div><dt><PixelIcon kind="book"/>Debt</dt><dd>{usd(debt)}</dd></div><div className="hud-net"><dt><PixelIcon kind="coin"/>Net worth</dt><dd>{usd(netWorth)}</dd></div></dl><button className="pixel-button" onClick={store.openTimeline}>Timeline ↗</button></header>
  const gameStatus = <>{<span className="offline-tag">{game.status === 'paused' ? 'PAUSED' : game.status === 'finished' ? 'STORY COMPLETE' : store.aiStatus === 'loading' ? 'PREPARING OPPORTUNITY' : store.aiStatus === 'online' ? 'AI CONNECTED' : 'OFFLINE READY'}</span>}{saved && <span className="offline-tag" role="status">✓ Saved</span>}<button className="icon-button" aria-label="Open pause menu" onClick={() => { setMenu('pause'); store.setPaused(true) }}>⚙</button></>
  const eventBuildings = [...new Set(game.activeEvents.map(event => event.buildingTarget))]
  return <GameStage label="Fortune Valley town" world={<TownWorld onBuildingClick={store.openBuilding} eventBuildings={eventBuildings} openBuilding={panel} monthIndex={game.monthIndex}/>}>
    <a className="skip-link" href="#town-main">Skip to town controls</a>
    <FullscreenGameView hud={hud} status={gameStatus} blocked={modalOpen || finishing} onFinish={requestFinish}>
    {store.lastActionError && <p className="action-error pixel-panel" role="alert">{store.lastActionError}</p>}
    {monthBanner && <div className="month-banner pixel-panel" role="status">Month {game.monthIndex} · {monthLabel(config.startMonth, game.monthIndex)}</div>}
    {panel && <PanelHost building={panel} onClose={store.closeBuilding}>{game.activeEvents.filter(event => event.buildingTarget === panel && !(panel === 'office' && event.type === 'B')).map(event => <EventCard key={event.id} event={event} onChoose={optionId => store.dispatchAction({ type: 'apply_event_option', eventId: event.id, optionId })}/>)}{panels[panel] ?? <ConnectedBuildingPanel building={panel}/>}</PanelHost>}
    {store.timelineOpen && <PanelHost title="Your timeline" onClose={store.closeTimeline}>{game.timeline.length ? <ol className="story-list">{game.timeline.map(e=><li key={e.id}><span className="eyebrow">MONTH {e.monthIndex} · {e.type.replaceAll('_',' ')}</span><p>{e.description}</p></li>)}</ol> : <p>Your story starts here. Advance a month or make a decision to add to your timeline.</p>}</PanelHost>}
    {store.historyOpen && <PanelHost title="Town activity" onClose={()=>store.setHistoryOpen(false)}><ol className="story-list">{game.notifications.map(n=><li key={n.id}><span className="eyebrow">MONTH {n.monthIndex} · {n.kind}</span><h3>{n.summary}</h3>{n.details && <p>{n.details}</p>}{n.amountSigned !== undefined && <strong>{usd(n.amountSigned,true)}</strong>}{n.relatedBuilding && <button className="pixel-button" onClick={()=>{ store.setHistoryOpen(false); store.openBuilding(n.relatedBuilding!) }}>Open building →</button>}</li>)}</ol></PanelHost>}
    {menu === 'pause' && <PanelHost title="Paused" onClose={() => { setMenu(null); store.setPaused(false) }}><button className="pixel-button pixel-button--gold" onClick={() => { setMenu(null); store.setPaused(false) }}>Resume</button><button className="pixel-button" onClick={() => setMenu('options')}>Options</button><button className="pixel-button" onClick={() => setMenu('guide')}>Guide</button><button className="pixel-button" onClick={() => { store.saveGame(); store.resetGame() }}>Save &amp; quit to title</button></PanelHost>}
    {menu === 'options' && <OptionsWindow onClose={() => setMenu('pause')}/>} 
    {menu === 'guide' && <PanelHost title="Guide" onClose={() => setMenu('pause')}><p>Space pauses, N advances, 1–5 open buildings, T opens the timeline, A opens activity, and Esc closes the top window.</p></PanelHost>}
    {finishConfirm && <PanelHost title="Finish early?" onClose={() => setFinishConfirm(false)}><p>You've played {game.monthIndex} of {config.durationMonths} months. Results will use the months you played.</p><button className="pixel-button pixel-button--gold" onClick={() => void beginFinish()}>Finish now</button><button className="pixel-button" onClick={() => setFinishConfirm(false)}>Keep playing</button></PanelHost>}
    {finishing && <div className="finish-overlay" role="status"><div className="pixel-panel"><h2>Counting 1,000 possible futures…</h2><p aria-hidden="true">● ● ● ● ●</p></div></div>}
    {game.status === 'finished' && !finishing && <div className="completion-banner pixel-panel"><p>Your {config.durationMonths} months are complete.</p><button className="pixel-button pixel-button--gold" onClick={() => void beginFinish()}>Review your story →</button></div>}
    </FullscreenGameView>
    <div className="activity-area"><ToastStack notifications={game.notifications} onOpenBuilding={store.openBuilding} onViewAll={()=>store.setHistoryOpen(true)} onDismiss={store.markNotificationRead}/></div>
    <footer className="simulation-footer"><span>Fictional educational simulation · Assumptions are illustrative</span></footer>
  </GameStage>
}
