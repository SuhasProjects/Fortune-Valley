import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { stageScale, type StageScale } from './scale'
import './stage.css'
import '../../styles/palette.css'

const StageContext = createContext<StageScale>(stageScale(1280, 720))

/** Current integer zoom (`px`) and visible area in art pixels. Matches the `--px` CSS variable. */
export function useStageScale(): StageScale {
  return useContext(StageContext)
}

function readViewport(): StageScale {
  return typeof window === 'undefined' ? stageScale(1280, 720) : stageScale(window.innerWidth, window.innerHeight)
}

/**
 * Full-viewport root for every game screen. Sets `--px` (whole-number zoom in CSS px), `--view-w` and `--view-h`
 * (visible art pixels). `world` renders underneath; `children` form the UI layer, whose direct children receive
 * pointer events while empty space passes clicks through to the world.
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
  const vars = { '--px': `${scale.px}px`, '--view-w': scale.viewW, '--view-h': scale.viewH } as CSSProperties
  return <StageContext.Provider value={scale}>
    <div className="fv-stage" style={vars} aria-label={label} role="group" data-px={scale.px}>
      <div className="fv-world">{world}</div>
      <div className="fv-ui">{children}</div>
    </div>
  </StageContext.Provider>
}
