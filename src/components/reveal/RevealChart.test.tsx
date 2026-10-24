// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RevealChart } from './RevealChart'
import { fixtureConfig, fixtureFinishedState, fixtureMonteCarlo } from '@/fixtures'
import { usd } from '@/components/flow/format'

afterEach(cleanup)
it('mounts the new full-screen results through the legacy App contract', () => {
  const payload = { config:fixtureConfig,finalState:fixtureFinishedState,policyLog:fixtureFinishedState.policyLog,monteCarlo:fixtureMonteCarlo,explanation:{text:'Template text.',source:'fallback' as const} }
  render(<RevealChart payload={payload} onReset={() => {}}/>)
  expect(screen.getByRole('main', {name:'Simulation results'})).toBeTruthy()
  expect(screen.getByRole('heading', {name:'Same strategy, 300 futures'})).toBeTruthy()
  expect(screen.getAllByText(usd(fixtureMonteCarlo.observedNetWorth)).length).toBeGreaterThan(0)
  expect(screen.getByText('Offline explanation (template)')).toBeTruthy()
  expect(screen.getByRole('button', {name:'Choose a new story'})).toBeTruthy()
  expect(screen.queryByText('Distribution of ending net worth')).toBeNull()
})
