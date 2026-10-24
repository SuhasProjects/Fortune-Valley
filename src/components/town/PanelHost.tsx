import type { ReactNode } from 'react'
import type { BuildingId } from '../../types/domain'
import { Modal, Plaque } from '../../ui'
import { buildings } from './buildings'
export interface PanelHostProps { building?: BuildingId; title?: string; onClose: () => void; children: ReactNode }

/** Compatibility adapter while panel callers migrate to the shared UI kit. */
export function PanelHost({ building, title, onClose, children }: PanelHostProps) {
  const heading = title ?? (building ? buildings[building].title : 'Your story')
  const plaque = building ? <Plaque tone="wood">{buildings[building].hint}</Plaque> : undefined
  return <Modal title={heading} plaque={plaque} onClose={onClose} width="lg">{children}</Modal>
}
