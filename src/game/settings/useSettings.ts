import { useSyncExternalStore } from 'react'
import { z } from 'zod'

export const SETTINGS_STORAGE_KEY = 'fortune-valley-settings-v1'

const SettingsSchema = z.object({
  autoAdvanceSeconds: z.union([z.literal(0), z.literal(30), z.literal(60), z.literal(120)]),
  lastAutoAdvanceSeconds: z.union([z.literal(30), z.literal(60), z.literal(120)]),
  sound: z.boolean(),
  reduceMotion: z.boolean(),
  tips: z.boolean(),
  tipsSeen: z.boolean(),
})

export type Settings = z.infer<typeof SettingsSchema>
export type SettingKey = keyof Settings

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

const defaults = (): Settings => ({
  autoAdvanceSeconds: 60,
  lastAutoAdvanceSeconds: 60,
  sound: true,
  reduceMotion: prefersReducedMotion(),
  tips: true,
  tipsSeen: false,
})

function load(): Settings {
  if (typeof window === 'undefined') return defaults()
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return defaults()
    const parsed = SettingsSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : defaults()
  } catch {
    return defaults()
  }
}

let settings = load()
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) }
const snapshot = () => settings

export function setSetting<K extends SettingKey>(key: K, value: Settings[K]) {
  const candidate = SettingsSchema.safeParse({ ...settings, [key]: value })
  if (!candidate.success) return
  settings = candidate.data
  try { window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)) } catch { /* unavailable */ }
  listeners.forEach(listener => listener())
}

export function useSettings() {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/** Test/support hook: reload the validated snapshot from storage. */
export function refreshSettings() {
  settings = load()
  listeners.forEach(listener => listener())
}
