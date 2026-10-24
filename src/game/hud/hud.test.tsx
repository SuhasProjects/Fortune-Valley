// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createGame } from '../../engine'
import { scenarios } from '../../data/scenarios'
import { selectDebtTotal, selectNetWorth, useGameStore } from '../../stores/useGameStore'
import { usd, monthLabel } from '../../components/flow/format'
import { Hud } from './Hud'
import { ControlBar, type ControlBarProps } from './ControlBar'
import { StatusTag } from './StatusTag'
import { HudFooter } from './HudFooter'
import { setUiReducedMotion } from '../../ui'
afterEach(cleanup)
beforeEach(() => { const config = scenarios[0]!; useGameStore.setState({config, game:createGame(config), aiStatus:'offline'}) })
describe('HUD', () => {
  it('shows store values, negative net worth, month and timeline', () => {
    const timeline = vi.fn(); const state = useGameStore.getState(), game = state.game!, config = state.config!
    render(<Hud onOpenTimeline={timeline}/>); expect(screen.getByText(`Month ${game.monthIndex} / ${config.durationMonths}`)).toBeTruthy(); expect(screen.getByText(monthLabel(config.startMonth,game.monthIndex))).toBeTruthy()
    for (const value of [game.cash, game.savings, selectDebtTotal(state), selectNetWorth(state)]) expect(screen.getAllByText(usd(value)).length).toBeGreaterThan(0)
    expect(screen.getByText(usd(selectNetWorth(state))).className).toContain('fv-money--negative')
    fireEvent.click(screen.getByRole('button', {name:/Timeline/})); expect(timeline).toHaveBeenCalledOnce()
  })
  it('flashes a value tick with a floating delta when cash changes, colour only under reduced motion', () => {
    const {container, rerender} = render(<Hud onOpenTimeline={vi.fn()}/>); expect(container.querySelector('.fv-value-tick')).toBeNull()
    useGameStore.setState(state => ({game:{...state.game!,cash:state.game!.cash + 420}})); rerender(<Hud onOpenTimeline={vi.fn()}/>)
    const tick = container.querySelector('.fv-value-tick--up')!; expect(tick).toBeTruthy(); expect(tick.querySelector('.fv-value-delta')?.textContent).toBe('+$420')
    setUiReducedMotion(true); useGameStore.setState(state => ({game:{...state.game!,cash:state.game!.cash - 85}})); rerender(<Hud onOpenTimeline={vi.fn()}/>)
    const down = container.querySelector('.fv-value-tick--down')!; expect(down).toBeTruthy(); expect(down.querySelector('.fv-value-delta')).toBeNull(); setUiReducedMotion(false)
  })
  it('shows a pulsing dot only while the AI is loading', () => {
    useGameStore.setState({aiStatus:'loading'}); const {container, rerender} = render(<StatusTag/>); expect(container.querySelector('.fv-status-dot')).toBeTruthy()
    useGameStore.setState({aiStatus:'online'}); rerender(<StatusTag/>); expect(container.querySelector('.fv-status-dot')).toBeNull()
  })
  it('prints the two footer lines', () => {
    render(<HudFooter/>); expect(screen.getByText('Fictional educational simulation · Assumptions are illustrative')).toBeTruthy(); expect(screen.getByText('USD · A little town. A bigger perspective.')).toBeTruthy()
  })
  it.each([['paused','online','PAUSED'],['finished','loading','STORY COMPLETE'],['playing','loading','PREPARING OPPORTUNITY'],['playing','online','AI CONNECTED'],['playing','offline','OFFLINE READY']] as const)('prioritizes %s / %s', (status, aiStatus, text) => {
    useGameStore.setState(state => ({game:{...state.game!,status},aiStatus})); render(<StatusTag/>); expect(screen.getByRole('status').textContent).toContain(text)
  })
})
const props: ControlBarProps = {status:'playing',onAdvance:vi.fn(),onPause:vi.fn(),onFinish:vi.fn(),onToggleAuto:vi.fn(),secondsRemaining:58,autoAdvanceEnabled:true}
describe('control bar', () => {
  it.each(['playing','paused','finished'] as const)('preserves disabled rules for %s', status => {
    render(<ControlBar {...props} status={status}/>); const next = screen.getByRole('button', {name:/Next month/}) as HTMLButtonElement
    expect(next.disabled).toBe(status !== 'playing')
    for (const name of [/Auto on/, status === 'paused' ? /Resume/ : /Pause/, /Finish & reveal/]) expect((screen.getByRole('button',{name}) as HTMLButtonElement).disabled).toBe(status === 'finished')
  })
  it.each([[true,false,'Next month in'],[false,false,'Auto-time off'],[true,true,'Decision waiting']] as const)('labels countdown %s / %s', (autoAdvanceEnabled,blocked,label) => {
    render(<ControlBar {...props} autoAdvanceEnabled={autoAdvanceEnabled} blocked={blocked}/>); expect(screen.getByRole('timer').textContent).toBe(`${label}00:58`)
  })
  it('exposes the auto toggle as a pressed button and omits the countdown without a timer', () => {
    const toggle = vi.fn(); const {rerender} = render(<ControlBar {...props} onToggleAuto={toggle}/>); const auto = screen.getByRole('button', {name:'Auto on'}); expect(auto.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(auto); expect(toggle).toHaveBeenCalledOnce()
    rerender(<ControlBar {...props} autoAdvanceEnabled={false} secondsRemaining={undefined}/>); expect(screen.getByRole('button', {name:'Auto off'}).getAttribute('aria-pressed')).toBe('false'); expect(screen.queryByRole('timer')).toBeNull()
  })
  it('forwards pause and resume intent', () => {
    const pause = vi.fn(); const {rerender} = render(<ControlBar {...props} onPause={pause}/>); fireEvent.click(screen.getByRole('button',{name:/Pause/})); expect(pause).toHaveBeenLastCalledWith(true)
    rerender(<ControlBar {...props} status="paused" onPause={pause}/>); fireEvent.click(screen.getByRole('button',{name:/Resume/})); expect(pause).toHaveBeenLastCalledWith(false)
  })
})
