import type { CSSProperties } from 'react'
import type { BuildingId } from '@/types/domain'
import { BUILDINGS } from '../world/landmarks'
import { SPRITES, type SpriteName } from './manifest'
import './sprite.css'

export type { SpriteName }

export interface SpriteProps {
  name: SpriteName
  /** Frame index, or a derived variant by name (`hover`, `lit`, `lights`). */
  frame?: number | string
  /** Loop through the authored frames at the sprite's own speed (variants are never part of the loop). */
  animate?: boolean
  className?: string
  /** Accessible label; omitted = decorative. */
  label?: string
  style?: CSSProperties
}

const isAuthored = (frameName: string) => /^\d+$/.test(frameName)

/** Draw one frame of a compiled sprite sheet at the current `--px` zoom. */
export function Sprite({ name, frame = 0, animate = false, className, label, style }: SpriteProps) {
  const meta = SPRITES[name]
  const index = typeof frame === 'number' ? frame : Math.max(0, meta.frames.indexOf(frame))
  const loop = meta.frames.filter(isAuthored).length
  const vars = {
    '--w': meta.w, '--h': meta.h, '--n': meta.frames.length, '--i': index,
    '--loop': loop, '--dur': `${loop * (meta.speed ?? 250)}ms`, backgroundImage: `url(${meta.src})`, ...style,
  } as CSSProperties
  return <span className={`fv-sprite${animate && loop > 1 ? ' fv-sprite--animate' : ''}${className ? ` ${className}` : ''}`}
    style={vars} data-sprite={name} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}/>
}

/** Building portrait for window headers, the story picker and the guide. */
export function BuildingPortrait({ building }: { building: BuildingId }) {
  return <Sprite name={`world/buildings/${building}`} label={BUILDINGS[building].title} className="fv-portrait"/>
}
