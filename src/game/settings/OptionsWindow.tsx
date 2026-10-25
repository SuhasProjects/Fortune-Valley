import { Button, Select, Toggle } from '../../ui'
import { setSetting, useSettings } from './useSettings'
import '../flow/flow.css'

const autoOptions = [
  { value: '0', label: 'Off' }, { value: '30', label: '30 seconds' }, { value: '60', label: '60 seconds' }, { value: '120', label: '120 seconds' },
]

/**
 * Body of the Options dialog. The caller supplies the window (the pause menu and the title screen both open it
 * inside a Modal named `Options`). Each toggle sits in a `<label>` so it can be found by its visible text.
 */
export function OptionsWindow({ onClose, onDeleteSave }: { onClose: () => void; onDeleteSave?: () => void }) {
  const settings = useSettings()
  return <div className="fv-options">
    <Select label="Auto-advance" value={String(settings.autoAdvanceSeconds)} options={autoOptions} onChange={value => {
      const seconds = Number(value) as 0 | 30 | 60 | 120
      setSetting('autoAdvanceSeconds', seconds)
      if (seconds) setSetting('lastAutoAdvanceSeconds', seconds)
    }}/>
    <label className="fv-options__row"><span>Sound</span><Toggle label="" checked={settings.sound} onChange={value => setSetting('sound', value)}/></label>
    <label className="fv-options__row"><span>Reduce motion</span><Toggle label="" checked={settings.reduceMotion} onChange={value => setSetting('reduceMotion', value)}/></label>
    <label className="fv-options__row"><span>Tips</span><Toggle label="" checked={settings.tips} onChange={value => { setSetting('tips', value); if (value) setSetting('tipsSeen', false) }}/></label>
    <div className="fv-dialog-actions">
      {onDeleteSave && <Button icon="warning" onClick={onDeleteSave}>Delete saved game</Button>}
      <Button variant="primary" icon="check" onClick={onClose}>Done</Button>
    </div>
  </div>
}
