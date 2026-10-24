import { PanelHost } from '../../components/town/PanelHost'

export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel, danger = false }: { title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  return <PanelHost title={title} onClose={onCancel}>
    <p>{body}</p>
    <div className="dialog-actions">
      <button className={`pixel-button${danger ? ' pixel-button--danger' : ' pixel-button--gold'}`} onClick={onConfirm}>{confirmLabel}</button>
      <button className="pixel-button" onClick={onCancel}>Cancel</button>
    </div>
  </PanelHost>
}
