/**
 * Root layout. OWNER: Agent 2 (town/layout). Agent 1 only placed this bootstrap
 * so the repo builds. Replace freely; keep <EngineHarness /> reachable at
 * `?dev=engine` until the real reveal route exists (plain-text reveal fallback for Agent 5).
 */
import EngineHarness from './dev/EngineHarness';

export default function App() {
  return <EngineHarness />;
}
