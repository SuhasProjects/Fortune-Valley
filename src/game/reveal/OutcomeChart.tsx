import { useId, useState, type CSSProperties } from 'react'
import { usd } from '@/components/flow/format'
import { useTitleScale } from '../title/contracts'
import type { ChartLines } from './ending-contract'

/** Display scaling only. Every ending and change shown in charts comes from the engine. */
export function sharedYDomain(...charts: ChartLines[]): [number, number] {
  const values = charts.flatMap(lines => [lines.start, lines.p10, lines.median, lines.p90, lines.yourEvents]).filter(Number.isFinite)
  const min = Math.min(...values), max = Math.max(...values)
  if (!values.length) return [-1, 1]
  const padding = Math.max((max - min) * .08, 1)
  return [min - padding, max + padding]
}

const labels = [
  { key: 'p10', label: 'Unlucky (10th percentile)', color: 'var(--c-money-down)', weight: 1, order: 0 },
  { key: 'median', label: 'Typical (median)', color: 'var(--c-outline)', weight: 2, order: 1 },
  { key: 'p90', label: 'Lucky (90th percentile)', color: 'var(--c-money-up)', weight: 1, order: 2 },
  { key: 'yourEvents', label: 'What actually happened', color: 'var(--c-gold)', weight: 3, order: 3 },
] as const

export interface OutcomeChartProps { lines: ChartLines; yDomain: [number, number]; title: string; highlightLabel?: string }

export function OutcomeChart({ lines, yDomain, title, highlightLabel }: OutcomeChartProps) {
  const id = useId()
  const px = useTitleScale()
  const [active, setActive] = useState<string | null>(null)
  const [low, high] = yDomain
  const plot = { left: 90, right: 390, top: 25, bottom: 250 }
  const y = (value: number) => plot.bottom - ((value - low) / (high - low || 1)) * (plot.bottom - plot.top)
  const startY = y(lines.start)
  const ends = labels.map(line => ({ ...line, label: line.key === 'yourEvents' && highlightLabel ? highlightLabel : line.label, value: lines[line.key], labelY: y(lines[line.key]) })).sort((a, b) => a.labelY - b.labelY)
  ends.forEach((line, index) => { line.labelY = Math.max(line.labelY, index === 0 ? 22 : ends[index - 1]!.labelY + 46) })
  for (let index = ends.length - 1; index >= 0; index--) ends[index]!.labelY = Math.min(ends[index]!.labelY, index === ends.length - 1 ? 240 : ends[index + 1]!.labelY - 46)
  const ticks = Array.from({ length: 5 }, (_, index) => low + (high - low) * index / 4)
  if (![...Object.values(lines), low, high].every(Number.isFinite)) return <p role="alert">These results could not be displayed. Try finishing the story again.</p>
  return <figure className="fv-outcome-chart" aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`}>{title}</figcaption>
    <div className="fv-chart-scroll"><svg viewBox="0 0 740 315" role="group" aria-label={`${title}: four ending net worth lines`} shapeRendering="crispEdges">
      <title>Net worth from month 0 to month {lines.months}. Straight lines connect the start and endings.</title>
      {ticks.map((value, index) => <g key={index}><line x1={plot.left} x2={plot.right} y1={y(value)} y2={y(value)} className="fv-chart-grid"/><text className="fv-axis-tick" x={plot.left - 10} y={y(value) + 5} textAnchor="end">{usd(value)}</text></g>)}
      {low < 0 && high > 0 && <g><line x1={plot.left} x2={plot.right} y1={y(0)} y2={y(0)} className="fv-chart-zero"/><text x={plot.left - 10} y={y(0) + 5} textAnchor="end">$0</text></g>}
      <polygon points={`${plot.left},${startY} ${plot.right},${y(lines.p10)} ${plot.right},${y(lines.p90)}`} fill="var(--c-leaf-light)" fillOpacity=".25"/>
      {[...ends].sort((a,b) => a.order - b.order).map(line => <g key={line.key} className={`fv-outcome-line ${active && active !== line.key ? 'fv-line-muted' : ''}`} style={{ '--line-order': line.order } as CSSProperties}>
        {line.key === 'yourEvents' && <line className="fv-line-draw" x1={plot.left} y1={startY} x2={plot.right} y2={y(line.value)} pathLength="1" stroke="var(--c-outline)" strokeWidth={px * 4}/>}
        <line className="fv-line-draw" x1={plot.left} y1={startY} x2={plot.right} y2={y(line.value)} pathLength="1" stroke={line.color} strokeWidth={px * line.weight} onMouseEnter={() => setActive(line.key)} onMouseLeave={() => setActive(null)}/>
        <line x1={plot.right + 5} y1={y(line.value)} x2={plot.right + 24} y2={line.labelY} stroke={line.color} strokeWidth="2"/>
        {line.key === 'yourEvents' && <image href="/art/title/favicon.png" x={plot.right - 7} y={y(line.value) - 7} width="14" height="14"/>}
        <g role="button" tabIndex={0} aria-label={`${line.label}: ${usd(line.value)} after ${lines.months} months`} onFocus={() => setActive(line.key)} onBlur={() => setActive(null)} onMouseEnter={() => setActive(line.key)} onMouseLeave={() => setActive(null)} onClick={() => setActive(active === line.key ? null : line.key)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActive(active === line.key ? null : line.key) } }}>
          <title>{line.label}: {usd(line.value)} after {lines.months} months</title>
          <rect x={plot.right + 25} y={line.labelY - 16} width="318" height="40" fill="var(--c-paper)" fillOpacity={active === line.key ? 1 : 0}/>
          <text x={plot.right + 32} y={line.labelY} fill="var(--c-outline)" className={line.key === 'yourEvents' ? 'fv-chart-your-label' : ''}>{line.label}</text>
          <text x={plot.right + 32} y={line.labelY + 20} fill="var(--c-outline)">{usd(line.value)}</text>
        </g>
      </g>)}
      <circle cx={plot.left} cy={startY} r="4" fill="var(--c-outline)"/>
      <text x={plot.left} y="283">Start {usd(lines.start)}</text><text x={plot.right} y="283" textAnchor="end">Month {lines.months}</text>
      <text x="240" y="308" textAnchor="middle">Month · Net worth (USD)</text>
    </svg></div>
    <p className="fv-chart-note">The shaded spread holds 8 in 10 futures. Lines connect the start and ending, not monthly balances.</p>
    <details className="fv-chart-table"><summary>Table: {title}</summary><table><caption>Starting net worth {usd(lines.start)}. Ending net worth after {lines.months} months.</caption><thead><tr><th scope="col">Future</th><th scope="col">Ending net worth</th></tr></thead><tbody>{[...ends].sort((a,b) => a.order - b.order).map(line => <tr key={line.key}><th scope="row">{line.label}</th><td>{usd(line.value)}</td></tr>)}</tbody></table></details>
  </figure>
}
