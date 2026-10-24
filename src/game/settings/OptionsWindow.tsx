import { setSetting, useSettings } from './useSettings'

export function OptionsWindow({ onClose }: { onClose: () => void }) {
  const settings = useSettings()
  return <section className="pixel-panel" role="dialog" aria-modal="true" aria-labelledby="options-title">
    <h2 id="options-title">Options</h2>
    <label>Auto-advance <select value={settings.autoAdvanceSeconds} onChange={event => {
      const value = Number(event.target.value) as 0 | 30 | 60 | 120
      setSetting('autoAdvanceSeconds', value)
      if (value) setSetting('lastAutoAdvanceSeconds', value)
    }}><option value={0}>Off</option><option value={30}>30 seconds</option><option value={60}>60 seconds</option><option value={120}>120 seconds</option></select></label>
    <label><input type="checkbox" checked={settings.sound} onChange={event => setSetting('sound', event.target.checked)}/> Sound</label>
    <label><input type="checkbox" checked={settings.reduceMotion} onChange={event => setSetting('reduceMotion', event.target.checked)}/> Reduce motion</label>
    <label><input type="checkbox" checked={settings.tips} onChange={event => setSetting('tips', event.target.checked)}/> Tips</label>
    <button className="pixel-button" onClick={onClose}>Done</button>
  </section>
}
