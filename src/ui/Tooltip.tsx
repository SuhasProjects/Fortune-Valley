import { useId, type ReactNode } from 'react'
import './Tooltip.css'
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const id = useId()
  return <span className="fv-tooltip" aria-describedby={id}>{children}<span id={id} role="tooltip" className="fv-tooltip__bubble">{content}</span></span>
}
