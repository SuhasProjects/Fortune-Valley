import { describe, expect, it } from 'vitest';
import { archetypeConfig } from '@/config/archetypes';
import { createGame, validateConfig } from '@/engine';
import type { GameConfig } from '@/types/domain';

const config = () => archetypeConfig('entry_worker', 42, { durationMonths: 6 });
describe('configuration validation', () => {
  const cases: [string, (c: GameConfig) => void][] = [
    ['impossible calendar month', c => { c.startMonth = '2026-13'; }],
    ['fractional seed', c => { c.seed = .5; }],
    ['invalid return', c => { c.assumptions.assets.stock.expectedAnnualReturn = -1; }],
    ['nonfinite volatility', c => { c.assumptions.assets.etf.annualVolatility = NaN; }],
    ['invalid correlation', c => { c.assumptions.correlation.stockEtf = 2; }],
    ['negative savings rate', c => { c.assumptions.savingsApy = -.5; }],
    ['invalid shock probability', c => { c.assumptions.shocks[0]!.monthlyIncidence = 1.1; }],
    ['inverted severity bounds', c => { c.assumptions.shocks[0]!.costMin = 1e6; }],
    ['invalid claim share', c => { c.assumptions.insurancePlans[0]!.coinsurance = -1; }],
    ['duplicate plan identifier', c => { c.assumptions.insurancePlans.push(structuredClone(c.assumptions.insurancePlans[0]!)); }],
    ['invalid withholding rate', c => { c.assumptions.tax.brackets[0]!.rate = 5; }],
    ['unordered tax brackets', c => { c.assumptions.tax.brackets[1]!.upTo = 1; }],
    ['invalid unemployment interval', c => { c.assumptions.employment.unemploymentDurationMonthsMax = 0; }],
    ['invalid employment status', c => { c.initialState.employment.status = 'invalid' as never; }],
    ['unknown funding source', c => { c.initialState.policy.emergencyFundingOrder = ['invalid' as never]; }],
    ['duplicate funding source', c => { c.initialState.policy.emergencyFundingOrder = ['savings', 'savings']; }],
    ['mismatched active insurance', c => { c.initialState.insurance.health = null; }],
  ];
  it.each(cases)('rejects %s before a run can produce corrupt balances', (_label, modify) => {
    const c = config(); modify(c);
    expect(validateConfig(c).ok).toBe(false);
    expect(() => createGame(c)).toThrow('Invalid GameConfig');
  });
  it('returns a validation failure for malformed persisted configurations', () => {
    for (const value of [null, {}, { initialState: {} }]) {
      expect(() => validateConfig(value as GameConfig)).not.toThrow();
      expect(validateConfig(value as GameConfig).ok).toBe(false);
    }
  });
  it('preserves valid defaults', () => { expect(validateConfig(config()).ok).toBe(true); });
});
