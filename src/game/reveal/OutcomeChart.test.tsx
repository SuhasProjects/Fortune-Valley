// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { OutcomeChart, sharedYDomain } from './OutcomeChart'
import { ChangeStrip, changeSentence } from './ChangeStrip'
import type { OutcomeLines, WhatIfResult } from './ending-contract'
import { usd } from '@/components/flow/format'

afterEach(cleanup)
const lines: OutcomeLines = { months:24, start:-14000, p10:-1000, median:9000, p90:17000, yourEvents:12340, spread:18000 }
it('labels all four exact engine endings and uses straight SVG lines', () => {
  const { container } = render(<OutcomeChart lines={lines} yDomain={sharedYDomain(lines)} title="Your futures"/>)
  for (const value of [lines.p10,lines.median,lines.p90,lines.yourEvents]) expect(screen.getAllByText(usd(value)).length).toBeGreaterThan(0)
  expect(screen.getAllByRole('button')).toHaveLength(4)
  expect(container.querySelectorAll('line.fv-line-draw')).toHaveLength(5) // Four lines plus the gold line's dark underlay.
  expect(container.innerHTML).not.toContain('NaN')
})
it('uses a shared domain covering both charts, including negative and flat results', () => {
  const changed = { ...lines, p10:-42000, p90:60000 }
  const [low,high] = sharedYDomain(lines,changed)
  expect(low).toBeLessThan(changed.p10); expect(high).toBeGreaterThan(changed.p90)
  const flat = { ...lines,start:0,p10:0,median:0,p90:0,yourEvents:0 }
  expect(sharedYDomain(flat)).toEqual([-1,1])
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
