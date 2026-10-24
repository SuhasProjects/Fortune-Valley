/** Compatibility mount until Agent 4 routes RevealScreen directly. */
import { RevealScreen } from '@/game/reveal/RevealScreen'
import type { FinishPayload } from '@/stores/useGameStore'
export const REVEAL_COLORS = { median: 'var(--c-outline)', band: 'var(--c-leaf-light)', observed: 'var(--c-gold)', baseline: 'var(--c-money-down)' } as const
export interface RevealChartProps { payload: FinishPayload; onReset?: () => void }
export function RevealChart({ payload, onReset }: RevealChartProps) {
  return <RevealScreen payload={payload} onPlayAgain={onReset ?? (() => {})}/>
}
export default RevealChart
