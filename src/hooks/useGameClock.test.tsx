// @vitest-environment jsdom
import { StrictMode, type ReactNode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scenarios } from '../data/scenarios'
import type { GameEvent } from '../types/domain'
import { useGameStore } from '../stores/useGameStore'
import { useGameClock } from './useGameClock'

const originalAdvance = useGameStore.getState().advanceOneMonth
let advance = vi.fn()
const event = (type: 'A' | 'B'): GameEvent => ({ id: 'waiting', type, title: 'Review this', body: '', buildingTarget: 'bank', options: [], createdAtMonth: 0, source: type === 'A' ? 'engine' : 'fallback' })
const tick = (milliseconds: number) => act(() => vi.advanceTimersByTime(milliseconds))
beforeEach(() => {
  vi.useFakeTimers()
  useGameStore.getState().resetGame()
  useGameStore.getState().startGame(scenarios[1]!)
  advance = vi.fn(() => useGameStore.setState(state => ({ game: { ...state.game!, monthIndex: state.game!.monthIndex + 1 } })))
  useGameStore.setState({ advanceOneMonth: advance })
})
afterEach(() => { cleanup(); useGameStore.setState({ advanceOneMonth: originalAdvance }); vi.useRealTimers() })

describe('automatic month clock', () => {
  it('advances once after 60 seconds and starts the next 60-second countdown', () => {
    const { result } = renderHook(() => useGameClock())
    tick(59_000)
    expect(result.current.secondsRemaining).toBe(1)
    expect(advance).not.toHaveBeenCalled()
    tick(1000)
    expect(advance).toHaveBeenCalledTimes(1)
    expect(result.current.secondsRemaining).toBe(60)
  })
  it('preserves remaining time across pause and resume', () => {
    const { result } = renderHook(() => useGameClock())
    tick(20_000)
    act(() => useGameStore.getState().setPaused(true))
    tick(90_000)
    expect(result.current.secondsRemaining).toBe(40)
    expect(advance).not.toHaveBeenCalled()
    act(() => useGameStore.getState().setPaused(false))
    tick(39_000)
    expect(advance).not.toHaveBeenCalled()
    tick(1000)
    expect(advance).toHaveBeenCalledTimes(1)
  })
  it.each(['A','B'] as const)('holds for unresolved Type %s events, then resumes', type => {
    const { result } = renderHook(() => useGameClock())
    tick(15_000)
    act(() => useGameStore.setState(state => ({ game: { ...state.game!, activeEvents: [event(type)] } })))
    tick(120_000)
    expect(result.current.blocked).toBe(true)
    expect(result.current.secondsRemaining).toBe(45)
    expect(advance).not.toHaveBeenCalled()
    act(() => useGameStore.setState(state => ({ game: { ...state.game!, activeEvents: [] } })))
    tick(45_000)
    expect(advance).toHaveBeenCalledTimes(1)
  })
  it('resets the full countdown after manual advancement between timer ticks', () => {
    const { result } = renderHook(() => useGameClock())
    tick(10_125)
    act(() => result.current.advanceManually())
    expect(advance).toHaveBeenCalledTimes(1)
    expect(result.current.secondsRemaining).toBe(60)
    tick(59_875)
    expect(advance).toHaveBeenCalledTimes(1)
    tick(250)
    expect(advance).toHaveBeenCalledTimes(2)
  })
  it('does not tick finished runs and cleans up its timer on unmount', () => {
    const { result, unmount } = renderHook(() => useGameClock())
    tick(10_000)
    act(() => useGameStore.setState(state => ({ game: { ...state.game!, status: 'finished' } })))
    tick(120_000)
    expect(result.current.secondsRemaining).toBe(50)
    expect(advance).not.toHaveBeenCalled()
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('owns just one interval under StrictMode and never retries every tick after a no-op advance', () => {
    advance.mockImplementation(() => {})
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>
    const { unmount } = renderHook(() => useGameClock(), { wrapper })
    expect(vi.getTimerCount()).toBe(1)
    tick(61_000)
    expect(advance).toHaveBeenCalledTimes(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
