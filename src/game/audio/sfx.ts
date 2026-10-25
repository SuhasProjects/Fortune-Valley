export type SfxName = 'click' | 'open' | 'close' | 'coin' | 'month' | 'alert' | 'reveal'

let context: AudioContext | null = null

const patterns: Record<SfxName, Array<[number, number, OscillatorType]>> = {
  click: [[330, .035, 'square']], open: [[260, .05, 'square']], close: [[180, .05, 'square']],
  coin: [[660, .06, 'square'], [880, .08, 'square']], month: [[440, .09, 'triangle'], [660, .12, 'triangle']],
  alert: [[520, .08, 'square'], [390, .1, 'square']], reveal: [[330, .08, 'triangle'], [440, .08, 'triangle'], [660, .14, 'triangle']],
}

function enabled() {
  if (typeof window === 'undefined' || navigator.webdriver) return false
  try { return JSON.parse(localStorage.getItem('fortune-valley-settings-v2') ?? '{}').sound !== false } catch { return true }
}

export function sfx(name: SfxName): void {
  if (!enabled()) return
  const Audio = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Audio) return
  context ??= new Audio()
  let at = context.currentTime
  for (const [frequency, duration, type] of patterns[name]) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(.025, at)
    gain.gain.exponentialRampToValueAtTime(.001, at + duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(at); oscillator.stop(at + duration)
    at += duration
  }
}
