export type BuildingTarget = 'bank' | 'office' | 'home' | 'hospital' | 'market'
export type GameStatus = 'setup' | 'playing' | 'paused' | 'finished'

export interface Assumptions {
  taxRate: number
  monthlyReturn: number
  savingsApy: number
  shockChance: number
  notes: string[]
}

export interface Debt { id: string; name: string; balance: number; apr: number; minimumPayment: number }
export interface InsurancePlan { id: string; name: string; premium: number; deductible: number; coverage: number }
export interface Policy {
  savingsContributionPerMonth: number
  investmentContributionPerMonth: number
  extraDebtPaymentPerMonth: number
  targetAllocation: { stock: number; bond: number; etf: number }
  insurancePlanIds: string[]
  emergencyFundingOrder: ('cash' | 'savings' | 'borrow')[]
}
export interface LedgerEntry { id: string; monthIndex: number; category: string; amountSigned: number; description: string }
export interface GameNotification { id: string; monthIndex: number; kind: 'info' | 'positive' | 'negative' | 'decision'; summary: string; details?: string; relatedBuilding?: BuildingTarget; read: boolean; amountSigned?: number }
export interface TimelineEntry { id: string; monthIndex: number; type: 'choice' | 'shock' | 'milestone' | 'policy_change' | 'ai_event' | 'routine'; description: string; eventId?: string; snapshotRef?: string; data?: Record<string, unknown> }
export type EventTemplate = 'offer_job' | 'change_housing' | 'change_insurance' | 'budget_choice' | 'loan_choice'
export interface EventOption { id: string; label: string; action: GameAction }
export interface GameEvent { id: string; type: 'A' | 'B'; title: string; body: string; buildingTarget: BuildingTarget; options: EventOption[]; expiresAtMonth?: number; source: 'engine' | 'ai' | 'fallback' }
export interface ReplayAction { monthIndex: number; action: GameAction }

export interface GameState {
  monthIndex: number; status: GameStatus; cash: number; savings: number
  investments: { stock: number; bond: number; etf: number }
  debts: Debt[]
  employment: { grossAnnualPay: number; status: 'employed' | 'part_time' | 'unemployed' }
  household: { monthlyEssentialExpenses: number; rent: number }
  insurance: InsurancePlan[]
  taxProfile: { withholdingRate: number }
  marketState: { lastMonthlyReturn: number }
  activeEvent: GameEvent | null
  ledger: LedgerEntry[]; notifications: GameNotification[]; timeline: TimelineEntry[]; policies: Policy
  replayLog: ReplayAction[]
  seed: number; scenarioId: string
}

export interface GameConfig { scenarioId: string; title: string; description: string; mode: 'sandbox' | 'personalized'; startMonth: string; durationMonths: number; seed: number; assumptions: Assumptions; initialState: GameState; narrativeFocus: string[] }

export type GameAction =
  | { type: 'advance_month' }
  | { type: 'set_allocation'; allocation: Policy['targetAllocation'] }
  | { type: 'set_contributions'; savings: number; investments: number }
  | { type: 'make_extra_payment'; debtId: string; amount: number }
  | { type: 'set_insurance'; planIds: string[] }
  | { type: 'apply_event_option'; eventId: string; optionId: string }
  | { type: 'accept_job_offer'; eventId: string; grossAnnualPay: number }
  | { type: 'decline_event'; eventId: string }
  | { type: 'pause' } | { type: 'resume' } | { type: 'finish' }

export interface FinishPayload { initialState: GameState; finalState: GameState; policyActions: ReplayAction[]; durationMonths: number; seed: number }
