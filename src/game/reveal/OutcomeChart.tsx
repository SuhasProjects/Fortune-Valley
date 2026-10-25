import { useEffect, useId, useState, type CSSProperties } from 'react'
import { usd } from '@/components/flow/format'
import type { ChartLines } from './ending-contract'

const endingKeys = ['p10', 'median', 'p90', 'yourEvents'] as const

/** Rounds a tick step up to 1, 2, 2.5 or 5 times a power of ten so axis labels are round dollar amounts. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1
  const power = 10 ** Math.floor(Math.log10(raw))
  return ([1, 2, 2.5, 5, 10].find(unit => unit * power >= raw) ?? 10) * power
}

/** Display scaling only. The y axis is gain or loss against the starting net worth, so $0 (the start) is the bold
 * middle baseline. The domain is symmetric around zero and snapped to a round tick step; charts that share one domain
 * (the what-if pair) are directly comparable. Every ending comes from the engine. */
export function sharedYDomain(...charts: ChartLines[]): [number, number] {
  const deltas = charts.flatMap(lines => endingKeys.map(key => lines[key] - lines.start)).filter(Number.isFinite)
  const reach = Math.max(0, ...deltas.map(Math.abs))
  const step = niceStep(reach * 1.08 / 2)
  return [-2 * step, 2 * step]
}

const series = [
  { key: 'p10', label: 'Unlucky (10th percentile)', color: 'var(--c-money-down)', order: 0 },
  { key: 'median', label: 'Typical (median)', color: 'var(--c-outline)', order: 1 },
  { key: 'p90', label: 'Lucky (90th percentile)', color: 'var(--c-money-up)', order: 2 },
  { key: 'yourEvents', label: 'What actually happened', color: 'var(--c-path-edge-dark)', order: 3 },
] as const

/** Tick labels are gains and losses against the start: -$2,000 / $0 / +$1,500. */
const tickLabel = (delta: number) => (Math.round(delta) === 0 ? '$0' : usd(delta, true))

export interface OutcomeChartProps { lines: ChartLines; yDomain: [number, number]; title: string; highlightLabel?: string }

// viewBox geometry (SVG units). The plot box holds every line, marker and wedge; labels live in the column to its right,
// or (compact, phones) in an HTML list under the chart so the plot can shrink to the screen without a sideways scroll.
const W = 680, H = 326
const plot = { left: 100, right: 340, top: 18, bottom: 268 }
const labelX = plot.right + 22, labelGap = 44, stroke = 2.5
const COMPACT = '(max-width: 639px)'

function useCompact() {
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(COMPACT).matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(COMPACT)
    const update = () => setCompact(query.matches)
    update(); query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return compact
}

export function OutcomeChart({ lines, yDomain, title, highlightLabel }: OutcomeChartProps) {
  const id = useId()
  const compact = useCompact()
  const [active, setActive] = useState<string | null>(null)
  const [low, high] = yDomain
  if (![...Object.values(lines), low, high].every(Number.isFinite) || high <= low) return <p role="alert">These results could not be displayed. Try finishing the story again.</p>
  const y = (delta: number) => plot.bottom - ((delta - low) / (high - low)) * (plot.bottom - plot.top)
  const yEnd = (key: typeof endingKeys[number]) => y(Math.min(high, Math.max(low, lines[key] - lines.start)))
  const zeroY = y(0)
  const ends = series.map(line => ({ ...line, label: line.key === 'yourEvents' && highlightLabel ? highlightLabel : line.label, value: lines[line.key], endY: yEnd(line.key), labelY: yEnd(line.key) })).sort((a, b) => a.endY - b.endY)
  // Nudge end labels apart vertically so none overlap, then keep the stack inside the plot's height.
  ends.forEach((line, index) => { line.labelY = Math.max(line.labelY, index === 0 ? plot.top + 10 : ends[index - 1]!.labelY + labelGap) })
  for (let index = ends.length - 1; index >= 0; index--) ends[index]!.labelY = Math.min(ends[index]!.labelY, index === ends.length - 1 ? plot.bottom - 14 : ends[index + 1]!.labelY - labelGap)
  const step = (high - low) / 4
  const ticks = Array.from({ length: 5 }, (_, index) => low + step * index)
  const byOrder = [...ends].sort((a, b) => a.order - b.order)
  const toggle = (key: string) => setActive(active === key ? null : key)
  const describe = (line: typeof ends[number]) => `${line.label}: ${usd(line.value)} after ${lines.months} months`
  const width = compact ? plot.right + 48 : W
  return <figure className={`fv-outcome-chart ${compact ? 'fv-outcome-chart--compact' : ''}`} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`}>{title}</figcaption>
    <div className="fv-chart-scroll"><svg viewBox={`0 0 ${width} ${H}`} role="group" aria-label={`${title}: four ending net worth lines`} shapeRendering="geometricPrecision">
      <title>Straight lines from the starting net worth to each ending after {lines.months} months, shown as gain or loss against the start.</title>
      <defs><clipPath id={`${id}-clip`}><rect x={plot.left - 6} y={plot.top - 6} width={plot.right - plot.left + 12} height={plot.bottom - plot.top + 12}/></clipPath></defs>
      {ticks.map((delta, index) => <g key={index}>
        {Math.round(delta) !== 0 && <line x1={plot.left} x2={plot.right} y1={y(delta)} y2={y(delta)} className="fv-chart-grid" shapeRendering="crispEdges"/>}
        <text className={`fv-axis-tick ${Math.round(delta) === 0 ? 'fv-axis-tick--zero' : ''}`} x={plot.left - 8} y={y(delta) + 6} textAnchor="end">{tickLabel(delta)}</text>
      </g>)}
      <line x1={plot.left} x2={plot.right} y1={zeroY} y2={zeroY} className="fv-chart-zero" shapeRendering="crispEdges"/>
      <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} className="fv-chart-axis" shapeRendering="crispEdges"/>
      <line x1={plot.right} x2={plot.right} y1={zeroY - 6} y2={zeroY + 6} className="fv-chart-axis" shapeRendering="crispEdges"/>
      <g clipPath={`url(#${id}-clip)`}>
        <polygon points={`${plot.left},${zeroY} ${plot.right},${yEnd('p10')} ${plot.right},${yEnd('p90')}`} fill="var(--c-leaf-light)" fillOpacity=".25"/>
        {byOrder.map(line => <g key={line.key} className={`fv-outcome-line ${active && active !== line.key ? 'fv-line-muted' : ''}`} style={{ '--line-order': line.order } as CSSProperties}>
          <line className="fv-line-draw" x1={plot.left} y1={zeroY} x2={plot.right} y2={line.endY} pathLength="1" stroke={line.color} strokeWidth={stroke} strokeLinecap="butt" onMouseEnter={() => setActive(line.key)} onMouseLeave={() => setActive(null)}/>
          {line.key === 'yourEvents'
            ? <rect x={plot.right - 5} y={line.endY - 5} width="10" height="10" fill="var(--c-gold)" stroke="var(--c-outline)" strokeWidth="1.5" shapeRendering="crispEdges"/>
            : <circle cx={plot.right} cy={line.endY} r="3.5" fill={line.color}/>}
        </g>)}
        <circle cx={plot.left} cy={zeroY} r="4" fill="var(--c-paper)" stroke="var(--c-ink)" strokeWidth="2"/>
      </g>
      {!compact && byOrder.map(line => <g key={line.key} className={active && active !== line.key ? 'fv-line-muted' : ''}>
        <line x1={plot.right + 6} y1={line.endY} x2={labelX - 4} y2={line.labelY} stroke={line.color} strokeWidth="1"/>
        <g role="button" tabIndex={0} aria-label={describe(line)} onFocus={() => setActive(line.key)} onBlur={() => setActive(null)} onMouseEnter={() => setActive(line.key)} onMouseLeave={() => setActive(null)} onClick={() => toggle(line.key)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(line.key) } }}>
          <title>{describe(line)}</title>
          <rect x={labelX - 4} y={line.labelY - 16} width={W - labelX + 2} height="42" fill="var(--c-paper)" fillOpacity={active === line.key ? 1 : 0}/>
          <text x={labelX} y={line.labelY} fill="var(--c-outline)" className={line.key === 'yourEvents' ? 'fv-chart-your-label' : ''}>{line.label}</text>
          <text x={labelX} y={line.labelY + 20} fill="var(--c-ink)">{usd(line.value)} ({tickLabel(line.value - lines.start)})</text>
        </g>
      </g>)}
      <text className="fv-axis-x" x={plot.left} y={plot.bottom + 27} textAnchor="middle">Start ({usd(lines.start)})</text>
      <text className="fv-axis-x" x={plot.right} y={plot.bottom + 27} textAnchor="middle">Month {lines.months}</text>
      <text className="fv-axis-title" x={(plot.left + plot.right) / 2} y={H - 5} textAnchor="middle">Months played</text>
      <text className="fv-axis-title" transform={`translate(16 ${(plot.top + plot.bottom) / 2}) rotate(-90)`} textAnchor="middle">Gain or loss vs start</text>
    </svg></div>
    {compact && <ul className="fv-chart-legend">{byOrder.map(line => <li key={line.key} className={active && active !== line.key ? 'fv-line-muted' : ''}>
      <button type="button" aria-label={describe(line)} aria-pressed={active === line.key} style={{ '--line-color': line.color } as CSSProperties} onFocus={() => setActive(line.key)} onBlur={() => setActive(null)} onClick={() => toggle(line.key)}>
        <span className="fv-chart-legend__swatch" aria-hidden="true"/><span className={line.key === 'yourEvents' ? 'fv-chart-your-label' : ''}>{line.label}</span><strong>{usd(line.value)} ({tickLabel(line.value - lines.start)})</strong>
      </button></li>)}</ul>}
    <details className="fv-chart-table"><summary>Table: {title}</summary><table><caption>Starting net worth {usd(lines.start)} and ending net worth after {lines.months} months.</caption><thead><tr><th scope="col">Future</th><th scope="col">Ending net worth</th><th scope="col">Change from start</th></tr></thead><tbody>{byOrder.map(line => <tr key={line.key}><th scope="row">{line.label}</th><td>{usd(line.value)}</td><td>{tickLabel(line.value - lines.start)}</td></tr>)}</tbody></table></details>
  </figure>
}
