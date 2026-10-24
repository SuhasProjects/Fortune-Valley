import { useEffect, type ReactNode } from 'react'
import { useGameStore, type FinishPayload } from './stores/useGameStore'
import { PanelHost } from './components/town/PanelHost'
import type { BuildingId } from './types/domain'
import EngineHarness from './dev/EngineHarness'
import { RevealChart } from './components/reveal'
import { Landing } from './components/landing/Landing'
import { GameScreen } from './game/GameScreen'

// Agent 3 supplies controlled panels. Agent 5 mounts its computed reveal here.
export interface AppProps {
  panels?: Partial<Record<BuildingId, ReactNode>>
  renderReveal?: (payload: FinishPayload) => ReactNode
}
export default function App(props: AppProps) {
  const store = useGameStore()
  useEffect(() => { store.refreshSavedGame() }, [store.refreshSavedGame])
  const dev = new URLSearchParams(window.location.search).get('dev')
  if (dev === 'engine') return <EngineHarness />
  if (dev === 'ui') return <main className="pixel-panel"><h1>UI gallery</h1><p>The shared UI gallery has not landed yet.</p></main>
  if (!store.game) return <Landing/>
  if (store.finishPayload) return <PanelHost title="Your next chapter" onClose={store.resetGame}>{props.renderReveal ? props.renderReveal(store.finishPayload) : <RevealChart payload={store.finishPayload} onReset={store.resetGame}/>}</PanelHost>
  return <GameScreen panels={props.panels}/>
}
