/**
 * Reveal: "same strategy, 1,000 other lives". Renders ONLY values from the typed
 * MonteCarloResult computed by the engine — nothing is estimated here.
 * Default reveal mounted by App; Agent 5 may replace it via `renderReveal`.
 */
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { histogram } from '@/engine';
import type { FinishPayload } from '@/stores/useGameStore';
import { usd } from '@/components/flow/format';
import './reveal.css';

export const REVEAL_COLORS = { median: '#2f6b1f', band: 'rgba(47, 107, 31, 0.22)', observed: '#b8781c', baseline: '#7a3d12' } as const;

const pct = (x: number) => `${Math.round(x * 100)}%`;
const money = (v: number) => usd(v);

export interface RevealChartProps { payload: FinishPayload; onReset?: () => void }

export function RevealChart({ payload, onReset }: RevealChartProps) {
  const mc = payload.monteCarlo;
  const observed = payload.finalState.netWorthHistory;
  const fan = mc.bands.map((b) => ({ month: b.monthIndex, band: [b.p10, b.p90] as [number, number], median: b.median, observed: observed[b.monthIndex] ?? null }));
  const bins = histogram(mc.endingNetWorths, 20).map((b) => ({ label: `${money(b.start)}`, start: b.start, end: b.end, count: b.count }));
  const cmp = mc.comparison;
  const cmpMax = cmp ? Math.max(Math.abs(cmp.a.median), Math.abs(cmp.b.median), 1) : 1;
  const percentileText = mc.observedHorizonMatches && mc.percentileOfObserved !== undefined
    ? `About ${pct(mc.percentileOfObserved)} of the ${mc.pathsCompleted.toLocaleString()} simulated paths ended below your actual outcome. That reflects luck as much as choices — it is not a grade.`
    : 'The simulated horizon differs from the months you played, so no percentile is shown.';

  return (
    <section className="ft-reveal" aria-label="Simulation results">
      <div className="ft-reveal-hero">
        <span className="ft-reveal-source">Actual play outcome · month {payload.finalState.monthIndex}</span>
        <strong className="ft-reveal-value">{money(mc.observedNetWorth)}</strong>
        <p className="ft-reveal-note">{percentileText}</p>
      </div>

      <div>
        <h3>Same strategy, {mc.pathsCompleted.toLocaleString()} futures</h3>
        <p className="ft-reveal-note">Your {payload.policyLog.length} recorded decisions were replayed from the start over {mc.months} months, each time with different luck (returns, shocks, job loss).</p>
        <dl className="ft-reveal-grid">
          <div className="ft-reveal-stat"><dt>Median ending net worth</dt><dd>{money(mc.median)}</dd></div>
          <div className="ft-reveal-stat"><dt>10th–90th percentile</dt><dd>{money(mc.p10)} to {money(mc.p90)}</dd></div>
          <div className="ft-reveal-stat"><dt>Ended below zero</dt><dd>{pct(mc.probabilityNegativeNetWorth)} of paths</dd></div>
          <div className="ft-reveal-stat"><dt>Needed emergency borrowing</dt><dd>{pct(mc.probabilityLiquidityShortfall)} of paths</dd></div>
        </dl>
      </div>

      <figure>
        <div className="ft-reveal-legend" aria-hidden="true">
          <span style={{ ['--swatch' as string]: REVEAL_COLORS.band }}>10th–90th percentile band</span>
          <span style={{ ['--swatch' as string]: REVEAL_COLORS.median }}>Simulated median</span>
          <span style={{ ['--swatch' as string]: REVEAL_COLORS.observed }}>Your actual run</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={fan} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#91613b' }} label={{ value: 'Month', position: 'insideBottomRight', offset: -2 }} />
            <YAxis tickFormatter={(v: number) => money(v)} width={78} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v, name) => (Array.isArray(v) ? [`${money(Number(v[0]))} – ${money(Number(v[1]))}`, String(name)] : [money(Number(v)), String(name)])} labelFormatter={(m) => `Month ${String(m)}`} isAnimationActive={false} />
            <Area type="stepAfter" dataKey="band" name="10th–90th percentile" stroke="none" fill={REVEAL_COLORS.band} isAnimationActive={false} />
            <Line type="stepAfter" dataKey="median" name="Simulated median" stroke={REVEAL_COLORS.median} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="stepAfter" dataKey="observed" name="Your actual run" stroke={REVEAL_COLORS.observed} strokeWidth={2} dot={false} isAnimationActive={false} />
            <ReferenceLine y={0} stroke="#543c2d" strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
        <figcaption>Net worth over time: the shaded band holds the middle 80% of simulated paths; your actual run is drawn from the engine's recorded history.</figcaption>
      </figure>

      <figure>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={bins} margin={{ top: 8, right: 12, bottom: 4, left: 4 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="start" tickFormatter={(v: number) => money(v)} tickLine={false} axisLine={{ stroke: '#91613b' }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} width={36} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => [`${String(v)} paths`, 'Count']} labelFormatter={(_l, p) => { const d = p?.[0]?.payload as { start: number; end: number } | undefined; return d ? `${money(d.start)} to ${money(d.end)}` : ''; }} isAnimationActive={false} />
            <Bar dataKey="count" name="Paths" fill={REVEAL_COLORS.median} isAnimationActive={false} />
            {mc.observedHorizonMatches && <ReferenceLine x={bins.find((b) => mc.observedNetWorth >= b.start && mc.observedNetWorth < b.end)?.start ?? bins[bins.length - 1]?.start} stroke={REVEAL_COLORS.observed} strokeWidth={2} label={{ value: 'You', position: 'top', fill: REVEAL_COLORS.observed }} />}
          </BarChart>
        </ResponsiveContainer>
        <figcaption>Distribution of ending net worth across all simulated paths. The amber marker is your actual outcome.</figcaption>
      </figure>

      {cmp && (
        <div>
          <h3>Same luck, different choices</h3>
          <p className="ft-reveal-note">Each simulated future was also replayed with the archetype's default policy and no decisions, using the identical luck. Median difference: <strong>{cmp.pairedMedianDifference >= 0 ? '+' : '−'}{money(Math.abs(cmp.pairedMedianDifference))}</strong>; your strategy ended higher in {pct(cmp.probabilityAOutperformsB)} of paired futures.</p>
          <div className="ft-reveal-compare" role="list">
            {[{ label: cmp.labelA, v: cmp.a.median, c: REVEAL_COLORS.median }, { label: cmp.labelB, v: cmp.b.median, c: REVEAL_COLORS.baseline }].map((r) => (
              <div className="ft-reveal-bar" role="listitem" key={r.label}>
                <span>{r.label}</span>
                <i style={{ ['--swatch' as string]: r.c, width: `${Math.max(2, (Math.abs(r.v) / cmpMax) * 100)}%` }} aria-hidden="true" />
                <span>{money(r.v)} median</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {payload.explanation && (
        <div className="ft-reveal-explain">
          <span className="ft-reveal-source">{payload.explanation.source === 'ai' ? 'AI explanation' : 'Offline explanation (template)'}</span>
          <p className="ft-reveal-note">{payload.explanation.text}</p>
        </div>
      )}

      <details>
        <summary>Table view: net worth bands by month</summary>
        <table>
          <thead><tr><th>Month</th><th>10th pct</th><th>Median</th><th>90th pct</th><th>Your run</th></tr></thead>
          <tbody>
            {mc.bands.filter((b) => b.monthIndex % 3 === 0 || b.monthIndex === mc.months).map((b) => (
              <tr key={b.monthIndex}><td>{b.monthIndex}</td><td>{money(b.p10)}</td><td>{money(b.median)}</td><td>{money(b.p90)}</td><td>{observed[b.monthIndex] !== undefined ? money(observed[b.monthIndex]!) : '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </details>

      <details>
        <summary>Simulation assumptions</summary>
        <ul>{mc.assumptionsSummary.map((note) => <li key={note}>{note}</li>)}</ul>
        <p className="ft-reveal-note">Seed {mc.seed} · {mc.pathsCompleted} paths · {mc.replayFallbacks} replay fallbacks · computed in {mc.elapsedMs} ms.</p>
      </details>

      {onReset && <div><button className="pixel-button pixel-button--gold" onClick={onReset}>Choose a new story →</button></div>}
    </section>
  );
}

export default RevealChart;
