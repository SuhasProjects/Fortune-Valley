import { useEffect, type ReactNode } from 'react'
import { useGameStore } from './stores/useGameStore'
import type { BuildingId } from './types/domain'
import EngineHarness from './dev/EngineHarness'
import { TitleScreen } from './game/title/TitleScreen'
import { RevealScreen } from './game/reveal/RevealScreen'
import { GameScreen } from './game/GameScreen'
import { UiGallery } from './ui/dev/UiGallery'

// Agent 3 supplies controlled panels. Agent 5's title and reveal screens are routed directly.
export interface AppProps {
  panels?: Partial<Record<BuildingId, ReactNode>>
}
export default function App(props: AppProps) {
  const store = useGameStore()
  useEffect(() => { store.refreshSavedGame() }, [store.refreshSavedGame])
  const dev = new URLSearchParams(window.location.search).get('dev')
  if (dev === 'engine') return <EngineHarness />
  if (dev === 'ui') return <UiGallery/>
  if (!store.game) return <TitleScreen/>
  if (store.finishPayload) return <RevealScreen payload={store.finishPayload} onPlayAgain={store.resetGame}/>
  return <GameScreen panels={props.panels}/>
}
