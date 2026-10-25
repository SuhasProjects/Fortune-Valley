import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { useGameStore } from './stores/useGameStore'
import type { BuildingId } from './types/domain'
import { TitleScreen } from './game/title/TitleScreen'
import { GameScreen } from './game/GameScreen'
import { Board } from './ui'

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
  useEffect(() => { store.refreshSavedGame() }, [store.refreshSavedGame])
  const dev = new URLSearchParams(window.location.search).get('dev')
  if (dev === 'engine') return <Suspense fallback={loading}><EngineHarness/></Suspense>
  if (dev === 'ui') return <Suspense fallback={loading}><UiGallery/></Suspense>
  if (!store.game) return <TitleScreen/>
  if (store.finishPayload) return <Suspense fallback={loading}><RevealScreen payload={store.finishPayload} onPlayAgain={store.resetGame}/></Suspense>
  return <GameScreen panels={props.panels}/>
}
