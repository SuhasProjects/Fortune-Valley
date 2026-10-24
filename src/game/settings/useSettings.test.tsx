// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { refreshSettings, SETTINGS_STORAGE_KEY, setSetting, useSettings } from './useSettings'

const values = new Map<string, string>()
beforeAll(() => Object.defineProperty(window, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
  clear: () => values.clear(),
} }))

beforeEach(() => {
  window.localStorage.clear()
  refreshSettings()
})

describe('settings', () => {
  it('uses defaults and persists valid changes', () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current.autoAdvanceSeconds).toBe(60)
    act(() => setSetting('autoAdvanceSeconds', 30))
    expect(result.current.autoAdvanceSeconds).toBe(30)
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY)!).autoAdvanceSeconds).toBe(30)
  })

  it('falls back safely when persisted data is corrupt', () => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, '{bad json')
    act(refreshSettings)
    const { result } = renderHook(() => useSettings())
    expect(result.current.autoAdvanceSeconds).toBe(60)
    expect(result.current.sound).toBe(true)
  })
})
