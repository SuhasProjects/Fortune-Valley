import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { stageScale, uiBox, type StageScale } from './scale'
import './stage.css'
import '../../styles/palette.css'

/** The stage's zoom plus the viewport it was computed for (CSS px), so world layers can place the map themselves. */
export interface StageView extends StageScale { width: number; height: number }

const view = (width: number, height: number): StageView => ({ ...stageScale(width, height), width, height })
const StageContext = createContext<StageView>(view(1280, 720))

/** Current integer zoom (`px`), visible area in art pixels and viewport size. Matches the `--px` CSS variable. */
export function useStageScale(): StageView {
  return useContext(StageContext)
}

function readViewport(): StageView {
  return typeof window === 'undefined' ? view(1280, 720) : view(window.innerWidth, window.innerHeight)
}

/**
 * Full-viewport root for every game screen. Sets `--px` (whole-number zoom in CSS px), `--view-w` and `--view-h`
 * (visible art pixels). `world` renders underneath; `children` form the UI layer, whose direct children receive
 * pointer events while empty space passes clicks through to the world.
 *
 * The UI layer covers the viewport except where the viewport shows past the 480x288 map (tall or ultrawide windows,
 * see scale.ts): there it shrinks to the map's edges, so the HUD, bars and bubbles frame the town, not the border.
 * `--ui-left/top/right/bottom` carry that inset for fixed-position overlays (modals), and `data-fit` says which axes
 * are inset (`map` = none, `tall`, `wide` or `both`).
 */
export function GameStage({ world, label, children }: { world: ReactNode; label: string; children?: ReactNode }) {
  const [scale, setScale] = useState(readViewport)
  useEffect(() => {
    const update = () => setScale(readViewport())
    update()
    window.addEventListener('resize', update)
    const html = document.documentElement.style.overflow
    const body = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('resize', update)
      document.documentElement.style.overflow = html
      document.body.style.overflow = body
    }
  }, [])
  const box = uiBox(scale.width, scale.height, scale)
  const tall = box.top > 0 || box.bottom > 0, wide = box.left > 0 || box.right > 0
  const fit = tall && wide ? 'both' : tall ? 'tall' : wide ? 'wide' : 'map'
  const vars = {
    '--px': `${scale.px}px`, '--view-w': scale.viewW, '--view-h': scale.viewH,
    '--ui-left': `${box.left}px`, '--ui-top': `${box.top}px`, '--ui-right': `${box.right}px`, '--ui-bottom': `${box.bottom}px`,
  } as CSSProperties
  const ui = { left: box.left, top: box.top, right: box.right, bottom: box.bottom } as CSSProperties
  return <StageContext.Provider value={scale}>
    <div className="fv-stage" style={vars} aria-label={label} role="group" data-px={scale.px} data-fit={fit}>
      <div className="fv-world">{world}</div>
      <div className="fv-ui" style={ui}>{children}</div>
    </div>
  </StageContext.Provider>
}
