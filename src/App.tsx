import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { useGameStore } from './stores/useGameStore'
import type { BuildingId } from './types/domain'
import { TitleScreen } from './game/title/TitleScreen'
import { GameScreen } from './game/GameScreen'
import { RotateGuard } from './game/stage/RotateOverlay'
import { Board } from './ui'
import { isDemoMode } from './demo/demoMode'

// The ending and the dev routes load on demand so the title and town start fast.
const RevealScreen = lazy(() => import('./game/reveal/RevealScreen').then(m => ({ default: m.RevealScreen })))
const EngineHarness = lazy(() => import('./dev/EngineHarness'))
const UiGallery = lazy(() => import('./ui/dev/UiGallery').then(m => ({ default: m.UiGallery })))
const loading = <Board className="fv-loading" padding="lg">Loading…</Board>

// Agent 3 supplies controlled panels. Agent 5's title and reveal screens are routed directly.
export interface AppProps {
  panels?: Partial<Record<BuildingId, ReactNode>>
}
export default function App(props: AppProps) {
  const store = useGameStore()
  useEffect(() => { store.refreshSavedGame(); if (isDemoMode() /* /demo or ?demo=1 arms the scripted run for this tab */ && !store.game) store.resumeDemoSession() }, [store.refreshSavedGame])
  const dev = new URLSearchParams(window.location.search).get('dev')
  if (dev === 'engine') return <Suspense fallback={loading}><EngineHarness/></Suspense>
  if (dev === 'ui') return <Suspense fallback={loading}><UiGallery/></Suspense>
  // Phones held upright see "turn your phone sideways" over whichever screen is up; the screen keeps running underneath.
  if (!store.game) return <RotateGuard><TitleScreen/></RotateGuard>
  if (store.finishPayload) return <RotateGuard><Suspense fallback={loading}><RevealScreen payload={store.finishPayload} onPlayAgain={store.resetGame}/></Suspense></RotateGuard>
  return <RotateGuard><GameScreen panels={props.panels}/></RotateGuard>
}
