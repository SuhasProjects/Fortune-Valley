/** Mirror of Agent 1's documented ending contract until its exports land.
 * No simulation, statistics, spreads, or monetary deltas are calculated here.
 */
import * as engine from '@/engine'
import type { GameConfig, MonteCarloResult, PolicyLogEntry } from '@/types/domain'

export interface OutcomeLines { months: number; start: number; p10: number; median: number; p90: number; yourEvents: number; spread: number }
export type ChartLines = Omit<OutcomeLines, 'spread'>
export interface DecisionChoice {
  id: string; logIndex: number | null; monthIndex: number | null; label: string
  alternatives: { id: string; label: string }[]
}
export interface WhatIfInput {
  config: GameConfig; policyLog: PolicyLogEntry[]; finishMonteCarlo: MonteCarloResult
  startNetWorth: number; observedNetWorth: number; decisionId: string; alternativeId: string
}
export interface WhatIfResult {
  decisionLabel: string; alternativeLabel: string; original: OutcomeLines; changed: OutcomeLines
  delta: { p10: number; median: number; p90: number; yourEvents: number; spread: number }
  yourEventsComparable: boolean; replayFallbacks: number
}
export interface EndingApi {
  outcomeLines: (mc: MonteCarloResult, startNetWorth: number) => OutcomeLines
  listDecisions: (config: GameConfig, log: PolicyLogEntry[]) => DecisionChoice[]
  runWhatIfAsync: (input: WhatIfInput, signal?: AbortSignal) => Promise<WhatIfResult>
}
export const endingApi = engine as typeof engine & Partial<EndingApi>

/** Map existing engine values without deriving statistics when the new API is absent. */
export function originalLines(mc: MonteCarloResult, start: number): ChartLines {
  if (endingApi.outcomeLines) return endingApi.outcomeLines(mc, start)
  return { months: mc.months, start, p10: mc.p10, median: mc.median, p90: mc.p90, yourEvents: mc.observedNetWorth }
}
