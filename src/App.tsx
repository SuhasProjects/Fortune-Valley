/**
 * Root layout — OWNER: Agent 2. Ported onto the canonical store/types by Agent 1 (integrator).
 * Agent 3 supplies controlled `panels`; Agent 5 supplies `renderReveal(FinishPayload)`.
 * `?dev=engine` shows the plain-text engine harness.
 */
import { useState, type ReactNode } from 'react';
import { scenarios } from './data/scenarios';
import { GameClock, NotificationStack, monthLabel, usd } from './components/flow';
import { selectDebtTotal, selectNetWorth, useGameStore, type FinishPayload } from './stores/useGameStore';
import { TownScene, BuildingSprite } from './components/town/TownScene';
import { PanelHost } from './components/town/PanelHost';
import { GameShell } from './components/layout/GameShell';
import type { BuildingId } from './types/domain';
import EngineHarness from './dev/EngineHarness';
import { ConnectedBuildingPanel } from './components/panels/ConnectedBuildingPanel';

export interface AppProps {
  panels?: Partial<Record<BuildingId, ReactNode>>;
  renderReveal?: (payload: FinishPayload) => ReactNode;
}

export default function App(props: AppProps) {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === 'engine') return <EngineHarness />;
  return <Town {...props} />;
}

function DefaultReveal({ payload, onReset }: { payload: FinishPayload; onReset: () => void }) {
  const mc = payload.monteCarlo;
  return (
    <>
      <span className="eyebrow">ACTUAL PLAY OUTCOME</span>
      <h3 className="observed-value">{usd(mc.observedNetWorth)}</h3>
      <p>Observed net worth after {payload.finalState.monthIndex} months, with {payload.policyLog.length} recorded decisions.</p>
      <span className="eyebrow">SAME STRATEGY, {mc.pathsCompleted.toLocaleString()} OTHER LIVES</span>
      <p>Median {usd(mc.median)} · 10th percentile {usd(mc.p10)} · 90th percentile {usd(mc.p90)}.</p>
      <p>{mc.percentileOfObserved !== undefined ? `About ${Math.round(mc.percentileOfObserved * 100)}% of simulated paths ended below your actual outcome. Luck is part of that; it is not a grade.` : 'Horizon differs from the simulation; no percentile is shown.'}</p>
      <p>Negative net worth in {Math.round(mc.probabilityNegativeNetWorth * 100)}% of paths · emergency borrowing in {Math.round(mc.probabilityLiquidityShortfall * 100)}%.</p>
      <details><summary>Simulation assumptions</summary><ul>{mc.assumptionsSummary.map(note => <li key={note}>{note}</li>)}</ul></details>
      <div><button className="pixel-button pixel-button--gold" onClick={onReset}>Choose a new story →</button></div>
    </>
  );
}

function Town({ panels = {}, renderReveal }: AppProps) {
  const [prompt, setPrompt] = useState('');
  const [formError, setFormError] = useState('');
  const store = useGameStore();
  const netWorth = useGameStore(selectNetWorth);
  const debt = useGameStore(selectDebtTotal);

  if (!store.game || !store.config) {
    return (
      <main className="town-landing">
        <header className="landing-nav"><a className="wordmark" href="#">FT<span>FINANCIAL TOWN</span></a><span className="offline-tag">{store.aiStatus === 'online' ? 'AI CONNECTED' : 'OFFLINE READY'}</span></header>
        <section className="landing-hero">
          <span className="eyebrow">A SMALL TOWN OF BIG POSSIBILITIES</span>
          <h1>Your money.<br />Your little world.</h1>
          <p>Build a life, make a few choices, and discover how they add up. One month at a time.</p>
          <a className="pixel-button pixel-button--gold" href="#starting-lives">Choose your starting life ↓</a>
          <div className="hero-village" aria-hidden="true"><BuildingSprite building="bank" /><BuildingSprite building="home" /><BuildingSprite building="market" /></div>
        </section>
        <section id="starting-lives" className="starting-lives">
          <div className="section-heading"><div><span className="eyebrow">CHAPTER ONE</span><h2>Every story starts somewhere.</h2></div><span>Four lives. Plenty of possibilities.</span></div>
          <div className="life-grid">
            {scenarios.map((s, i) => (
              <button className="life-card pixel-panel" key={s.scenarioId} onClick={() => store.startGame(s)}>
                <span className="life-number">0{i + 1}</span>
                <BuildingSprite building={(['home', 'office', 'market', 'home'] as BuildingId[])[i] ?? 'home'} />
                <h3>{s.title}</h3><p>{s.description}</p><span className="life-start">Start this story <span>→</span></span>
              </button>
            ))}
          </div>
        </section>
        <section className="personalization pixel-panel">
          <div>
            <span className="eyebrow">OR, BRING YOUR OWN QUESTION</span>
            <h2>Explore your situation.</h2>
            <p>Describe a financial question. It is mapped onto an existing starting life — by the AI gateway when configured, otherwise by a labeled offline mapping.</p>
            <small>Leave out account numbers and sensitive details. Your text is used once to build the scenario and is not stored.</small>
          </div>
          <form onSubmit={async (e) => { e.preventDefault(); setFormError(''); try { const result = await store.generatePersonalized(prompt); store.startGame(result.config); } catch (error) { setFormError(error instanceof Error ? error.message : 'Could not prepare your scenario.'); } }}>
            <label htmlFor="situation">What would you like to explore?</label>
            <textarea id="situation" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="How can I balance paying off debt and building savings?" required maxLength={1000} />
            <button className="pixel-button pixel-button--gold" disabled={store.personalizationLoading}>{store.personalizationLoading ? 'Preparing…' : 'Build my scenario →'}</button>
            {(formError || store.personalizationError) && <p role="alert">{formError || store.personalizationError}</p>}
          </form>
        </section>
        <footer className="simulation-footer">Fictional educational simulation · Illustrative assumptions · Not financial advice</footer>
      </main>
    );
  }

  const { game, config } = store;
  const panel = store.openBuildingId;
  const eventBuilding = game.activeEvents.find((e) => e.type === 'B')?.buildingTarget ?? game.activeEvents[0]?.buildingTarget ?? null;
  const statusTag = game.status === 'paused' ? 'PAUSED' : game.status === 'finished' ? 'STORY COMPLETE' : store.aiStatus === 'online' ? 'AI DIRECTOR ONLINE' : 'OFFLINE SIMULATION';

  return (
    <GameShell
      topBar={
        <header className="town-hud">
          <div className="hud-brand"><span className="brand-mark">FT</span><div className="wordmark">FINANCIAL TOWN<small>{config.title}</small></div></div>
          <dl className="hud-stats">
            <div className="hud-date"><dt>{monthLabel(config.startMonth, game.monthIndex)}</dt><dd>Month {game.monthIndex} / {config.durationMonths}</dd></div>
            <div><dt>Cash</dt><dd>{usd(game.cash)}</dd></div>
            <div><dt>Savings</dt><dd>{usd(game.savings)}</dd></div>
            <div><dt>Debt</dt><dd>{usd(debt)}</dd></div>
            <div className="hud-net"><dt>Net worth</dt><dd>{usd(netWorth)}</dd></div>
          </dl>
          <button className="pixel-button" onClick={store.openTimeline}>Timeline ↗</button>
        </header>
      }
      toasts={<div className="activity-area"><NotificationStack notifications={game.notifications} onOpenBuilding={store.openBuilding} onViewAll={() => store.setHistoryOpen(true)} onDismiss={store.markNotificationRead} /></div>}
    >
      <div className="town-heading"><div><span className="eyebrow">YOUR NEIGHBORHOOD</span><h1>A new month. A little possibility.</h1></div><span className="offline-tag">{statusTag}</span></div>
      <TownScene onBuildingClick={store.openBuilding} eventBuilding={eventBuilding} />
      <div className="town-toolbar">
        <p><span aria-hidden="true">✦</span> Explore your town. Your choices carry forward.</p>
        <GameClock status={game.status} onAdvance={store.advanceOneMonth} onPause={store.setPaused} onFinish={store.finishGame} />
      </div>
      {store.lastActionError && <p role="alert" className="offline-tag">{store.lastActionError}</p>}
      {panel && !store.finishPayload && (
        <PanelHost building={panel} onClose={store.closeBuilding}>
          {panels[panel] ?? <ConnectedBuildingPanel building={panel} />}
        </PanelHost>
      )}
      {store.timelineOpen && !store.finishPayload && (
        <PanelHost title="Your timeline" onClose={store.closeTimeline}>
          {game.timeline.length ? (
            <ol className="story-list">{game.timeline.slice().reverse().map((e) => <li key={e.id}><span className="eyebrow">MONTH {e.monthIndex} · {e.type.replaceAll('_', ' ')} · {usd(e.netWorthAfter)}</span><p>{e.description}</p></li>)}</ol>
          ) : <p>Your story starts here. Advance a month or make a decision to add to your timeline.</p>}
        </PanelHost>
      )}
      {store.historyOpen && !store.finishPayload && (
        <PanelHost title="Town activity" onClose={() => store.setHistoryOpen(false)}>
          <button className="pixel-button" onClick={store.markAllNotificationsRead} disabled={game.notifications.every((n) => n.read)}>Mark all read</button>
          <ol className="story-list">
            {game.notifications.slice().reverse().map((n) => (
              <li key={n.id}>
                <span className="eyebrow">MONTH {n.monthIndex} · {n.kind}</span><h3>{n.summary}</h3>{n.details && <p>{n.details}</p>}
                {n.relatedBuilding && <button className="pixel-button" onClick={() => { store.setHistoryOpen(false); store.openBuilding(n.relatedBuilding!); }}>Open building →</button>}
              </li>
            ))}
          </ol>
        </PanelHost>
      )}
      {store.finishPayload && (
        <PanelHost title="Your next chapter" onClose={store.resetGame}>
          {renderReveal ? renderReveal(store.finishPayload) : <DefaultReveal payload={store.finishPayload} onReset={store.resetGame} />}
        </PanelHost>
      )}
      {game.status === 'finished' && !store.finishPayload && (
        <div className="completion-banner pixel-panel"><p>Your final month is complete.</p><button className="pixel-button pixel-button--gold" onClick={store.finishGame}>Review your story →</button></div>
      )}
    </GameShell>
  );
}
