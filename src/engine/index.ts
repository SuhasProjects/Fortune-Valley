/** Public engine API. Import from '@/engine'. Owner: Agent 1. */
export { createGame } from './createGame';
export { advanceMonth, annualWithholding, type AdvanceOptions } from './advanceMonth';
export { applyAction } from './actions';
export { runMonteCarlo, compareStrategies, compareWithBaseline, hasPolicyDecisions, histogram, quantile, assumptionsSummary, type MonteCarloOptions } from './monteCarlo';
export { previewMonth, previewHorizon, type MonthPreview, type PreviewOverrides, type MonthSnapshot } from './preview';
export { netWorthOf, investmentsTotal, debtTotal, monthLabel, monthlyRate, round2, uiId } from './accounting';
export { settleClaim, applyEffect, describeEffect, activePlan } from './events';
export { validateAllocation, validateEffect, validateConfig, validatePlanId } from './validation';
export { makeRng, monthRng, hashSeed, pathSeed, type Rng } from './rng';
export * from './selectors';
