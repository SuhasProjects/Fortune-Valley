/**
 * Root layout. OWNER: Agent 2 (town/layout). This is Agent 4's prototype ported onto
 * the canonical store by Agent 1 during integration; Agent 2 should replace the town
 * scene and Agent 3 the building panels. `?dev=engine` shows the engine harness.
 */
import { useState } from 'react';
import { scenarios } from './data/scenarios';
import { EventCard, GameClock, NotificationStack, TimelineDrawer, monthLabel, usd } from './components/flow';
import { selectDebtTotal, selectNetWorth, selectPendingEvent, useGameStore } from './stores/useGameStore';
import type { BuildingId } from './types/domain';
import EngineHarness from './dev/EngineHarness';

const buildingMeta: Record<BuildingId, { icon: string; title: string; hint: string }> = {
  bank: { icon: '🏦', title: 'Pine Bank', hint: 'Savings & debt' },
  office: { icon: '🏢', title: 'Town Office', hint: 'Pay & career' },
  home: { icon: '🏡', title: 'Home', hint: 'Rent & budget' },
  hospital: { icon: '🏥', title: 'Health House', hint: 'Coverage & claims' },
  market: { icon: '📈', title: 'Market Hall', hint: 'Investments' },
};

export default function App() {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === 'engine') return <EngineHarness />;
  return <Town />;
}

function Town() {
  const [prompt, setPrompt] = useState('');
  const store = useGameStore();
  const netWorth = useGameStore(selectNetWorth);
  const debt = useGameStore(selectDebtTotal);
  const pending = useGameStore(selectPendingEvent);

  if (!store.game || !store.config) {
    return (
      <main className="landing">
        <div className="title-lockup"><span>✦ A LEARNING ADVENTURE ✦</span><h1>Financial Town</h1><p>Make choices. Move through time. See how your financial story unfolds.</p></div>
        <section>
          <h2>Choose a starting life</h2>
          <div className="scenario-grid">
            {scenarios.map((s, i) => (
              <button key={s.scenarioId} className="scenario-card pixel-panel" onClick={() => store.startGame(s)}>
                <span className="scenario-number">0{i + 1}</span><h3>{s.title}</h3><p>{s.description}</p><strong>Start story →</strong>
              </button>
            ))}
          </div>
        </section>
        <section className="personalize pixel-panel">
          <h2>Explore my situation</h2>
          <p>We’ll map your question to existing game mechanics. Don’t include account numbers or sensitive details.</p>
          <form onSubmit={async (e) => { e.preventDefault(); try { const r = await store.generatePersonalized(prompt); store.startGame(r.config); } catch { /* rendered via store */ } }}>
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. How can I balance debt and saving?" />
            <button className="pixel-button pixel-button--gold" disabled={store.personalizationLoading}>{store.personalizationLoading ? 'Preparing…' : 'Build my scenario'}</button>
          </form>
          {store.personalizationError && <p role="alert">{store.personalizationError}</p>}
          <small>Uses the AI gateway when configured; otherwise a clearly labeled offline mapping.</small>
        </section>
        <footer>Fictional educational simulation · Assumptions are illustrative · Not financial advice</footer>
      </main>
    );
  }

  const game = store.game;
  const fin = store.finishPayload;
  return (
    <main className="game">
      <header className="status-bar pixel-panel">
        <div className="brand">FINANCIAL<br /><b>TOWN</b></div>
        <dl>
          <div><dt>{monthLabel(store.config.startMonth, game.monthIndex)}</dt><dd>Month {game.monthIndex} of {store.config.durationMonths}</dd></div>
          <div><dt>Cash</dt><dd>{usd(game.cash)}</dd></div>
          <div><dt>Savings</dt><dd>{usd(game.savings)}</dd></div>
          <div><dt>Debt</dt><dd>{usd(debt)}</dd></div>
          <div className="net-worth"><dt>Net worth</dt><dd>{usd(netWorth)}</dd></div>
        </dl>
        <button className="pixel-button" onClick={store.openTimeline}>Timeline</button>
      </header>
      <section className="town" aria-label="Financial Town map">
        <div className="cloud cloud-a">☁</div><div className="cloud cloud-b">☁</div>
        {(Object.keys(buildingMeta) as BuildingId[]).map((key) => {
          const b = buildingMeta[key];
          const flagged = game.activeEvents.some((e) => e.buildingTarget === key);
          return (
            <button key={key} className={`building building-${key}`} onClick={() => store.openBuilding(key)}>
              <span className="building-icon">{b.icon}</span><b>{b.title}</b><small>{b.hint}</small>
              {flagged && <i aria-label="Decision waiting">!</i>}
            </button>
          );
        })}
        <div className="road" /><div className="river" />
      </section>
      <div className="bottom-controls"><GameClock status={game.status} onAdvance={store.advanceOneMonth} onPause={store.setPaused} onFinish={store.finishGame} /></div>
      <NotificationStack notifications={game.notifications} onOpenBuilding={store.openBuilding} onViewAll={() => store.setHistoryOpen(true)} onDismiss={store.markNotificationRead} />
      <TimelineDrawer open={store.timelineOpen} entries={game.timeline} onClose={store.closeTimeline} />
      {store.lastActionError && <p role="alert" className="disclaimer">{store.lastActionError}</p>}
      {store.openBuildingId && (
        <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && store.closeBuilding()}>
          <section className="building-panel pixel-panel" role="dialog" aria-modal="true">
            <button className="icon-button close" onClick={store.closeBuilding} aria-label="Close panel">×</button>
            <span className="big-icon">{buildingMeta[store.openBuildingId].icon}</span>
            <h2>{buildingMeta[store.openBuildingId].title}</h2>
            <p>{buildingMeta[store.openBuildingId].hint}</p>
            {game.activeEvents.filter((e) => e.buildingTarget === store.openBuildingId).map((ev) => (
              <EventCard key={ev.id} event={ev} onChoose={(optionId) => store.dispatchAction({ type: 'apply_event_option', eventId: ev.id, optionId })} />
            ))}
            {!pending && <p className="empty-copy">No decision is waiting here. Detailed financial controls (Agent 3 panels) plug into this panel through the shared store.</p>}
          </section>
        </div>
      )}
      {fin && (
        <div className="drawer-backdrop">
          <section className="finish-card pixel-panel" role="dialog">
            <h2>Same strategy, 1,000 other lives</h2>
            <p>You played {fin.finalState.monthIndex} months with {fin.policyLog.length} recorded decisions. Your strategy was replayed across {fin.monteCarlo.pathsCompleted} seeded futures over the same horizon.</p>
            <strong>Observed net worth: {usd(fin.monteCarlo.observedNetWorth)}</strong>
            <p>Median {usd(fin.monteCarlo.median)} · 10th pct {usd(fin.monteCarlo.p10)} · 90th pct {usd(fin.monteCarlo.p90)}</p>
            <p>{fin.monteCarlo.percentileOfObserved !== undefined ? `About ${Math.round(fin.monteCarlo.percentileOfObserved * 100)}% of simulated paths ended below your actual outcome. Luck is part of that — it is not a grade.` : 'Horizon differs from the simulation; no percentile shown.'}</p>
            <p>P(negative net worth) {Math.round(fin.monteCarlo.probabilityNegativeNetWorth * 100)}% · P(emergency borrowing) {Math.round(fin.monteCarlo.probabilityLiquidityShortfall * 100)}%</p>
            <small>Plain-text reveal placeholder; Agent 5 owns the chart. {fin.monteCarlo.assumptionsSummary[0]}</small>
            <div><button className="pixel-button" onClick={store.resetGame}>Return to start</button></div>
          </section>
        </div>
      )}
      <div className="disclaimer">Fictional educational simulation · Illustrative assumptions</div>
    </main>
  );
}
