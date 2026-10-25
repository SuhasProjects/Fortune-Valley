import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useGameStore } from '../stores/useGameStore'
import type { BuildingId, GameConfig, GameState } from '../types/domain'
import { BuildingWindow } from '../components/panels/BuildingWindow'
import { PanelHost } from '../components/town/PanelHost'
import { freshScenario, scenarioById } from '../data/scenarios'
import { ToastStack } from './flow/ToastStack'
import { MonthRecap } from './flow/MonthRecap'
import { useShortcuts } from './flow/useShortcuts'
import { ActivityWindow } from './flow/ActivityWindow'
import { TimelineWindow } from './flow/TimelineWindow'
import { ConfirmDialog } from './flow/ConfirmDialog'
import { OptionsWindow, setSetting, useSettings } from './settings'
import { sfx } from './audio/sfx'
import { GameStage, useStageScale } from './stage/GameStage'
import { uiBox } from './stage/scale'
import { TownWorld } from './world/TownWorld'
import { ControlBar, Hud, HudFooter, StatusTag } from './hud'
import { GuideWindow } from './title/GuideWindow'
import { CoachPanel } from './coach/CoachPanel'
import { useGameClock } from '../hooks/useGameClock'
import { Board, Button, Modal, Tag } from '../ui'
import './flow/flow.css'
import './GameScreen.css'
import { isDemoMode } from '@/demo/demoMode'

type Menu = 'pause' | 'options' | 'guide' | null
type Confirm = 'restart' | 'delete-save' | 'finish' | null
const tips = [
  ['Explore the town', 'Each building holds a different part of your financial life. Click one, or press 1 to 5.'],
  ['Control the calendar', 'Advance when you are ready (N), pause with Space, or let auto-time move the story.'],
  ['Watch your whole picture', 'Cash, savings, debt and net worth update together in the board above.'],
  ['Own a car?', 'Open Your Home and tick it there, with a rough value. That sets fuel and repair costs and unlocks car insurance at the Health House.'],
  ['Stuck? Ask the Sage', 'The speech bubble in the corner opens the Sage. Ask what a choice does and he explains it with your own numbers.'],
] as const

export interface GameScreenProps { panels?: Partial<Record<BuildingId, ReactNode>> }

/**
 * One of the three opening tips. Windows taller than the map leave a strip of pine border under the control bar; when
 * that strip has room for a tip (70 UI art px) the tip docks there instead of over the town (flow.css `data-dock`).
 */
function CoachTip({ step, label, children }: { step: number; label?: string; children: ReactNode }) {
  const stage = useStageScale()
  const below = uiBox(stage.width, stage.height, stage).bottom >= 70 * Math.max(2, stage.px)
  return <Board as="aside" className={`fv-coach-tip fv-coach-tip--${step}`} data-dock={below ? 'below' : undefined} aria-label={label ?? `Tip ${step + 1} of 3`}>{children}</Board>
}

/** The town screen: Agent 1's stage and world, Agent 2's HUD, Agent 3's building panels, and the flow layer. */
export function GameScreen({ panels = {} }: GameScreenProps) {
  const game = useGameStore(state => state.game)
  const config = useGameStore(state => state.config)
  if (!game || !config) return null
  return <TownScreen game={game} config={config} panels={panels}/>
}

function TownScreen({ game, config, panels }: { game: GameState; config: GameConfig; panels: Partial<Record<BuildingId, ReactNode>> }) {
  const store = useGameStore()
  const settings = useSettings()
  const [menu, setMenu] = useState<Menu>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [finishing, setFinishing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tipStep, setTipStep] = useState(() => settings.tips && !settings.tipsSeen && game.monthIndex === 0 ? 0 : -1)
  const previousMonth = useRef(game.monthIndex)
  const previousCash = useRef(game.cash)
  const previousTypeB = useRef(game.activeEvents.filter(event => event.type === 'B').length)
  const pauseWasAlreadyPaused = useRef(false)
  const guideReturnsToPause = useRef(false)
  const previousModalOpen = useRef(false)
  const finishStarted = useRef(false)

  const panel = store.openBuildingId
  // Any window, menu or coach panel holds the clock (useGameClock also holds it while the tab is hidden); a Type B
  // offer holds it through `blocked` below until the player chooses.
  const modalOpen = Boolean(panel || store.timelineOpen || store.historyOpen || store.coachOpen || menu || confirm)
  const clock = useGameClock({
    enabled: settings.autoAdvanceSeconds > 0,
    intervalMs: Math.max(1, settings.autoAdvanceSeconds) * 1_000,
    blocked: game.activeEvents.length > 0 || modalOpen || finishing,
  })

  const openPause = useCallback(() => {
    pauseWasAlreadyPaused.current = game.status === 'paused'
    setMenu('pause')
    if (game.status === 'playing') store.setPaused(true)
  }, [game.status, store])
  const closePause = useCallback(() => {
    setMenu(null)
    if (!pauseWasAlreadyPaused.current && game.status === 'paused') store.setPaused(false)
  }, [game.status, store])
  const resume = () => { setMenu(null); if (game.status === 'paused') store.setPaused(false) }
  const openGuide = (fromPause: boolean) => { guideReturnsToPause.current = fromPause; setMenu('guide') }
  const closeGuide = () => setMenu(guideReturnsToPause.current ? 'pause' : null)

  const beginFinish = useCallback(async () => {
    if (finishStarted.current) return
    finishStarted.current = true
    setConfirm(null)
    setFinishing(true)
    sfx('reveal')
    const started = performance.now()
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const remaining = Math.max(0, 900 - (performance.now() - started))
    window.setTimeout(() => useGameStore.getState().finishGame(), remaining)
  }, [])
  const requestFinish = useCallback(() => {
    if (finishStarted.current) return
    if (game.monthIndex < config.durationMonths) setConfirm('finish')
    else void beginFinish()
  }, [beginFinish, config.durationMonths, game.monthIndex])

  const closeTop = useCallback(() => {
    if (confirm) setConfirm(null)
    else if (menu === 'guide') closeGuide()
    else if (menu === 'options') setMenu('pause')
    else if (menu === 'pause') closePause()
    else if (store.historyOpen) store.setHistoryOpen(false)
    else if (store.timelineOpen) store.closeTimeline()
    else if (store.coachOpen) store.setCoachOpen(false)
    else if (panel) store.closeBuilding()
    else if (!finishing) openPause()
  }, [closePause, confirm, finishing, menu, openPause, panel, store])

  useShortcuts({
    pause: () => store.setPaused(game.status === 'playing'),
    advance: clock.advanceNow,
    openBuilding: store.openBuilding,
    timeline: store.openTimeline,
    activity: () => store.setHistoryOpen(true),
    escape: closeTop,
    guide: () => openGuide(false),
    modalOpen: modalOpen || finishing,
  })

  useEffect(() => {
    if (!store.lastActionError) return
    const timeout = window.setTimeout(store.clearActionError, 5_000)
    return () => window.clearTimeout(timeout)
  }, [store.lastActionError, store.clearActionError])
  useEffect(() => {
    if (previousMonth.current !== game.monthIndex) {
      sfx('month')
      if (game.cash > previousCash.current) sfx('coin')
      previousMonth.current = game.monthIndex
    }
    previousCash.current = game.cash
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
  // Building windows play their own open/close sounds (PanelHost); the flow windows play them here.
  const flowWindowOpen = Boolean(store.timelineOpen || store.historyOpen || menu || confirm)
  useEffect(() => {
    if (flowWindowOpen !== previousModalOpen.current) sfx(flowWindowOpen ? 'open' : 'close')
    previousModalOpen.current = flowWindowOpen
  }, [flowWindowOpen])

  const nextTip = () => {
    if (tipStep < tips.length - 1) setTipStep(step => step + 1)
    else { setTipStep(-1); setSetting('tipsSeen', true) }
  }
  const saveAndQuit = () => {
    closePause()
    store.saveGame()
    store.resetGame()
  }
  const restart = () => {
    setConfirm(null)
    setMenu(null)
    finishStarted.current = false
    const archetype = scenarioById(config.scenarioId)?.archetype
    store.startGame(archetype ? freshScenario(archetype) : config)
  }
  const eventBuildings = [...new Set(game.activeEvents.map(event => event.buildingTarget))]
  const tip = tipStep >= 0 ? tips[tipStep] : null
  // /demo: at month 3 the coach nudges the player toward the Health House's two plans.
  const [demoTipDone, setDemoTipDone] = useState(false)
  const demoTip = isDemoMode() && !demoTipDone && game.monthIndex === 3 && !tip

  return <main aria-label="Fortune Valley town">
    <GameStage label="Fortune Valley town" world={<TownWorld onBuildingClick={store.openBuilding} eventBuildings={eventBuildings} openBuilding={panel} monthIndex={game.monthIndex}/>}>
      <Hud onOpenTimeline={store.openTimeline}/>
      <MonthRecap game={game} config={config} reduceMotion={settings.reduceMotion}/>
      <div className="fv-flow-tools"><StatusTag/>{saved && <Tag tone="green">Saved</Tag>}<Button size="sm" className="fv-pause-menu" aria-label="Pause menu" title="Pause menu · Esc" onClick={openPause}><span className="fv-glyph fv-glyph--pause" aria-hidden="true"/></Button></div>
      <ControlBar status={game.status} onAdvance={clock.advanceNow} onPause={store.setPaused} onFinish={requestFinish} secondsRemaining={clock.secondsRemaining} autoAdvanceEnabled={clock.autoAdvanceEnabled} blocked={game.activeEvents.length > 0} onToggleAuto={() => setSetting('autoAdvanceSeconds', settings.autoAdvanceSeconds ? 0 : settings.lastAutoAdvanceSeconds)}/>
      <ToastStack notifications={game.notifications} onOpenBuilding={store.openBuilding} onViewAll={() => store.setHistoryOpen(true)} onDismiss={store.markNotificationRead}/>
      <HudFooter/>
      <CoachPanel/>
      {store.lastActionError && <Board as="p" className="fv-action-error" role="alert">{store.lastActionError}</Board>}
      {demoTip && <CoachTip step={4} label="Coach tip">
        <strong>Premiums are eating your paycheck</strong><p>Your health plan is the biggest bill you can change. The Health House has two plans; worth a look?</p>
        <Button size="sm" variant="primary" onClick={() => { setDemoTipDone(true); store.openBuilding('hospital') }}>Open Health House</Button>
      </CoachTip>}
      {tip && <CoachTip step={tipStep}>
        <strong>{tip[0]}</strong><p>{tip[1]}</p>
        <Button size="sm" variant="primary" onClick={nextTip}>{tipStep === tips.length - 1 ? 'Got it' : 'Next tip'}</Button>
      </CoachTip>}
      {game.status === 'finished' && !finishing && <Board as="section" padding="lg" className="fv-completion-banner" aria-label="Story complete">
        <p>Your {config.durationMonths} months are complete.</p>
        <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => void beginFinish()}>Review your story</Button>
      </Board>}
      {panel && (panels[panel]
        ? <PanelHost building={panel} onClose={store.closeBuilding}>{panels[panel]}</PanelHost>
        : <BuildingWindow building={panel} onClose={store.closeBuilding}/>)}
      {store.timelineOpen && <TimelineWindow entries={game.timeline} startMonth={config.startMonth} onClose={store.closeTimeline}/>}
      {store.historyOpen && <ActivityWindow notifications={game.notifications} onClose={() => store.setHistoryOpen(false)} onMarkAllRead={store.markAllNotificationsRead} onOpenBuilding={building => { store.setHistoryOpen(false); store.openBuilding(building) }}/>}
      {menu === 'pause' && <Modal title="Paused" onClose={closePause} width="sm">
        <div className="fv-menu-list">
          <Button variant="primary" icon="play" onClick={resume}>Resume</Button>
          <Button icon="gear" onClick={() => setMenu('options')}>Options</Button>
          <Button icon="book" onClick={() => openGuide(true)}>Guide</Button>
          <Button icon="save" onClick={saveAndQuit}>Save &amp; quit to title</Button>
          <Button icon="warning" onClick={() => setConfirm('restart')}>Restart this story</Button>
        </div>
      </Modal>}
      {menu === 'options' && <Modal title="Options" onClose={() => setMenu('pause')} width="sm">
        <OptionsWindow onClose={() => setMenu('pause')} onDeleteSave={() => setConfirm('delete-save')}/>
      </Modal>}
      {menu === 'guide' && <GuideWindow onClose={closeGuide}/>}
      {confirm === 'finish' && <ConfirmDialog
        title="Finish early?" body={`You've played ${game.monthIndex} of ${config.durationMonths} months. Results will use the months you played.`}
        confirmLabel="Finish now" cancelLabel="Keep playing" onCancel={() => setConfirm(null)} onConfirm={() => void beginFinish()}/>}
      {confirm === 'restart' && <ConfirmDialog
        title="Restart this story?" body="Your current progress will be replaced with a fresh version of this story."
        confirmLabel="Restart" danger onCancel={() => setConfirm(null)} onConfirm={restart}/>}
      {confirm === 'delete-save' && <ConfirmDialog
        title="Delete saved game?" body="Your saved run will be permanently removed. Your current run will stay open."
        confirmLabel="Delete save" danger onCancel={() => setConfirm(null)} onConfirm={() => { store.clearSavedGame(); setConfirm(null) }}/>}
      {finishing && <div className="fv-finish-overlay" role="status" aria-live="assertive">
        <Board padding="lg" className="fv-finish-card" data-reduce-motion={settings.reduceMotion || undefined}>
          <h2>Counting 1,000 possible futures…</h2>
          <p>Same choices with different luck, so hold on a moment.</p>
          <span className="fv-counter" aria-hidden="true"><i/><i/><i/><i/><i/></span>
        </Board>
      </div>}
    </GameStage>
  </main>
}
