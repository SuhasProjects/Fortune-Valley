// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { fixtureConfig, fixtureFinishedState, fixtureMonteCarlo } from '@/fixtures'
import type { WhatIfResult } from './ending-contract'

const mocks = vi.hoisted(() => ({ run:vi.fn() }))
vi.mock('@/engine', async importOriginal => ({ ...await importOriginal<object>(), hasPolicyDecisions:() => true,
  listDecisions:() => [{id:'0',logIndex:0,monthIndex:0,label:'Month 0 · Save $300/month',alternatives:[{id:'undo',label:'Keep what you had before'},{id:'half',label:'Save half'}]}], runWhatIfAsync:mocks.run,
}))
import { WhatIfSection } from './WhatIfSection'

afterEach(() => { cleanup(); mocks.run.mockReset() })
it('aborts the earlier selection and ignores its late response', async () => {
  const pending: { resolve:(value:WhatIfResult) => void; signal:AbortSignal }[] = []
  mocks.run.mockImplementation((_input,signal) => new Promise<WhatIfResult>(resolve => pending.push({resolve,signal})))
  const original = {months:2,start:0,p10:100,median:200,p90:300,yourEvents:250,spread:200}
  const response = (label:string):WhatIfResult => ({original,changed:original,delta:{p10:0,median:0,p90:0,yourEvents:0,spread:0},alternativeLabel:label,decisionLabel:'Savings',yourEventsComparable:true,replayFallbacks:0})
  render(<WhatIfSection payload={{config:fixtureConfig,finalState:fixtureFinishedState,policyLog:fixtureFinishedState.policyLog,monteCarlo:fixtureMonteCarlo}} original={original}/>)
  expect(pending).toHaveLength(1)
  fireEvent.change(screen.getByLabelText('Instead…'),{target:{value:'half'}})
  expect(pending[0]!.signal.aborted).toBe(true)
  expect(pending).toHaveLength(2)
  await act(async () => pending[1]!.resolve(response('Save half')))
  expect(screen.getByText('If you had: Save half')).toBeTruthy()
  await act(async () => pending[0]!.resolve(response('Keep what you had before')))
  expect(screen.queryByText('If you had: Keep what you had before')).toBeNull()
  expect(screen.getByText('If you had: Save half')).toBeTruthy()
  const charts = screen.getAllByRole('group', {name:/four ending net worth lines/})
  expect(charts[0]!.querySelectorAll('.fv-axis-tick')[0]!.textContent).toBe(charts[1]!.querySelectorAll('.fv-axis-tick')[0]!.textContent)
})
