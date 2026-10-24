/**
 * Plain-text engine harness / minimal reveal route. Agent 1 dev tool.
 * Not a product screen. It exists so every agent can see real engine output
 * (no fake numbers) before the town/panels/reveal exist.
 */
import { useMemo, useState } from 'react';
import { ARCHETYPES, archetypeConfig } from '@/config/archetypes';
import { createGame, advanceMonth, applyAction, runMonteCarlo, netWorthOf, monthLabel } from '@/engine';
import type { ArchetypeId, GameState, MonteCarloResult } from '@/types/domain';

const fmt = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');

export default function EngineHarness() {
  const [archetype, setArchetype] = useState<ArchetypeId>('entry_worker');
  const [seed, setSeed] = useState(42);
  const config = useMemo(() => archetypeConfig(archetype, seed, { durationMonths: 24 }), [archetype, seed]);
  const [state, setState] = useState<GameState>(() => createGame(config));
  const [mc, setMc] = useState<MonteCarloResult | null>(null);
  const [err, setErr] = useState('');

  const reset = (a: ArchetypeId, s: number) => {
    setArchetype(a); setSeed(s); setMc(null); setErr('');
    setState(createGame(archetypeConfig(a, s, { durationMonths: 24 })));
  };
  const step = (n: number) => {
    let s = state;
    for (let i = 0; i < n && s.status !== 'finished'; i++) s = advanceMonth(s);
    setState(s);
  };
  const act = (a: Parameters<typeof applyAction>[1]) => {
    const r = applyAction(state, a);
    if (!r.ok) setErr(`${r.code}: ${r.message}`); else { setErr(''); setState(r.state); }
  };

  return (
    <div style={{ padding: 16, fontFamily: 'monospace', color: 'var(--ft-ink-light)', fontSize: 13 }}>
      <h1 style={{ fontSize: 16 }}>Financial Town — engine harness (dev only)</h1>
      <p>{state.assumptions.disclaimer}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.values(ARCHETYPES).map((a) => (
          <button key={a.id} onClick={() => reset(a.id, seed)} disabled={a.id === archetype}>{a.title}</button>
        ))}
        <label>seed <input type="number" value={seed} onChange={(e) => reset(archetype, Number(e.target.value))} style={{ width: 80 }} /></label>
      </div>
      <p>
        {monthLabel(state.startMonth, state.monthIndex)} · month {state.monthIndex}/{state.durationMonths} · {state.status} · cash {fmt(state.cash)} · savings {fmt(state.savings)} ·
        invest {fmt(state.investments.stock + state.investments.bond + state.investments.etf)} · debt {fmt(state.debts.reduce((a, d) => a + d.balance, 0))} · <b>net worth {fmt(netWorthOf(state))}</b>
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => step(1)} disabled={state.status === 'finished'}>Next month</button>
        <button onClick={() => step(12)} disabled={state.status === 'finished'}>+12 months</button>
        <button onClick={() => act({ type: 'set_allocation', allocation: { stock: 0.6, bond: 0.1, etf: 0.3 } })}>Alloc 60/10/30</button>
        <button onClick={() => act({ type: 'set_contributions', savingsContributionPerMonth: 400, investmentContributionPerMonth: 300 })}>Save 400 / invest 300</button>
        <button onClick={() => act({ type: 'set_insurance', line: 'health', planId: null })}>Drop health insurance</button>
        <button onClick={() => act({ type: 'set_insurance', line: 'health', planId: 'health_plus' })}>Health Plus</button>
        <button onClick={() => act({ type: 'finish' })} disabled={state.status === 'finished'}>Finish</button>
        <button onClick={() => setMc(runMonteCarlo(config, state.policyLog, state, { paths: 1000 }))}>Run Monte Carlo (1000)</button>
      </div>
      {err && <p style={{ color: 'var(--ft-negative)' }}>Rejected: {err}</p>}
      {mc && (
        <pre style={{ background: '#111', padding: 8, whiteSpace: 'pre-wrap' }}>
{`Monte Carlo (same strategy, ${mc.pathsCompleted} alternate luck paths, ${mc.months} months, ${mc.elapsedMs}ms)
median ${fmt(mc.median)} · p10 ${fmt(mc.p10)} · p90 ${fmt(mc.p90)}
P(negative net worth) ${(mc.probabilityNegativeNetWorth * 100).toFixed(1)}% · P(liquidity shortfall) ${(mc.probabilityLiquidityShortfall * 100).toFixed(1)}%
observed ${fmt(mc.observedNetWorth)} ${mc.observedHorizonMatches && mc.percentileOfObserved !== undefined ? `→ ${(mc.percentileOfObserved * 100).toFixed(0)}% of paths ended below this` : '(horizon differs; not placed on distribution)'}
replay fallbacks: ${mc.replayFallbacks}
${mc.assumptionsSummary.join('\n')}`}
        </pre>
      )}
      <h2 style={{ fontSize: 14 }}>Notifications (latest 8)</h2>
      <ul>{state.notifications.slice(-8).reverse().map((n) => <li key={n.id}>[{n.kind}] m{n.monthIndex}: {n.summary}</li>)}</ul>
      <h2 style={{ fontSize: 14 }}>Timeline</h2>
      <ul>{state.timeline.slice(-12).reverse().map((t) => <li key={t.id}>m{t.monthIndex} {t.type}: {t.description} (NW {fmt(t.netWorthAfter)})</li>)}</ul>
      <h2 style={{ fontSize: 14 }}>Ledger this month</h2>
      <ul>{state.ledger.filter((l) => l.monthIndex === state.monthIndex - 1).map((l) => <li key={l.id}>{l.account} {l.category} {fmt(l.amountSigned)} — {l.description}</li>)}</ul>
    </div>
  );
}
