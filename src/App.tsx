import { type ReactNode } from 'react'
import { GameClock, NotificationStack, monthLabel, usd } from './components/flow'
import { selectDebtTotal, selectNetWorth, useGameStore, type FinishPayload } from './stores/useGameStore'
import { TownScene } from './components/town/TownScene'
import { PanelHost } from './components/town/PanelHost'
import { GameShell } from './components/layout/GameShell'
import type { BuildingId } from './types/domain'
import { ConnectedBuildingPanel } from './components/panels/ConnectedBuildingPanel'
import EngineHarness from './dev/EngineHarness'
import { Landing } from './components/landing/Landing'

// Agent 3 supplies controlled panels. Agent 5 mounts its computed reveal here.
export interface AppProps {
  panels?: Partial<Record<BuildingId, ReactNode>>
  renderReveal?: (payload: FinishPayload) => ReactNode
}
export default function App(props: AppProps) {
  if (new URLSearchParams(window.location.search).get('dev') === 'engine') return <EngineHarness />
  return <Town {...props}/>
}
function Town({ panels = {}, renderReveal }: AppProps) {
  const store = useGameStore()
  const netWorth = useGameStore(selectNetWorth)
  const debt = useGameStore(selectDebtTotal)
  if (!store.game || !store.config) return <Landing/>
  const { game, config } = store
  const panel = store.openBuildingId
  return <GameShell topBar={<header className="town-hud"><div className="hud-brand"><span className="brand-mark">FT</span><div className="wordmark">FINANCIAL TOWN<small>{config.title}</small></div></div><dl className="hud-stats"><div className="hud-date"><dt>{monthLabel(config.startMonth,game.monthIndex)}</dt><dd>Month {game.monthIndex} / {config.durationMonths}</dd></div><div><dt>Cash</dt><dd>{usd(game.cash)}</dd></div><div><dt>Savings</dt><dd>{usd(game.savings)}</dd></div><div><dt>Debt</dt><dd>{usd(debt)}</dd></div><div className="hud-net"><dt>Net worth</dt><dd>{usd(netWorth)}</dd></div></dl><button className="pixel-button" onClick={store.openTimeline}>Timeline ↗</button></header>} toasts={<div className="activity-area"><NotificationStack notifications={game.notifications} onOpenBuilding={store.openBuilding} onViewAll={()=>store.setHistoryOpen(true)} onDismiss={store.markNotificationRead}/></div>}>
    <div className="town-heading"><div><span className="eyebrow">YOUR NEIGHBORHOOD</span><h1>A new month. A little possibility.</h1></div><span className="offline-tag">{game.status === 'paused' ? 'PAUSED' : game.status === 'finished' ? 'STORY COMPLETE' : store.aiStatus === 'loading' ? 'PREPARING OPPORTUNITY' : store.aiStatus === 'online' ? 'AI CONNECTED' : 'OFFLINE READY'}</span></div>
    {store.lastActionError && <p className="action-error pixel-panel" role="alert">{store.lastActionError}</p>}
    <TownScene onBuildingClick={store.openBuilding} eventBuildings={game.activeEvents.map(event => event.buildingTarget)}/>
    <div className="town-toolbar"><p><span aria-hidden="true">✦</span> Explore your town. Your choices carry forward.</p><GameClock status={game.status} onAdvance={store.advanceOneMonth} onPause={store.setPaused} onFinish={store.finishGame}/></div>
    {panel && !store.finishPayload && <PanelHost building={panel} onClose={store.closeBuilding}>{panels[panel] ?? <ConnectedBuildingPanel building={panel}/>}</PanelHost>}
    {store.timelineOpen && !store.finishPayload && <PanelHost title="Your timeline" onClose={store.closeTimeline}>{game.timeline.length ? <ol className="story-list">{game.timeline.map(e=><li key={e.id}><span className="eyebrow">MONTH {e.monthIndex} · {e.type.replaceAll('_',' ')}</span><p>{e.description}</p></li>)}</ol> : <p>Your story starts here. Advance a month or make a decision to add to your timeline.</p>}</PanelHost>}
    {store.historyOpen && !store.finishPayload && <PanelHost title="Town activity" onClose={()=>store.setHistoryOpen(false)}><ol className="story-list">{game.notifications.map(n=><li key={n.id}><span className="eyebrow">MONTH {n.monthIndex} · {n.kind}</span><h3>{n.summary}</h3>{n.details && <p>{n.details}</p>}{n.amountSigned !== undefined && <strong>{usd(n.amountSigned,true)}</strong>}{n.relatedBuilding && <button className="pixel-button" onClick={()=>{ store.setHistoryOpen(false); store.openBuilding(n.relatedBuilding!) }}>Open building →</button>}</li>)}</ol></PanelHost>}
    {store.finishPayload && <PanelHost title="Your next chapter" onClose={store.resetGame}>{renderReveal ? renderReveal(store.finishPayload) : <><span className="eyebrow">ACTUAL PLAY OUTCOME</span><h3 className="observed-value">{usd(netWorth)}</h3><p>Observed net worth after {game.monthIndex} months, with {game.policyLog.length} recorded policy decisions.</p><div className="computed-reveal"><h3>Same strategy, {store.finishPayload.monteCarlo.pathsCompleted.toLocaleString()} futures</h3><p>Your strategy was replayed over {store.finishPayload.monteCarlo.months} months.</p><dl><div><dt>Median ending net worth</dt><dd>{usd(store.finishPayload.monteCarlo.median)}</dd></div><div><dt>10th to 90th percentile range</dt><dd>{usd(store.finishPayload.monteCarlo.p10)} to {usd(store.finishPayload.monteCarlo.p90)}</dd></div><div><dt>Probability of negative net worth</dt><dd>{Math.round(store.finishPayload.monteCarlo.probabilityNegativeNetWorth * 100)}%</dd></div><div><dt>Probability of emergency borrowing</dt><dd>{Math.round(store.finishPayload.monteCarlo.probabilityLiquidityShortfall * 100)}%</dd></div></dl>{store.finishPayload.monteCarlo.percentileOfObserved !== undefined ? <p>About {Math.round(store.finishPayload.monteCarlo.percentileOfObserved * 100)}% of simulated paths ended below your observed outcome. This reflects uncertainty, not a grade for your choices.</p> : <p>The observed and simulated horizons differ, so no observed percentile is shown.</p>}<details><summary>Simulation assumptions</summary><ul>{store.finishPayload.monteCarlo.assumptionsSummary.map(note => <li key={note}>{note}</li>)}</ul></details></div><button className="pixel-button pixel-button--gold" onClick={store.resetGame}>Choose a new story →</button></>}</PanelHost>}
    {game.status === 'finished' && !store.finishPayload && <div className="completion-banner pixel-panel"><p>Your final month is complete.</p><button className="pixel-button pixel-button--gold" onClick={store.finishGame}>Review your story →</button></div>}
  </GameShell>
}
