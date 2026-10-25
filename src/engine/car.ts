/**
 * Car ownership rules. Owner: Agent 1.
 *
 * - A life has a car when `state.car.owned` is true. An `auto_loan` debt with a balance always implies a
 *   car (you cannot sell what the bank still owns), so `normalizeCar` forces `owned` on while one exists.
 * - Owning a car bills `CAR_BANDS[band].runningCost` every month as its own `car_costs` ledger line,
 *   makes the auto shock possible (its median cost scales with the band) and unlocks auto insurance,
 *   whose premium scales mildly with the band. No resale value is tracked: toggling the car on or off
 *   changes running costs and risk only, never cash or net worth.
 * - Without a car the engine never bills an auto premium, never rolls an auto shock, and rejects
 *   choosing an auto plan; dropping the car also drops any auto plan.
 */
import type { CarState, CarValueBand, Debt, GameState, InsurancePlan } from '@/types/domain';
import { CAR_VALUE_BANDS } from '@/types/domain';
import { CAR_BANDS } from '@/config/defaults';
import { round2 } from './accounting';

export const NO_CAR: CarState = { owned: false, valueBand: 'none' };

/** Band implied by an auto loan's balance when a save or config predates car ownership. */
export function bandFromLoanBalance(balance: number): Exclude<CarValueBand, 'none'> {
  return balance >= 25_000 ? 'nice' : balance >= 12_000 ? 'mid' : 'cheap';
}

/** Band implied by a quoted monthly running cost (letter / scenario mapping). */
export function bandFromMonthlyCost(monthly: number): Exclude<CarValueBand, 'none'> {
  return monthly <= 220 ? 'cheap' : monthly <= 320 ? 'mid' : 'nice';
}

export function isCarState(c: unknown): c is CarState {
  return !!c && typeof c === 'object' && typeof (c as CarState).owned === 'boolean' && CAR_VALUE_BANDS.includes((c as CarState).valueBand)
    && ((c as CarState).owned ? (c as CarState).valueBand !== 'none' : (c as CarState).valueBand === 'none');
}

/** A valid CarState for `debts`: missing → inferred from any auto loan; an outstanding auto loan forces `owned`. */
export function normalizeCar(car: CarState | undefined, debts: readonly Pick<Debt, 'kind' | 'balance'>[]): CarState {
  const loan = debts.filter((d) => d.kind === 'auto_loan').sort((a, b) => b.balance - a.balance)[0];
  if (car && isCarState(car)) {
    if (!car.owned && loan && loan.balance > 0) return { owned: true, valueBand: bandFromLoanBalance(loan.balance) };
    return { owned: car.owned, valueBand: car.valueBand };
  }
  return loan ? { owned: true, valueBand: bandFromLoanBalance(loan.balance) } : { ...NO_CAR };
}

export function hasCar(s: Pick<GameState, 'debts'> & { car?: CarState }): boolean {
  return normalizeCar(s.car, s.debts).owned;
}

export function carBand(s: Pick<GameState, 'debts'> & { car?: CarState }): CarValueBand {
  return normalizeCar(s.car, s.debts).valueBand;
}

/** Monthly fuel + maintenance + registration for the band; 0 without a car. */
export function carRunningCost(band: CarValueBand): number {
  return CAR_BANDS[band].runningCost;
}

/** Premium actually billed for an auto plan given the car's band (other lines are unchanged). */
export function premiumFor(plan: InsurancePlan, band: CarValueBand): number {
  if (plan.line !== 'auto') return plan.monthlyPremium;
  return round2(plan.monthlyPremium * (CAR_BANDS[band].premiumScale || 1));
}

/** Auto shock median for the band (other shocks are unchanged). */
export function shockMedianFor(coveredBy: InsurancePlan['line'], median: number, band: CarValueBand): number {
  if (coveredBy !== 'auto') return median;
  return median * (CAR_BANDS[band].shockScale || 1);
}

export function describeCar(car: CarState): string {
  return car.owned ? `${CAR_BANDS[car.valueBand].label} car (${CAR_BANDS[car.valueBand].value})` : 'No car';
}
