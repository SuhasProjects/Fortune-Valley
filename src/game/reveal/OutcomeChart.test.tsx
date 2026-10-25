// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LABEL_COLUMN, OutcomeChart, estimateTextWidth, fitLabel, niceStep, sharedYDomain } from './OutcomeChart'
import { ChangeStrip, changeSentence } from './ChangeStrip'
import type { OutcomeLines, WhatIfResult } from './ending-contract'
import { usd } from '@/components/flow/format'

afterEach(cleanup)
const lines: OutcomeLines = { months:24, start:-14000, p10:-1000, median:9000, p90:17000, yourEvents:12340, spread:18000 }
it('labels all four exact engine endings with plain straight SVG lines kept inside the plot box', () => {
  const { container } = render(<OutcomeChart lines={lines} yDomain={sharedYDomain(lines)} title="Your futures"/>)
  for (const value of [lines.p10,lines.median,lines.p90,lines.yourEvents]) expect(screen.getAllByText(new RegExp(usd(value).replace('$','\\$'))).length).toBeGreaterThan(0)
  expect(screen.getAllByRole('button')).toHaveLength(4)
  const drawn = [...container.querySelectorAll('line.fv-line-draw')]
  expect(drawn).toHaveLength(4) // One plain line per ending; no thick underlay for the "what actually happened" line.
  expect(new Set(drawn.map(line => line.getAttribute('stroke-width'))).size).toBe(1)
  expect(drawn[0]!.closest('[clip-path]')).toBeTruthy()
  const [low,high] = sharedYDomain(lines)
  const ys = drawn.map(line => Number(line.getAttribute('y2')))
  expect(Math.min(...ys)).toBeGreaterThanOrEqual(18); expect(Math.max(...ys)).toBeLessThanOrEqual(268)
  expect(low).toBe(-high)
  // Ticks are gains and losses against the start, with $0 (the start) bold in the middle.
  const ticks = [...container.querySelectorAll('.fv-axis-tick')].map(tick => tick.textContent)
  expect(ticks).toHaveLength(5); expect(ticks[2]).toBe('$0'); expect(ticks[0]!.startsWith('-$')).toBe(true); expect(ticks[4]!.startsWith('+$')).toBe(true)
  expect(container.querySelector('.fv-axis-tick--zero')?.textContent).toBe('$0')
  expect(container.querySelector('.fv-chart-zero')).toBeTruthy()
  expect(container.textContent).not.toContain('8 in 10 futures')
  expect(container.innerHTML).not.toContain('NaN')
})
it('keeps every end label inside the label column, with the full text in the accessible name', () => {
  const extreme = { ...lines, start:-999999, p10:-9999999, median:999999, p90:9999999, yourEvents:-9999999 }
  for (const highlight of [undefined, 'You, this choice']) {
    const { container, unmount } = render(<OutcomeChart lines={extreme} yDomain={sharedYDomain(extreme)} title="Wide" highlightLabel={highlight}/>)
    const texts = [...container.querySelectorAll('[role=button] > text')]
    expect(texts).toHaveLength(8)
    for (const text of texts) expect(estimateTextWidth(text.textContent ?? ''), text.textContent ?? '').toBeLessThanOrEqual(LABEL_COLUMN)
    expect(container.querySelector('[role=button][aria-label^="You"]')?.getAttribute('aria-label')).toContain(highlight ?? 'You:')
    unmount()
  }
  for (const label of ['Unlucky (10th)','Typical','Lucky (90th)','You','You, this choice']) expect(fitLabel(label)).toBe(label)
  const long = fitLabel('Your exact events, with this change, and more')
  expect(long.endsWith('…')).toBe(true); expect(estimateTextWidth(long)).toBeLessThanOrEqual(LABEL_COLUMN)
})
it('nudges end labels apart so none overlap', () => {
  const crowded = { ...lines, p10:12000, median:12010, p90:12020, yourEvents:12030 }
  const { container } = render(<OutcomeChart lines={crowded} yDomain={sharedYDomain(crowded)} title="Crowded"/>)
  const ys = [...container.querySelectorAll('[role=button] > text:first-of-type')].map(text => Number(text.getAttribute('y'))).sort((a,b) => a-b)
  for (let index = 1; index < ys.length; index++) expect(ys[index]! - ys[index-1]!).toBeGreaterThanOrEqual(44)
})
it('uses one symmetric, round-stepped domain for both charts, including negative and flat results', () => {
  const changed = { ...lines, p10:-42000, p90:60000 }
  const [low,high] = sharedYDomain(lines,changed)
  expect(low).toBeLessThan(changed.p10 - lines.start); expect(high).toBeGreaterThan(changed.p90 - lines.start)
  expect(low).toBe(-high); expect(sharedYDomain(lines,changed)).toEqual(sharedYDomain(changed,lines))
  expect(niceStep(3400)).toBe(5000); expect(niceStep(1000)).toBe(1000); expect(niceStep(1001)).toBe(2000); expect(niceStep(0)).toBe(1)
  const flat = { ...lines,start:0,p10:0,median:0,p90:0,yourEvents:0 }
  expect(sharedYDomain(flat)).toEqual([-2,2])
})
it('keeps zero changes neutral and covers all four median/spread sign combinations', () => {
  expect(changeSentence(1,-1)).toContain('safer and richer')
  expect(changeSentence(1,1)).toContain('wider')
  expect(changeSentence(-1,-1)).toContain('narrower')
  expect(changeSentence(-1,1)).toContain('more spread out')
  expect(changeSentence(0,0)).toContain('stayed the same')
  const result: WhatIfResult = { original:lines,changed:lines,decisionLabel:'Savings',alternativeLabel:'Undo',delta:{p10:0,median:1240,p90:0,yourEvents:-310,spread:-2000},yourEventsComparable:false,replayFallbacks:2 }
  const { container } = render(<ChangeStrip result={result}/>)
  expect(screen.getByText('+$1,240')).toBeTruthy(); expect(screen.getByText('-$310')).toBeTruthy()
  expect(screen.getByText('Narrower by $2,000')).toBeTruthy()
  expect(screen.getByText('estimated from a replay of your game')).toBeTruthy()
  expect(container.querySelector('[data-direction="-1"]')).toBeTruthy()
})
