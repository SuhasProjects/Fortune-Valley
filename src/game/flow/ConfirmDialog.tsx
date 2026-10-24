import { Button, Modal } from '../../ui'
import './flow.css'

export interface ConfirmDialogProps {
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

/** Small kit window with one primary action. Escape, the close button and the backdrop all cancel. */
export function ConfirmDialog({ title, body, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel, danger = false }: ConfirmDialogProps) {
  return <Modal title={title} onClose={onCancel} width="sm">
    <p className="fv-dialog-body">{body}</p>
    <div className="fv-dialog-actions">
      <Button onClick={onCancel}>{cancelLabel}</Button>
      <Button variant="primary" icon={danger ? 'warning' : 'check'} onClick={onConfirm}>{confirmLabel}</Button>
    </div>
  </Modal>
}
