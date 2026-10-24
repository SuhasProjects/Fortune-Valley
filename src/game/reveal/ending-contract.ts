/** Agent 1's ending API, with the chart-only subset used by the UI. */
import { listDecisions, outcomeLines, runWhatIfAsync } from '@/engine'
import type { MonteCarloResult, OutcomeLines } from '@/types/domain'

export type { DecisionChoice, OutcomeLines, WhatIfInput, WhatIfResult } from '@/types/domain'
export type ChartLines = Omit<OutcomeLines, 'spread'>
export const endingApi = { listDecisions, outcomeLines, runWhatIfAsync }

export function originalLines(mc: MonteCarloResult, start: number): ChartLines {
  return outcomeLines(mc, start)
}
