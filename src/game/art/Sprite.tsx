import type { BuildingId } from '@/types/domain'
import { BUILDINGS } from '../world/landmarks'

/** Name of a compiled sprite (`art-src/<path>.txt` → `public/art/<path>.png`). Narrowed to a union once the manifest is generated. */
export type SpriteName = string

export interface SpriteProps {
  name: SpriteName
  frame?: number
  /** Loop through the sprite's frames at its authored speed. */
  animate?: boolean
  className?: string
  /** Accessible label; omitted = decorative. */
  label?: string
}

// STUB (Phase 0): a labelled placeholder box until the art pipeline and manifest land. Props are final.
export function Sprite({ name, className, label }: SpriteProps) {
  return <span className={`fv-sprite fv-sprite--stub ${className ?? ''}`} data-sprite={name} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    style={{ display: 'inline-block', width: 'calc(16 * var(--px, 4px))', height: 'calc(16 * var(--px, 4px))', background: 'var(--c-parchment-shadow)', outline: 'var(--px, 4px) solid var(--c-outline)' }}/>
}

/** Building portrait for window headers, the story picker and the guide. */
export function BuildingPortrait({ building }: { building: BuildingId }) {
  return <Sprite name={`world/buildings/${building}`} label={BUILDINGS[building].title}/>
}
