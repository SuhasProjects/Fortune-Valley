/** Public engine API. Import from '@/engine'. Owner: Agent 1. */
export { createGame } from './createGame';
export { advanceMonth, annualWithholding, type AdvanceOptions } from './advanceMonth';
export { applyAction } from './actions';
export { runMonteCarlo, compareStrategies, compareWithBaseline, hasPolicyDecisions, histogram, quantile, assumptionsSummary, type MonteCarloOptions } from './monteCarlo';
export { previewMonth, previewHorizon, type MonthPreview, type PreviewOverrides, type MonthSnapshot } from './preview';
export { netWorthOf, investmentsTotal, debtTotal, monthLabel, monthlyRate, round2, uiId } from './accounting';
export { settleClaim, applyEffect, describeEffect, activePlan, hasCar, chooseShockVariant, SHOCK_VARIANTS } from './events';
export { carBand, carRunningCost, premiumFor, normalizeCar, describeCar, bandFromMonthlyCost, bandFromLoanBalance, NO_CAR } from './car';
export { deriveHouseholdProfile } from './household';
export { LIFE_EVENT_TEMPLATES, LIFE_TEMPLATE_BY_ID, lifeEventLabel, eligibleTemplates, calendarMonth, type LifeEventTemplate } from './lifeEvents';
export { validateAllocation, validateEffect, validateConfig, validatePlanId } from './validation';
export { makeRng, monthRng, hashSeed, pathSeed, type Rng } from './rng';
export * from './selectors';
export { serializeSave, parseSave, defaultStorage, SAVE_STORAGE_KEY, SAVE_SCHEMA_VERSION, type SaveFile, type ParsedSave, type KeyValueStorage } from './persistence';
export { outcomeLines, listDecisions, changedPolicyLog, runWhatIf, runWhatIfAsync, HYPOTHETICAL_PREFIX } from './whatIf';
