/**
 * Financial Town — authoritative domain types.
 * Owner: Agent 1. Any structural change here must be announced to the team and
 * reflected in docs/INTEGRATION.md and src/fixtures/* in the same commit.
 *
 * Conventions
 * - All money is USD in whole-dollar floats (we round to cents at write time).
 * - `monthIndex` is 0-based from game start. `startMonth` + `monthIndex` gives the calendar label.
 * - Rates are annual decimals unless the field name says `Monthly` (e.g. 0.07 = 7%/yr).
 * - amountSigned: positive = inflow to the named account, negative = outflow.
 * - Net worth invariant: cash + savings + stock + bond + etf − Σ debt balances.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Identifiers & enums
// ─────────────────────────────────────────────────────────────────────────────

export type ArchetypeId = 'college_student' | 'entry_worker' | 'professional' | 'young_family';
export type GameMode = 'sandbox' | 'personalized';
export type GameStatus = 'setup' | 'playing' | 'paused' | 'finished';

export type BuildingId = 'bank' | 'office' | 'home' | 'hospital' | 'market';
/** Alias kept for Agent 2's town components. */
export type BuildingTarget = BuildingId;

export type AssetClass = 'stock' | 'bond' | 'etf';
export const ASSET_CLASSES: readonly AssetClass[] = ['stock', 'bond', 'etf'] as const;

/** Allocation weights over asset classes. Must sum to 1 (±0.001). */
export type Allocation = Record<AssetClass, number>;

export type InsuranceLine = 'health' | 'auto' | 'renters';
export const INSURANCE_LINES: readonly InsuranceLine[] = ['health', 'auto', 'renters'] as const;

export type DebtKind = 'student_loan' | 'credit_card' | 'auto_loan' | 'personal_loan' | 'overdraft';

export type EmploymentStatus = 'employed' | 'unemployed' | 'student';

/** Rough resale value of the household car: cheap ≈ $3–8k, mid ≈ $10–20k, nice ≈ $25k+. `none` only with `owned: false`. */
export type CarValueBand = 'none' | 'cheap' | 'mid' | 'nice';
export const CAR_VALUE_BANDS: readonly CarValueBand[] = ['none', 'cheap', 'mid', 'nice'] as const;

/**
 * Car ownership. Owning a car adds a monthly running cost (`car_costs` ledger line, by band), makes auto
 * shocks possible (median scales with band) and unlocks auto insurance (premium scales mildly with band).
 * An outstanding `auto_loan` debt always implies `owned: true`. No resale value is tracked.
 */
export interface CarState { owned: boolean; valueBand: CarValueBand }
export type HousingKind = 'rent' | 'dorm' | 'family' | 'own';

/** Where money is drawn from when cash is insufficient (in order). */
export type FundingSource = 'savings' | 'investments' | 'borrow';

/** `life` is the small unavoidable cost / small gift family (life events); it is never insured. */
export type ShockKind = 'medical' | 'auto' | 'home' | 'job_loss' | 'life';

// ─────────────────────────────────────────────────────────────────────────────
// Assumptions (demo, configurable, illustrative — never real-world forecasts)
// ─────────────────────────────────────────────────────────────────────────────

export interface AssetAssumption {
  /** Expected annual arithmetic return, e.g. 0.07 */
  expectedAnnualReturn: number;
  /** Annual volatility (std dev of log return), e.g. 0.16 */
  annualVolatility: number;
  label: string;
}

export interface TaxBracket {
  /** Upper bound of annual taxable income for this bracket; null = no cap. */
  upTo: number | null;
  rate: number;
}

export interface TaxAssumptions {
  kind: 'illustrative_progressive';
  standardDeductionAnnual: number;
  brackets: TaxBracket[];
  /** Flat payroll (FICA-like) rate applied to gross, illustrative. */
  payrollRate: number;
  note: string;
}

export interface InsurancePlan {
  id: string;
  line: InsuranceLine;
  name: string;
  monthlyPremium: number;
  deductible: number;
  /** Share of cost the insured still pays after the deductible (0..1). */
  coinsurance: number;
  /** Max insured out-of-pocket per claim; null = none. */
  outOfPocketMax: number | null;
  /** Max insurer payout per claim; null = none. */
  coverageCap: number | null;
}

export interface ShockAssumption {
  kind: Exclude<ShockKind, 'job_loss' | 'life'>;
  /** Probability the shock occurs in a given month (independent across months). */
  monthlyIncidence: number;
  /** Lognormal cost parameters: median cost and dispersion sigma (log space). */
  costMedian: number;
  costSigma: number;
  costMin: number;
  costMax: number;
  coveredBy: InsuranceLine;
  label: string;
}

export interface EmploymentAssumptions {
  /** Monthly probability of involuntary job loss while employed. */
  jobLossMonthlyIncidence: number;
  unemploymentDurationMonthsMin: number;
  unemploymentDurationMonthsMax: number;
  /** Fraction of prior gross monthly pay received while unemployed (capped). */
  unemploymentReplacementRate: number;
  unemploymentBenefitMonthlyCap: number;
  /** Annual raise applied every 12 months while employed. */
  annualRaiseRate: number;
}

/**
 * Life events: small costs and small gifts drawn on their own RNG stream. Signs are paired so the
 * cumulative net over a run stays within ±netCap (expected net ≈ $0); flavour only, not economics.
 */
export interface LifeEventAssumptions {
  /** Probability of one life event in a given month. */
  monthlyIncidence: number;
  amountMin: number;
  amountMax: number;
  /** Running |gifts − costs| never exceeds this; amounts are trimmed to keep it so. */
  netCap: number;
}

export interface Assumptions {
  version: 1;
  assets: Record<AssetClass, AssetAssumption>;
  /** Correlation of monthly log-return shocks between stock and etf, stock and bond. */
  correlation: { stockEtf: number; stockBond: number };
  savingsApy: number;
  tax: TaxAssumptions;
  insurancePlans: InsurancePlan[];
  shocks: ShockAssumption[];
  employment: EmploymentAssumptions;
  /** Small unavoidable costs and small gifts; absent in older saves → engine uses DEFAULT_LIFE_EVENTS. */
  lifeEvents?: LifeEventAssumptions;
  /** APR charged on the overdraft debt created when cash would go negative. */
  overdraftApr: number;
  /** Months of essential spending the engine treats as the "liquidity shortfall" threshold (metric only). */
  liquidityShortfallThresholdMonths: number;
  disclaimer: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core financial state
// ─────────────────────────────────────────────────────────────────────────────

export interface Debt {
  id: string;
  name: string;
  kind: DebtKind;
  balance: number;
  apr: number;
  /** Required payment each month (engine pays min(balance+interest, minimumPayment + extra)). */
  minimumPayment: number;
}

export interface Employment {
  status: EmploymentStatus;
  title: string;
  grossAnnualSalary: number;
  /** >0 while unemployed; decremented monthly. */
  monthsUnemployedRemaining: number;
  /** Salary to restore when re-employed. */
  priorGrossAnnualSalary: number;
}

export interface Household {
  housingKind: HousingKind;
  housingMonthly: number;
  /** Groceries, utilities, transport, etc. */
  essentialsMonthly: number;
  /** Player-controlled lifestyle spending. */
  discretionaryMonthly: number;
  dependents: number;
}

export type InsuranceState = Record<InsuranceLine, string | null>;

export interface TaxProfile {
  filingStatus: 'single' | 'married_joint';
  note: string;
}

export interface MarketState {
  /** Last realized monthly returns per class. */
  lastMonthlyReturns: Allocation;
  /** Cumulative growth index per class, starts at 1. */
  index: Allocation;
}

export interface Policy {
  savingsContributionPerMonth: number;
  investmentContributionPerMonth: number;
  targetAllocation: Allocation;
  extraDebtPaymentPerMonth: number;
  insurancePlanIds: InsuranceState;
  /** Order to draw funds when cash is insufficient. Engine always uses cash first. */
  emergencyFundingOrder: FundingSource[];
  /** Cash floor the engine will not dip below for contributions (contributions are skipped/trimmed). */
  minCashBuffer: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ledger, notifications, timeline
// ─────────────────────────────────────────────────────────────────────────────

export type AccountRef = 'cash' | 'savings' | 'stock' | 'bond' | 'etf' | `debt:${string}`;

export type LedgerCategory =
  | 'salary'
  | 'unemployment_benefit'
  | 'tax_withholding'
  | 'housing'
  | 'essentials'
  | 'car_costs'
  | 'discretionary'
  | 'insurance_premium'
  | 'debt_interest'
  | 'debt_payment'
  | 'savings_contribution'
  | 'investment_contribution'
  | 'savings_interest'
  | 'investment_return'
  | 'shock_cost'
  | 'life_event'
  | 'insurance_claim'
  | 'emergency_funding'
  | 'overdraft'
  | 'event'
  | 'transfer'
  | 'loan_proceeds';

export interface LedgerEntry {
  id: string;
  monthIndex: number;
  category: LedgerCategory;
  account: AccountRef;
  amountSigned: number;
  description: string;
}

export type NotificationKind = 'info' | 'positive' | 'negative' | 'decision';

export interface GameNotification {
  id: string;
  monthIndex: number;
  kind: NotificationKind;
  summary: string;
  details?: string;
  relatedBuilding?: BuildingId;
  /** Optional headline amount for the toast (display only; ledger is the source of truth). */
  amountSigned?: number;
  read: boolean;
  /** Set on shock and life-event notices so the UI can ask for a news-wire scene (AI kind `flavour`); `life` uses the signed amount. */
  shockKind?: ShockKind;
  /** Type A event id, so the matching timeline entry can carry the same scene. */
  eventId?: string;
  flavour?: ShockFlavour;
  /** Life-event template id (e.g. `birthday_gift`) so scenes and the recap can name the event. */
  templateId?: string;
  /** Shock variant (e.g. medical `wrist`), chosen so a run never repeats one until all are used. */
  variant?: string;
}

/** Short wire-service scene for a shock; the amount always comes from the engine. */
export interface ShockFlavour { headline: string; scene: string; source?: 'ai' | 'fallback' }

/** PII-free input for the `flavour` kind. */
export interface ShockFlavourInput {
  kind: ShockKind;
  /** Gross cost (≥ 0) for insured shocks; for `life` the signed amount (gift > 0, cost < 0). */
  amount: number;
  monthLabel: string;
  archetype?: ArchetypeId;
  housingKind: HousingKind;
  hasCar: boolean;
  employment: EmploymentStatus;
  /** Life-event template id (life) — names the incident family and its cadence. */
  templateId?: string;
  /** Shock variant tag (medical/auto/home). */
  variant?: string;
  /** The run's fixed household facts, for continuity (same pet, same relatives). */
  household?: HouseholdProfile;
  /** Headlines of the last few scenes in this run; the model must not repeat an incident. */
  previousScenes?: string[];
  /** How many events of this template/variant came before in the run (0-based); drives the offline no-repeat draw. */
  occurrence?: number;
  /** Game seed; shuffles the offline scene order per run. */
  runSeed?: number;
}

export type TimelineEntryType = 'choice' | 'shock' | 'milestone' | 'policy_change' | 'ai_event';

export interface TimelineEntry {
  id: string;
  monthIndex: number;
  type: TimelineEntryType;
  description: string;
  eventId?: string;
  /** Structured record of the action/choice so it can be replayed. */
  action?: GameAction;
  /** Net worth right after this entry. */
  netWorthAfter: number;
  /** News-wire scene for a shock entry, copied from the matching notification once it arrives. */
  flavour?: ShockFlavour;
}

// ─────────────────────────────────────────────────────────────────────────────
// Events (Type A = engine shocks, Type B = narrative opportunities)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whitelisted effects an event option may carry. The engine validates bounds
 * and applies them; no free-form balance edits are possible.
 */
export type EventEffect =
  | { template: 'none' }
  | { template: 'offer_job'; grossAnnualSalary: number; title: string }
  | { template: 'change_housing'; housingMonthly: number; housingKind: HousingKind }
  | { template: 'change_insurance'; line: InsuranceLine; planId: string | null }
  | { template: 'budget_choice'; discretionaryMonthly: number }
  | { template: 'loan_choice'; principal: number; apr: number; termMonths: number; name: string }
  | { template: 'contribution_choice'; savingsContributionPerMonth: number; investmentContributionPerMonth: number };

export type EventTemplate = EventEffect['template'];

export interface EventOption {
  id: string;
  label: string;
  description: string;
  effect: EventEffect;
}

export type EventSource = 'engine' | 'ai' | 'fallback';

export interface GameEvent {
  id: string;
  type: 'A' | 'B';
  title: string;
  body: string;
  buildingTarget: BuildingId;
  options: EventOption[];
  createdAtMonth: number;
  expiresAtMonth?: number;
  source: EventSource;
  /** For Type A: realized cost details for the timeline/learning text. */
  shock?: RealizedShock;
  /** Optional one-line learning focus provided by the AI director. */
  learningNote?: string;
}

export interface RealizedShock {
  kind: ShockKind;
  /** Variant tag (e.g. medical `wrist`); absent on job loss and older saves. */
  variant?: string;
  grossCost: number;
  insurerPaid: number;
  outOfPocket: number;
  planId: string | null;
  fundedFrom: { source: 'cash' | FundingSource; amount: number }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

export type GameAction =
  | { type: 'advance_month' }
  | { type: 'set_allocation'; allocation: Allocation }
  | { type: 'set_budget'; discretionaryMonthly: number }
  | { type: 'set_housing'; housingMonthly: number; housingKind: HousingKind }
  | { type: 'set_car'; owned: boolean; valueBand: CarValueBand }
  | { type: 'set_insurance'; line: InsuranceLine; planId: string | null }
  | { type: 'set_contributions'; savingsContributionPerMonth: number; investmentContributionPerMonth: number }
  | { type: 'set_extra_debt_payment'; amount: number }
  | { type: 'set_min_cash_buffer'; amount: number }
  | { type: 'make_extra_payment'; debtId: string; amount: number }
  | { type: 'transfer'; from: 'cash' | 'savings'; to: 'cash' | 'savings'; amount: number }
  | { type: 'apply_event_option'; eventId: string; optionId: string }
  | { type: 'dismiss_event'; eventId: string }
  | { type: 'enqueue_event'; event: GameEvent }
  | { type: 'mark_notifications_read' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'finish' };

export type GameActionType = GameAction['type'];

export type ActionErrorCode =
  | 'invalid_allocation'
  | 'invalid_amount'
  | 'insufficient_funds'
  | 'unknown_debt'
  | 'unknown_plan'
  | 'unknown_event'
  | 'unknown_option'
  | 'event_expired'
  | 'invalid_status'
  | 'invalid_effect'
  | 'duplicate_event'
  | 'game_finished';

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; code: ActionErrorCode; message: string; state: GameState };

/** A logged, replayable player decision (everything except advance_month). */
export interface PolicyLogEntry {
  monthIndex: number;
  action: GameAction;
  /**
   * For apply_event_option: the resolved effect, so Monte Carlo can replay the
   * decision as a direct policy change even though the event itself was path-specific.
   */
  resolvedEffect?: EventEffect;
  /** Situation when the decision was taken; Monte Carlo uses it to skip replays that no longer apply (e.g. a "return to work" offer in a path with no job loss). */
  context?: { employmentStatus: EmploymentStatus };
  /** For apply_event_option: "Event title: option label", so the ending can name the decision. */
  label?: string;
  /** For apply_event_option: the options the player did not pick, so the ending can replay them instead. */
  alternatives?: { optionId: string; label: string; effect: EventEffect }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Ending: straight-line outcome summary and one-decision what-if (owner: Agent 1)
// ─────────────────────────────────────────────────────────────────────────────

/** Endpoints for the ending chart: straight lines from (0, start) to each ending after `months`. */
export interface OutcomeLines {
  months: number;
  start: number;
  p10: number;
  median: number;
  p90: number;
  /** Ending of the player's exact game (original: observed; what-if: exact replay with the change). */
  yourEvents: number;
  /** p90 − p10. */
  spread: number;
}

export interface DecisionAlternative { id: string; label: string }

export interface DecisionChoice {
  /** `${policyLogIndex}`, or 'all' for "every decision at once". */
  id: string;
  logIndex: number | null;
  monthIndex: number | null;
  label: string;
  /** Never empty. */
  alternatives: DecisionAlternative[];
}

export interface WhatIfInput {
  config: GameConfig;
  policyLog: PolicyLogEntry[];
  finishMonteCarlo: MonteCarloResult;
  startNetWorth: number;
  observedNetWorth: number;
  decisionId: string;
  alternativeId: string;
}

export interface WhatIfResult {
  decisionLabel: string;
  alternativeLabel: string;
  original: OutcomeLines;
  changed: OutcomeLines;
  /** changed − original. `yourEvents` is the pure effect of the change on the player's exact luck. */
  delta: { p10: number; median: number; p90: number; yourEvents: number; spread: number };
  /** False when replaying the unchanged log on the game's own seed does not reproduce the observed ending. */
  yourEventsComparable: boolean;
  replayFallbacks: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Game config & state
// ─────────────────────────────────────────────────────────────────────────────

export interface InitialState {
  cash: number;
  savings: number;
  investments: Allocation;
  debts: Debt[];
  employment: Employment;
  household: Household;
  insurance: InsuranceState;
  taxProfile: TaxProfile;
  policy: Policy;
  /** Absent in saves from before car ownership existed; the engine then infers it from any auto_loan debt. */
  car?: CarState;
}

/** A scripted happening for a demo or lesson run: lands exactly on `monthIndex` instead of a random roll. */
export type ScriptedEvent =
  | { monthIndex: number; kind: 'life'; amountSigned: number; label: string; headline?: string; scene?: string }
  | { monthIndex: number; kind: 'shock'; shockKind: Exclude<ShockKind, 'life' | 'job_loss'>; grossCost: number; variant?: string; headline?: string; scene?: string };
/**
 * Run script: events placed by hand. `exclusive: true` silences the random shock, job-loss, life-event and offer rolls
 * everywhere; `'played'` silences them only in the played run: Monte Carlo and what-if paths keep the scripted life
 * events but swap the scripted shocks for random ones (`simulationShocks` when given, else the run's own assumptions).
 */
export interface RunScript { events: ScriptedEvent[]; exclusive?: boolean | 'played'; simulationShocks?: ShockAssumption[] }

export interface GameConfig {
  scenarioId: string;
  title: string;
  description: string;
  mode: GameMode;
  archetype?: ArchetypeId;
  /** Calendar month of monthIndex 0, e.g. "2026-01". */
  startMonth: string;
  durationMonths: number;
  seed: number;
  assumptions: Assumptions;
  initialState: InitialState;
  /** Learning focus tags chosen by the player or inferred by AI. */
  narrativeFocus: string[];
  /** Which fields came from labeled defaults vs the player (personalized mode). */
  defaultsApplied?: string[];
  /** Scripted happenings (demo / lesson runs); copied onto the state so Monte Carlo and what-if replays see them too. */
  script?: RunScript;
}

export interface GameState {
  schemaVersion: 1;
  scenarioId: string;
  seed: number;
  startMonth: string;
  durationMonths: number;
  monthIndex: number;
  status: GameStatus;

  cash: number;
  savings: number;
  investments: Allocation;
  debts: Debt[];
  employment: Employment;
  household: Household;
  insurance: InsuranceState;
  taxProfile: TaxProfile;
  car: CarState;
  marketState: MarketState;
  policy: Policy;
  assumptions: Assumptions;

  activeEvents: GameEvent[];
  ledger: LedgerEntry[];
  notifications: GameNotification[];
  timeline: TimelineEntry[];
  policyLog: PolicyLogEntry[];
  /** Net worth at the end of each month, index = monthIndex (0 = start). */
  netWorthHistory: number[];
  /** Months in which overdraft borrowing was needed. */
  shortfallMonths: number[];
  /** Realized Type A shocks, for reproducibility checks. */
  realizedShocks: { monthIndex: number; shock: RealizedShock }[];
  /** Realized life events (signed: gift > 0, cost < 0); kept in Monte Carlo paths too so the net cap can be enforced. */
  lifeEvents: RealizedLifeEvent[];
  /** Effect templates every Type B opportunity so far has put on the table (declined or not), so the same offer is not nagged again. */
  offeredTemplates?: EventEffect['template'][];
  /** Scripted happenings for this run (see GameConfig.script); absent on ordinary runs. */
  script?: RunScript;
  /** Pet, birthday, relatives, hobby, commute: fixed per run so events and scenes never contradict each other. */
  householdProfile: HouseholdProfile;
}

export interface RealizedLifeEvent { monthIndex: number; amountSigned: number; eventId: string; /** Life-event template that fired (absent in saves from before templates). */ templateId?: string }

export type PetKind = 'none' | 'cat' | 'dog';
export type CommuteKind = 'car' | 'transit' | 'bike';
export type HobbyTag = 'running' | 'cycling' | 'music' | 'gaming' | 'photography' | 'cooking' | 'reading' | 'hiking';
/** Names-free roles around the player; the first is an elder, the second (if any) a peer. */
export type CircleRole = 'grandmother' | 'grandfather' | 'aunt' | 'uncle' | 'cousin' | 'roommate' | 'partner' | 'older sister' | 'older brother';
/**
 * Who the player is, beyond the money: derived once at createGame from (seed, archetype) so life
 * events and their scenes stay consistent across a run (the same pet, the same relatives, one birthday).
 */
export interface HouseholdProfile {
  /** Archetype the run was built from (custom scenarios carry their base archetype); drives template whitelists. */
  archetype?: ArchetypeId;
  /** Calendar month 1–12. */
  birthMonth: number;
  pet: PetKind;
  hobby: HobbyTag;
  hasKids: boolean;
  commute: CommuteKind;
  /** 1–2 roles, elder first. */
  circle: CircleRole[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Monte Carlo
// ─────────────────────────────────────────────────────────────────────────────

export interface MonteCarloSummary {
  endingNetWorths: number[];
  median: number;
  p10: number;
  p90: number;
  mean: number;
  probabilityNegativeNetWorth: number;
  probabilityLiquidityShortfall: number;
  /** Per-month median/p10/p90 of net worth across paths (for fan charts). */
  bands: { monthIndex: number; p10: number; median: number; p90: number }[];
}

export interface MonteCarloComparison {
  labelA: string;
  labelB: string;
  a: MonteCarloSummary;
  b: MonteCarloSummary;
  /** Median of per-path (A − B) ending net worth differences, paired by seed. */
  pairedMedianDifference: number;
  probabilityAOutperformsB: number;
}

export interface MonteCarloResult extends MonteCarloSummary {
  seed: number;
  pathsRequested: number;
  pathsCompleted: number;
  months: number;
  /** Actual engine-computed ending net worth of the player's run. */
  observedNetWorth: number;
  /** Fraction of simulated paths that ended below the observed value; undefined if horizons differ. */
  percentileOfObserved?: number;
  observedHorizonMatches: boolean;
  /** Count of logged actions that could not be replayed exactly and used the documented fallback. */
  replayFallbacks: number;
  assumptionsSummary: string[];
  comparison?: MonteCarloComparison;
  elapsedMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI contracts (browser ↔ server). Owned by Agent 1.
// ─────────────────────────────────────────────────────────────────────────────

/** Compact, PII-free state summary sent to the AI director. */
export interface StateSummary {
  monthIndex: number;
  monthLabel: string;
  archetype?: ArchetypeId;
  netWorth: number;
  cash: number;
  savings: number;
  investmentsTotal: number;
  debtTotal: number;
  grossAnnualSalary: number;
  employmentStatus: EmploymentStatus;
  housingKind: HousingKind;
  housingMonthly: number;
  essentialsMonthly: number;
  discretionaryMonthly: number;
  insurance: InsuranceState;
  policy: Pick<Policy, 'savingsContributionPerMonth' | 'investmentContributionPerMonth' | 'targetAllocation' | 'extraDebtPaymentPerMonth'>;
  recentShocks: ShockKind[];
  /** Offer templates already shown this run; the model must not propose them again (insurance in particular is one-shot). */
  seenOffers?: EventEffect['template'][];
  monthsOfEssentialsCovered: number;
  narrativeFocus: string[];
  /** 1 = beginner, 2 = intermediate, 3 = advanced; chosen by the engine from play so far. */
  complexityLevel: 1 | 2 | 3;
}

export interface PersonalizedInput {
  freeText: string;
  age?: number;
  grossAnnualIncome?: number;
  monthlyRent?: number;
  savings?: number;
  debtBalance?: number;
  debtApr?: number;
  dependents?: number;
  /** Car on file: owned, plus either a value band or the monthly running cost the player quoted. */
  car?: { owned: boolean; valueBand?: Exclude<CarValueBand, 'none'>; monthlyCost?: number };
}

export type AiRequest =
  | { kind: 'scenario'; input: PersonalizedInput }
  | { kind: 'opportunity'; summary: StateSummary }
  | { kind: 'explain'; summary: StateSummary; question: string; monteCarlo?: Pick<MonteCarloResult, 'median' | 'p10' | 'p90' | 'probabilityNegativeNetWorth' | 'probabilityLiquidityShortfall' | 'observedNetWorth' | 'percentileOfObserved'> }
  | { kind: 'flavour'; shock: ShockFlavourInput }
  | { kind: 'whatif'; comparison: { decisionLabel: string; alternativeLabel: string; original: { p10: number; median: number; p90: number; yourEvents: number }; changed: { p10: number; median: number; p90: number; yourEvents: number }; delta: { p10: number; median: number; p90: number; yourEvents: number; spread: number }; startNetWorth: number; months: number } }
  | { kind: 'recap'; recap: { months: number; startNetWorth: number; endNetWorth: number; timeline: { month: number; label: string; event: string; amount?: number }[] } }
  | { kind: 'coach'; summary: StateSummary; question: string; history: CoachTurn[]; openBuilding?: BuildingId | null; facts?: CoachFacts };

/** Rates the StateSummary omits but the Coach quotes: savings APY, each debt's APR, the insurance plans held. */
export interface CoachFacts { savingsApy: number; debts: Pick<Debt, 'name' | 'kind' | 'balance' | 'apr' | 'minimumPayment'>[]; insurance: Pick<InsurancePlan, 'line' | 'name' | 'monthlyPremium' | 'deductible' | 'coinsurance'>[] }
/** One line of the Coach chat; `source` is set on coach turns only. */
export interface CoachTurn { role: 'user' | 'coach'; text: string; source?: 'ai' | 'fallback' }

/** The scenario the AI maps a prompt onto. Engine turns it into a GameConfig. */
export interface ScenarioProposal {
  baseArchetype: ArchetypeId;
  title: string;
  description: string;
  overrides: {
    grossAnnualSalary?: number;
    housingMonthly?: number;
    housingKind?: HousingKind;
    essentialsMonthly?: number;
    discretionaryMonthly?: number;
    cash?: number;
    savings?: number;
    debts?: { name: string; kind: Exclude<DebtKind, 'overdraft'>; balance: number; apr: number; minimumPayment: number }[];
    dependents?: number;
    durationMonths?: number;
    /** Car ownership inferred from the text ("I drive to work" ⇒ owned); band or monthly cost optional. */
    car?: { owned: boolean; valueBand?: Exclude<CarValueBand, 'none'>; monthlyCost?: number };
  };
  narrativeFocus: string[];
  /** Human-readable list of fields the AI defaulted. */
  defaultsApplied: string[];
}

export interface OpportunityProposal {
  title: string;
  body: string;
  buildingTarget: BuildingId;
  learningNote: string;
  options: { label: string; description: string; effect: EventEffect }[];
  expiresInMonths: number;
}

export type AiResponse =
  | { kind: 'scenario'; source: 'ai' | 'fallback'; proposal: ScenarioProposal; warnings: string[] }
  | { kind: 'opportunity'; source: 'ai' | 'fallback'; proposal: OpportunityProposal | null; warnings: string[] }
  | { kind: 'explain'; source: 'ai' | 'fallback'; text: string; warnings: string[] }
  | { kind: 'flavour'; source: 'ai' | 'fallback'; headline: string; scene: string; warnings: string[] }
  | { kind: 'whatif'; source: 'ai' | 'fallback'; text: string; warnings: string[] }
  | { kind: 'recap'; source: 'ai' | 'fallback'; text: string; warnings: string[] }
  | { kind: 'coach'; source: 'ai' | 'fallback'; text: string; warnings: string[] };

export interface AiErrorResponse {
  error: string;
  code: 'invalid_request' | 'upstream_error' | 'timeout' | 'disabled' | 'schema_mismatch' | 'rate_limited';
}
