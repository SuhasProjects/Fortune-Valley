/** Presentation-only adapter. Replace its mapping when the canonical domain/store land.
 * Values (including totals and pay estimates) must be supplied by engine selectors.
 * This is deliberately NOT a GameState or GameAction definition.
 */
export type Building = 'bank' | 'market' | 'office' | 'home' | 'insurance';
export type Asset = 'stock' | 'bond' | 'etf';
export type Coverage = 'health' | 'auto' | 'home' | 'renters';
export interface MoneyField { value: number; min: number; max: number; step: number; unavailableReason?: string }
export interface HistoryRow { id: string; month: string; description: string; amount: number }
export interface PanelModel {
  editable: boolean;
  integrationNotes?: string[];
  cash: number;
  savings: number;
  netWorth: number;
  savingsContribution: MoneyField;
  investmentContribution: MoneyField;
  discretionaryBudget: MoneyField;
  debts: { id: string; name: string; balance: number; apr: number; minimumDue: number; extraPayment: MoneyField }[];
  allocation: Record<Asset, number>; // fractions, from the engine's last valid policy
  positions: Record<Asset, number>;
  marketAssumptions: { asset: Asset; annualReturn: number; annualVolatility: number }[];
  employment: { status: string; grossAnnual: number; grossMonthly?: number; withholdingMonthly?: number; takeHomeMonthly?: number; monthlyContext?: string; lastPaycheck?: HistoryRow };
  housing: { description: string; rentMonthly: number; essentialsMonthly: number; recurring: { id: string; label: string; amount: number }[] };
  insurance: {
    selected: Partial<Record<Coverage, string>>;
    plans: { id: string; kind: Coverage; name: string; premiumMonthly: number; deductible: number; coverageLimit: number; assumptions: string; available: boolean }[];
    claims: HistoryRow[];
    readOnlyPlans?: { id: string; name: string; premiumMonthly: number; deductible: number; coverageDescription: string }[];
  };
  history: Partial<Record<Building, HistoryRow[]>>;
  event?: { id: string; building: Building; title: string; body: string; source: 'engine' | 'ai' | 'fallback'; options: { id: string; label: string; description?: string; disabledReason?: string }[] };
}
/** Integration intents, not engine actions. The host maps them to canonical actions. */
export type PanelCommand =
  | { kind: 'save_savings'; monthlyAmount: number }
  | { kind: 'pay_debt'; debtId: string; amount: number }
  | { kind: 'save_investments'; monthlyAmount: number; allocation: Record<Asset, number> }
  | { kind: 'save_budget'; monthlyAmount: number }
  | { kind: 'choose_insurance'; coverage: Coverage; planId: string }
  | { kind: 'choose_event'; eventId: string; optionId: string };
export type CommandResult = { ok: true; message?: string } | { ok: false; error: string };
export interface BuildingPanelProps {
  building: Building;
  model: PanelModel;
  onCommand: (command: PanelCommand) => CommandResult | Promise<CommandResult>;
  onNavigate?: (building: Building) => void;
}
export type PanelProps = Omit<BuildingPanelProps, 'building'>;
