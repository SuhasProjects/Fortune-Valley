import type { GameAction, GameEvent, GameNotification, GameState, LedgerEntry, TimelineEntry } from '../types/domain'

// Temporary pure offline adapter. Agent 1 can replace this module with the canonical engine.
const round = (n: number) => Math.round(n * 100) / 100
const id = (prefix: string, state: GameState, suffix = '') => `${prefix}-${state.scenarioId}-${state.monthIndex}-${suffix}`
export function advanceMonthPure(current: GameState): GameState {
  if (current.status !== 'playing') return current
  const monthIndex = current.monthIndex + 1
  const gross = current.employment.grossAnnualPay / 12
  const tax = gross * current.taxProfile.withholdingRate
  const premiums = current.insurance.reduce((n, p) => n + p.premium, 0)
  const scheduledDebt = current.debts.reduce((n, d) => n + Math.min(d.minimumPayment, d.balance), 0)
  const baseCash = current.cash + gross - tax - current.household.rent - current.household.monthlyEssentialExpenses - premiums - scheduledDebt
  const save = Math.max(0, Math.min(current.policies.savingsContributionPerMonth, baseCash))
  const invest = Math.max(0, Math.min(current.policies.investmentContributionPerMonth, baseCash - save))
  const ledger: LedgerEntry[] = [
    { id: id('pay', current), monthIndex, category: 'income', amountSigned: round(gross), description: 'Gross pay' },
    { id: id('tax', current), monthIndex, category: 'tax', amountSigned: -round(tax), description: 'Simplified withholding' },
    { id: id('rent', current), monthIndex, category: 'housing', amountSigned: -current.household.rent, description: 'Rent / housing' },
    { id: id('bills', current), monthIndex, category: 'essential', amountSigned: -current.household.monthlyEssentialExpenses, description: 'Essential bills' },
    { id: id('premium', current), monthIndex, category: 'insurance', amountSigned: -premiums, description: 'Insurance premiums' },
    { id: id('debt', current), monthIndex, category: 'debt', amountSigned: -scheduledDebt, description: 'Scheduled debt payment' }
  ]
  const notification: GameNotification = { id: id('month', current), monthIndex, kind: baseCash < 0 ? 'negative' : 'info', summary: 'Monthly activity posted', details: 'Pay, withholding, recurring bills, premiums, and debt service were processed.', read: false, amountSigned: round(baseCash - current.cash) }
  return { ...current, monthIndex, cash: round(baseCash - save - invest), savings: round(current.savings + save), investments: { ...current.investments, etf: round(current.investments.etf + invest) }, debts: current.debts.map(d => ({ ...d, balance: round(Math.max(0, d.balance - Math.min(d.minimumPayment, d.balance))) })), ledger: [...current.ledger, ...ledger], notifications: [...current.notifications, notification] }
}

export function applyActionPure(current: GameState, action: GameAction): GameState {
  if (action.type === 'advance_month') return advanceMonthPure(current)
  if (action.type === 'pause') return { ...current, status: 'paused' }
  if (action.type === 'resume') return { ...current, status: 'playing' }
  if (action.type === 'finish') return { ...current, status: 'finished', activeEvent: null }
  if (current.status === 'finished') return current
  const log = [...current.replayLog, { monthIndex: current.monthIndex, action }]
  const timeline = (description: string, data?: Record<string, unknown>): TimelineEntry[] => [...current.timeline, { id: id('policy', current, String(current.timeline.length)), monthIndex: current.monthIndex, type: 'policy_change', description, data }]
  if (action.type === 'set_allocation') {
    const sum = action.allocation.stock + action.allocation.bond + action.allocation.etf
    if (Math.abs(sum - 1) > .001 || Object.values(action.allocation).some(n => n < 0)) return current
    return { ...current, policies: { ...current.policies, targetAllocation: action.allocation }, replayLog: log, timeline: timeline('Investment allocation changed', { previous: current.policies.targetAllocation, next: action.allocation }) }
  }
  if (action.type === 'set_contributions' && action.savings >= 0 && action.investments >= 0) return { ...current, policies: { ...current.policies, savingsContributionPerMonth: action.savings, investmentContributionPerMonth: action.investments }, replayLog: log, timeline: timeline('Monthly contributions changed', { savings: action.savings, investments: action.investments }) }
  if ((action.type === 'decline_event' || action.type === 'apply_event_option') && current.activeEvent?.id === action.eventId) return { ...current, activeEvent: null, replayLog: log, timeline: [...current.timeline, { id: id('choice', current), monthIndex: current.monthIndex, type: 'choice', description: action.type === 'decline_event' ? `Declined: ${current.activeEvent.title}` : `Selected an option for: ${current.activeEvent.title}`, eventId: action.eventId }] }
  if (action.type === 'accept_job_offer' && current.activeEvent?.id === action.eventId && action.grossAnnualPay > current.employment.grossAnnualPay) return { ...current, employment: { ...current.employment, grossAnnualPay: action.grossAnnualPay }, activeEvent: null, replayLog: log, timeline: [...current.timeline, { id: id('choice', current), monthIndex: current.monthIndex, type: 'choice', description: `Accepted job offer at $${action.grossAnnualPay.toLocaleString()} gross annual pay`, eventId: action.eventId }] }
  return current
}

export function attachEvent(current: GameState, event: GameEvent): GameState {
  if (current.activeEvent || current.timeline.some(t => t.eventId === event.id)) return current
  return { ...current, activeEvent: event, notifications: [...current.notifications, { id: `notice-${event.id}`, monthIndex: current.monthIndex, kind: 'decision', summary: event.title, details: event.body, relatedBuilding: event.buildingTarget, read: false }], timeline: [...current.timeline, { id: `timeline-${event.id}`, monthIndex: current.monthIndex, type: 'ai_event', description: event.title, eventId: event.id }] }
}
