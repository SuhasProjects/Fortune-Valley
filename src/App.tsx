import { useState, type ReactNode } from 'react'
import { scenarios } from './data/scenarios'
import { EventCard, GameClock, NotificationStack, monthLabel, usd } from './components/flow'
import { selectDebtTotal, selectNetWorth, useGameStore, type FinishPayload } from './stores/useGameStore'
import { TownScene } from './components/town/TownScene'
import { PanelHost } from './components/town/PanelHost'
import { GameShell } from './components/layout/GameShell'
import type { BuildingId } from './types/domain'
import { PixelIcon, PixelPortrait, WorldBackdrop } from './components/layout/PixelArt'
import { BuildingOverview } from './components/layout/BuildingOverview'
import EngineHarness from './dev/EngineHarness'

// Agent 3 supplies controlled panels. Agent 5 mounts its computed reveal here.
export interface AppProps {
  panels?: Partial<Record<BuildingId, ReactNode>>
  renderReveal?: (payload: FinishPayload) => ReactNode
}
export default function App(props: AppProps) {
  if (new URLSearchParams(window.location.search).get('dev') === 'engine') return <EngineHarness />
  return <Town {...props}/>
}
const startingLifeHints = [
  'Practice everyday spending, student debt, and saving a little.',
  'Get comfortable with paychecks, rent, and building savings.',
  'Explore investing and protecting the savings you have built.',
  'Plan household costs and save for everyday surprises.',
]
function Town({ panels = {}, renderReveal }: AppProps) {
  const [prompt, setPrompt] = useState('')
  const [formError, setFormError] = useState('')
  const store = useGameStore()
  const netWorth = useGameStore(selectNetWorth)
  const debt = useGameStore(selectDebtTotal)
  if (!store.game || !store.config) return <main className="town-landing">
    <WorldBackdrop/>
    <header className="landing-nav"><a className="wordmark" href="#"><PixelIcon/> FINANCIAL TOWN</a><span className="offline-tag">PLAYABLE OFFLINE</span></header>
    <section className="landing-hero">
      <div className="hero-kicker"><PixelIcon kind="leaf"/><span>A LITTLE LIFE. A WORLD OF POSSIBILITIES.</span></div>
      <div className="title-sign"><span className="sign-nail nail-left"/><span className="sign-nail nail-right"/><h1>Your money.<br/>Your little world.</h1></div>
      <p>Put down roots. Make your choices.<br/>See what grows, one month at a time.</p>
      <a className="pixel-button pixel-button--gold hero-play" href="#starting-lives"><PixelIcon kind="leaf"/> Begin your story <span aria-hidden="true">&rarr;</span></a>
      <div className="hero-details"><span>Learn at your own pace. There is no perfect score.</span></div>
    </section>
    <section id="starting-lives" className="starting-lives quest-board">
      <div className="board-pin pin-left"/><div className="board-pin pin-right"/>
      <div className="section-heading"><PixelIcon kind="book"/><div><span className="eyebrow">NEW SAVE FILE</span><h2>Choose your starting life</h2></div><span>Who will you be?</span></div>
      <div className="life-grid">{scenarios.map((scenario,index) => <button className="life-card pixel-panel" key={scenario.scenarioId} onClick={()=>store.startGame(scenario)}><div className="save-slot"><span>FILE 0{index+1}</span><span aria-hidden="true">&#10022;</span></div><PixelPortrait variant={index}/><h3>{scenario.title}</h3><p>{startingLifeHints[index]}</p><span className="life-start">Start this story <span aria-hidden="true">&rarr;</span></span></button>)}</div>
      <p className="board-caption">Pick a life that feels interesting. You can always start again.</p>
    </section>
    <section className="personalization pixel-panel"><div className="journal-intro"><PixelIcon kind="book"/><span className="eyebrow">A PAGE FROM YOUR OWN LIFE</span><h2>Got a question<br/>of your own?</h2><p>Explore a situation you care about. We'll turn it into a starting point using the town's financial mechanics.</p><small>Leave out sensitive details. The AI gateway can prepare a scenario; a local fallback is available offline.</small></div><form onSubmit={async event=>{event.preventDefault();setFormError('');try {const result=await store.generatePersonalized(prompt);store.startGame(result.config)} catch(error){setFormError(error instanceof Error ? error.message : 'Could not prepare your scenario.')}}}><label htmlFor="situation">Dear future me...</label><textarea id="situation" value={prompt} onChange={event=>setPrompt(event.target.value)} placeholder="How can I pay down debt while saving for a rainy day?" required maxLength={1000}/><button className="pixel-button pixel-button--gold" disabled={store.personalizationLoading}>{store.personalizationLoading ? 'Preparing your story...' : 'Explore my situation'} <span aria-hidden="true">&rarr;</span></button>{(formError||store.personalizationError)&&<p role="alert">{formError||store.personalizationError}</p>}</form></section>
    <footer className="simulation-footer">Fictional educational simulation &middot; Illustrative assumptions &middot; Not financial advice</footer>
  </main>
  const { game, config } = store
  const panel = store.openBuildingId
  return <GameShell topBar={<header className="town-hud"><div className="hud-brand"><span className="brand-mark"><PixelIcon/></span><div className="wordmark">FINANCIAL TOWN<small>{config.title}</small></div></div><dl className="hud-stats"><div className="hud-date"><dt><PixelIcon kind="calendar"/>{monthLabel(config.startMonth,game.monthIndex)}</dt><dd>Month {game.monthIndex} / {config.durationMonths}</dd></div><div><dt><PixelIcon kind="coin"/>Cash</dt><dd>{usd(game.cash)}</dd></div><div><dt><PixelIcon kind="leaf"/>Savings</dt><dd>{usd(game.savings)}</dd></div><div><dt><PixelIcon kind="book"/>Debt</dt><dd>{usd(debt)}</dd></div><div className="hud-net"><dt><PixelIcon kind="coin"/>Net worth</dt><dd>{usd(netWorth)}</dd></div></dl><button className="pixel-button" onClick={store.openTimeline}>Timeline ↗</button></header>} toasts={<div className="activity-area"><NotificationStack notifications={game.notifications} onOpenBuilding={store.openBuilding} onViewAll={()=>store.setHistoryOpen(true)} onDismiss={store.markNotificationRead}/></div>}>
    <div className="town-heading"><div><span className="eyebrow">YOUR NEIGHBORHOOD</span><h1>A new month. A little possibility.</h1></div><span className="offline-tag">{game.status === 'paused' ? 'PAUSED' : game.status === 'finished' ? 'STORY COMPLETE' : store.aiStatus === 'loading' ? 'PREPARING OPPORTUNITY' : store.aiStatus === 'online' ? 'AI CONNECTED' : 'OFFLINE READY'}</span></div>
    {store.lastActionError && <p className="action-error pixel-panel" role="alert">{store.lastActionError}</p>}
    <TownScene onBuildingClick={store.openBuilding} eventBuildings={game.activeEvents.map(event => event.buildingTarget)}/>
    <div className="town-toolbar"><p><span aria-hidden="true">✦</span> Explore your town. Your choices carry forward.</p><GameClock status={game.status} onAdvance={store.advanceOneMonth} onPause={store.setPaused} onFinish={store.finishGame}/></div>
    {panel && !store.finishPayload && <PanelHost building={panel} onClose={store.closeBuilding}>{game.activeEvents.filter(event => event.buildingTarget === panel).map(event => <EventCard key={event.id} event={event} onChoose={optionId => store.dispatchAction({ type: 'apply_event_option', eventId: event.id, optionId })}/>)} {panels[panel] ?? <BuildingOverview building={panel} game={game}/>}</PanelHost>}
    {store.timelineOpen && !store.finishPayload && <PanelHost title="Your timeline" onClose={store.closeTimeline}>{game.timeline.length ? <ol className="story-list">{game.timeline.map(e=><li key={e.id}><span className="eyebrow">MONTH {e.monthIndex} · {e.type.replaceAll('_',' ')}</span><p>{e.description}</p></li>)}</ol> : <p>Your story starts here. Advance a month or make a decision to add to your timeline.</p>}</PanelHost>}
    {store.historyOpen && !store.finishPayload && <PanelHost title="Town activity" onClose={()=>store.setHistoryOpen(false)}><ol className="story-list">{game.notifications.map(n=><li key={n.id}><span className="eyebrow">MONTH {n.monthIndex} · {n.kind}</span><h3>{n.summary}</h3>{n.details && <p>{n.details}</p>}{n.amountSigned !== undefined && <strong>{usd(n.amountSigned,true)}</strong>}{n.relatedBuilding && <button className="pixel-button" onClick={()=>{ store.setHistoryOpen(false); store.openBuilding(n.relatedBuilding!) }}>Open building →</button>}</li>)}</ol></PanelHost>}
    {store.finishPayload && <PanelHost title="Your next chapter" onClose={store.resetGame}>{renderReveal ? renderReveal(store.finishPayload) : <><span className="eyebrow">ACTUAL PLAY OUTCOME</span><h3 className="observed-value">{usd(netWorth)}</h3><p>Observed net worth after {game.monthIndex} months, with {game.policyLog.length} recorded policy decisions.</p><div className="computed-reveal"><h3>Same strategy, {store.finishPayload.monteCarlo.pathsCompleted.toLocaleString()} futures</h3><p>Your strategy was replayed over {store.finishPayload.monteCarlo.months} months.</p><dl><div><dt>Median ending net worth</dt><dd>{usd(store.finishPayload.monteCarlo.median)}</dd></div><div><dt>10th to 90th percentile range</dt><dd>{usd(store.finishPayload.monteCarlo.p10)} to {usd(store.finishPayload.monteCarlo.p90)}</dd></div><div><dt>Probability of negative net worth</dt><dd>{Math.round(store.finishPayload.monteCarlo.probabilityNegativeNetWorth * 100)}%</dd></div><div><dt>Probability of emergency borrowing</dt><dd>{Math.round(store.finishPayload.monteCarlo.probabilityLiquidityShortfall * 100)}%</dd></div></dl>{store.finishPayload.monteCarlo.percentileOfObserved !== undefined ? <p>About {Math.round(store.finishPayload.monteCarlo.percentileOfObserved * 100)}% of simulated paths ended below your observed outcome. This reflects uncertainty, not a grade for your choices.</p> : <p>The observed and simulated horizons differ, so no observed percentile is shown.</p>}<details><summary>Simulation assumptions</summary><ul>{store.finishPayload.monteCarlo.assumptionsSummary.map(note => <li key={note}>{note}</li>)}</ul></details></div><button className="pixel-button pixel-button--gold" onClick={store.resetGame}>Choose a new story →</button></>}</PanelHost>}
    {game.status === 'finished' && !store.finishPayload && <div className="completion-banner pixel-panel"><p>Your final month is complete.</p><button className="pixel-button pixel-button--gold" onClick={store.finishGame}>Review your story →</button></div>}
  </GameShell>
}
