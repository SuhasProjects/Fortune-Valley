// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scenarios } from '../data/scenarios'
import { useGameStore } from '../stores/useGameStore'
import { useGameClock } from './useGameClock'

describe('useGameClock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useGameStore.getState().resetGame()
    useGameStore.getState().startGame(scenarios[0]!)
  })
  afterEach(() => vi.useRealTimers())

  it('advances exactly once when the countdown reaches zero', () => {
    const { result } = renderHook(() => useGameClock({ intervalMs: 3_000 }))
    act(() => vi.advanceTimersByTime(2_000))
    expect(useGameStore.getState().game?.monthIndex).toBe(0)
    expect(result.current.secondsRemaining).toBe(1)
    act(() => vi.advanceTimersByTime(1_000))
    expect(useGameStore.getState().game?.monthIndex).toBe(1)
    expect(result.current.secondsRemaining).toBe(3)
  })

  it('does not advance while a decision blocks time', () => {
    const { result } = renderHook(() => useGameClock({ intervalMs: 3_000, blocked: true }))
    act(() => vi.advanceTimersByTime(10_000))
    expect(useGameStore.getState().game?.monthIndex).toBe(0)
    expect(result.current.secondsRemaining).toBe(3)
  })

  it('cleans up its interval on unmount', () => {
    const { unmount } = renderHook(() => useGameClock({ intervalMs: 2_000 }))
    unmount()
    act(() => vi.advanceTimersByTime(5_000))
    expect(useGameStore.getState().game?.monthIndex).toBe(0)
  })

  it('holds the countdown while a window is open and resumes where it left off', () => {
    const { result, rerender } = renderHook(({ blocked }) => useGameClock({ intervalMs: 3_000, blocked }), { initialProps: { blocked: false } })
    act(() => vi.advanceTimersByTime(1_000))
    expect(result.current.secondsRemaining).toBe(2)
    rerender({ blocked: true })
    act(() => vi.advanceTimersByTime(10_000))
    expect(useGameStore.getState().game?.monthIndex).toBe(0)
    expect(result.current.secondsRemaining).toBe(2)
    rerender({ blocked: false })
    act(() => vi.advanceTimersByTime(2_000))
    expect(useGameStore.getState().game?.monthIndex).toBe(1)
  })

  it('follows the auto-advance setting when the interval changes and stops when disabled', () => {
    const { result, rerender } = renderHook(({ intervalMs, enabled }) => useGameClock({ intervalMs, enabled }), { initialProps: { intervalMs: 30_000, enabled: true } })
    expect(result.current.secondsRemaining).toBe(30)
    rerender({ intervalMs: 120_000, enabled: true })
    expect(result.current.secondsRemaining).toBe(120)
    act(() => vi.advanceTimersByTime(119_000))
    expect(useGameStore.getState().game?.monthIndex).toBe(0)
    act(() => vi.advanceTimersByTime(1_000))
    expect(useGameStore.getState().game?.monthIndex).toBe(1)
    rerender({ intervalMs: 120_000, enabled: false })
    expect(result.current.autoAdvanceEnabled).toBe(false)
    act(() => vi.advanceTimersByTime(300_000))
    expect(useGameStore.getState().game?.monthIndex).toBe(1)
  })

  it('holds the countdown while the tab is hidden and resumes when it is visible again', () => {
    let state: DocumentVisibilityState = 'visible'
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
    try {
      const { result } = renderHook(() => useGameClock({ intervalMs: 3_000 }))
      act(() => vi.advanceTimersByTime(1_000))
      expect(result.current.secondsRemaining).toBe(2)
      state = 'hidden'
      act(() => { document.dispatchEvent(new Event('visibilitychange')) })
      act(() => vi.advanceTimersByTime(30_000))
      expect(useGameStore.getState().game?.monthIndex).toBe(0)
      expect(result.current.secondsRemaining).toBe(2)
      state = 'visible'
      act(() => { document.dispatchEvent(new Event('visibilitychange')) })
      act(() => vi.advanceTimersByTime(2_000))
      expect(useGameStore.getState().game?.monthIndex).toBe(1)
    } finally {
      if (original) Object.defineProperty(document, 'visibilityState', original); else delete (document as unknown as Record<string, unknown>).visibilityState
    }
  })

  it('defaults to a 15 s month', () => {
    const { result } = renderHook(() => useGameClock())
    expect(result.current.secondsRemaining).toBe(15)
  })

  it('advances manually and resets the countdown', () => {
    const { result } = renderHook(() => useGameClock({ intervalMs: 5_000 }))
    act(() => vi.advanceTimersByTime(2_000))
    expect(result.current.secondsRemaining).toBe(3)
    act(() => result.current.advanceNow())
    expect(useGameStore.getState().game?.monthIndex).toBe(1)
    expect(result.current.secondsRemaining).toBe(5)
  })
})
