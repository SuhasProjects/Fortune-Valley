import { describe, expect, it } from 'vitest';
import { archetypeConfig, ARCHETYPES } from '@/config/archetypes';
import { CAR_BANDS } from '@/config/defaults';
import { advanceMonth, applyAction, createGame, hasCar, listDecisions, changedPolicyLog, parseSave, premiumFor, previewMonth, serializeSave, validateConfig } from '@/engine';
import { normalizeCar } from '@/engine/car';
import { validateCar } from '@/engine/validation';
import { fallbackScenario } from '@/services/aiFallback';
import { scenarioToConfig, proposalToEvent } from '@/services/scenarioMapper';
import { ScenarioProposalSchema, PersonalizedInputSchema } from '../../api/_lib/schemas';
import type { ArchetypeId, GameState } from '@/types/domain';

const start = (id: ArchetypeId, seed = 7, months = 24): GameState => applyAction(createGame(archetypeConfig(id, seed, { durationMonths: months })), { type: 'resume' }).state;
const play = (s: GameState, n: number) => { for (let i = 0; i < n; i++) s = advanceMonth(s); return s; };
const sum = (s: GameState, category: string) => s.ledger.filter((e) => e.category === category && e.account === 'cash').reduce((a, e) => a + e.amountSigned, 0);

describe('car ownership: config and defaults', () => {
  it('archetypes carry the documented bands and hasCar follows state.car.owned', () => {
    expect(ARCHETYPES.college_student.initialState.car).toEqual({ owned: false, valueBand: 'none' });
    expect(ARCHETYPES.entry_worker.initialState.car).toEqual({ owned: true, valueBand: 'cheap' });
    expect(ARCHETYPES.professional.initialState.car).toEqual({ owned: true, valueBand: 'mid' });
    expect(ARCHETYPES.young_family.initialState.car).toEqual({ owned: true, valueBand: 'mid' });
    expect(hasCar(start('college_student'))).toBe(false);
    expect(hasCar(start('entry_worker'))).toBe(true);
  });
  it('a config without a car infers it from any auto loan (old configs), and validation rejects inconsistent cars', () => {
    const cfg = archetypeConfig('entry_worker', 1);
    delete cfg.initialState.car;
    expect(validateConfig(cfg).ok).toBe(true);
    expect(createGame(cfg).car).toEqual({ owned: true, valueBand: 'cheap' });
    const student = archetypeConfig('college_student', 1);
    delete student.initialState.car;
    expect(createGame(student).car).toEqual({ owned: false, valueBand: 'none' });
    expect(normalizeCar(undefined, [{ kind: 'auto_loan', balance: 30_000 }])).toEqual({ owned: true, valueBand: 'nice' });
    for (const bad of [{ owned: true, valueBand: 'none' }, { owned: false, valueBand: 'mid' }, { owned: 'yes', valueBand: 'mid' }, { owned: true, valueBand: 'gold' }]) {
      const c = archetypeConfig('entry_worker', 1);
      c.initialState.car = bad as never;
      expect(validateConfig(c).ok).toBe(false);
    }
    expect(validateCar({ owned: false, valueBand: 'none' }, [{ kind: 'auto_loan', balance: 500 }]).ok).toBe(false);
    expect(validateCar({ owned: false, valueBand: 'none' }, [{ kind: 'auto_loan', balance: 0 }]).ok).toBe(true);
  });
  it('an outstanding auto loan forces the car on, even when the config says otherwise', () => {
    const cfg = archetypeConfig('entry_worker', 1);
    cfg.initialState.car = { owned: false, valueBand: 'none' };
    expect(validateConfig(cfg).ok).toBe(true); // the field itself is well-formed; createGame applies the loan rule
    expect(createGame(cfg).car).toEqual({ owned: true, valueBand: 'cheap' });
  });
});

describe('car ownership: monthly billing', () => {
  it('bills car running costs as their own ledger line only when a car is owned, by band', () => {
    const worker = play(start('entry_worker'), 3);
    expect(sum(worker, 'car_costs')).toBeCloseTo(-3 * CAR_BANDS.cheap.runningCost, 2);
    expect(worker.ledger.find((e) => e.category === 'car_costs')!.description).toMatch(/Car running costs/);
    const pro = play(start('professional'), 2);
    expect(sum(pro, 'car_costs')).toBeCloseTo(-2 * CAR_BANDS.mid.runningCost, 2);
    const student = play(start('college_student'), 3);
    expect(sum(student, 'car_costs')).toBe(0);
    expect(student.ledger.some((e) => e.category === 'car_costs')).toBe(false);
  });
  it('never bills an auto premium without a car, even if a plan id is on file', () => {
    const s = start('college_student');
    s.insurance.auto = 'auto_liability'; s.policy.insurancePlanIds.auto = 'auto_liability'; // corrupt-ish state: plan without a car
    const later = play(s, 4);
    expect(later.ledger.filter((e) => e.category === 'insurance_premium' && /Auto/.test(e.description))).toHaveLength(0);
    expect(later.ledger.filter((e) => e.category === 'insurance_premium' && /Health/.test(e.description))).toHaveLength(4);
  });
  it('auto premium scales mildly with the band; health premiums do not', () => {
    const plans = archetypeConfig('entry_worker', 1).assumptions.insurancePlans;
    const liability = plans.find((p) => p.id === 'auto_liability')!;
    const health = plans.find((p) => p.id === 'health_basic')!;
    expect(premiumFor(liability, 'cheap')).toBeLessThan(liability.monthlyPremium);
    expect(premiumFor(liability, 'mid')).toBe(liability.monthlyPremium);
    expect(premiumFor(liability, 'nice')).toBeGreaterThan(liability.monthlyPremium);
    expect(premiumFor(health, 'nice')).toBe(health.monthlyPremium);
    const worker = play(start('entry_worker'), 1);
    expect(worker.ledger.find((e) => e.category === 'insurance_premium' && /Auto/.test(e.description))!.amountSigned).toBeCloseTo(-premiumFor(liability, 'cheap'), 2);
  });
  it('auto shocks are skipped without a car and their median scales with the band on the same seed', () => {
    let nice = 0, cheap = 0, none = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const base = archetypeConfig('professional', seed, { durationMonths: 60 });
      const withBand = (band: 'cheap' | 'nice' | 'none') => {
        const cfg = structuredClone(base);
        cfg.initialState.debts = cfg.initialState.debts.filter((d) => d.kind !== 'auto_loan');
        cfg.initialState.car = band === 'none' ? { owned: false, valueBand: 'none' } : { owned: true, valueBand: band };
        if (band === 'none') { cfg.initialState.insurance.auto = null; cfg.initialState.policy.insurancePlanIds.auto = null; }
        return play(applyAction(createGame(cfg), { type: 'resume' }).state, 60);
      };
      const n = withBand('nice'), c = withBand('cheap'), z = withBand('none');
      const autos = (s: GameState) => s.realizedShocks.filter((r) => r.shock.kind === 'auto');
      expect(autos(n).map((r) => r.monthIndex)).toEqual(autos(c).map((r) => r.monthIndex)); // same months, band changes cost only
      expect(autos(z)).toHaveLength(0);
      none += autos(z).length; nice += autos(n).reduce((a, r) => a + r.shock.grossCost, 0); cheap += autos(c).reduce((a, r) => a + r.shock.grossCost, 0);
    }
    expect(none).toBe(0);
    expect(nice).toBeGreaterThan(cheap);
  });
});

describe('car ownership: set_car action', () => {
  it('validates, logs a replayable choice, and drops the auto plan when the car goes', () => {
    const s = start('professional');
    expect(applyAction(s, { type: 'set_car', owned: true, valueBand: 'none' }).ok).toBe(false);
    expect(applyAction(s, { type: 'set_car', owned: false, valueBand: 'mid' }).ok).toBe(false);
    expect(applyAction(s, { type: 'set_car', owned: true, valueBand: 'gold' as never }).ok).toBe(false);
    // Financed: the professional still owes on the car.
    const sell = applyAction(s, { type: 'set_car', owned: false, valueBand: 'none' });
    expect(sell.ok).toBe(false); if (!sell.ok) expect(sell.message).toMatch(/Pay off the car loan/);
    const upgrade = applyAction(s, { type: 'set_car', owned: true, valueBand: 'nice' });
    expect(upgrade.ok).toBe(true);
    if (!upgrade.ok) return;
    expect(upgrade.state.car).toEqual({ owned: true, valueBand: 'nice' });
    expect(upgrade.state.cash).toBe(s.cash); // no resale value: cash untouched
    expect(upgrade.state.policyLog.at(-1)!.action).toEqual({ type: 'set_car', owned: true, valueBand: 'nice' });
    expect(upgrade.state.timeline.at(-1)!.description).toMatch(/Nice car/);
    // Paid off → can sell; auto cover goes with the car.
    const paid = structuredClone(s); paid.debts = paid.debts.map((d) => d.kind === 'auto_loan' ? { ...d, balance: 0 } : d);
    const sold = applyAction(paid, { type: 'set_car', owned: false, valueBand: 'none' });
    expect(sold.ok).toBe(true);
    if (!sold.ok) return;
    expect(hasCar(sold.state)).toBe(false);
    expect(sold.state.insurance.auto).toBeNull(); expect(sold.state.policy.insurancePlanIds.auto).toBeNull();
    const after = play(sold.state, 2);
    expect(after.ledger.some((e) => e.category === 'car_costs')).toBe(false);
    expect(after.ledger.some((e) => e.category === 'insurance_premium' && /Auto/.test(e.description))).toBe(false);
  });
  it('buying a car mid-run starts running costs and unlocks auto cover; choosing auto cover without a car is refused', () => {
    const student = start('college_student');
    const refused = applyAction(student, { type: 'set_insurance', line: 'auto', planId: 'auto_liability' });
    expect(refused.ok).toBe(false); if (!refused.ok) expect(refused.message).toMatch(/No car on file/);
    expect(applyAction(student, { type: 'set_insurance', line: 'auto', planId: null }).ok).toBe(true); // none is always allowed
    const bought = applyAction(student, { type: 'set_car', owned: true, valueBand: 'cheap' });
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(applyAction(bought.state, { type: 'set_insurance', line: 'auto', planId: 'auto_liability' }).ok).toBe(true);
    const later = play(bought.state, 2);
    expect(sum(later, 'car_costs')).toBeCloseTo(-2 * CAR_BANDS.cheap.runningCost, 2);
  });
  it('preview and what-if see the car: the month preview shows the running cost, and the decision is flippable', () => {
    const s = start('college_student');
    const p = previewMonth(s, { car: { owned: true, valueBand: 'mid' } });
    expect(p.rejected).toEqual([]);
    expect(p.delta.cash).toBeCloseTo(-CAR_BANDS.mid.runningCost, 2);
    const cfg = archetypeConfig('college_student', 7, { durationMonths: 24 });
    const decided = applyAction(s, { type: 'set_car', owned: true, valueBand: 'mid' });
    if (!decided.ok) throw new Error('set_car failed');
    const decisions = listDecisions(cfg, decided.state.policyLog);
    const mine = decisions.find((d) => d.logIndex === 0)!;
    expect(mine.label).toMatch(/Own a mid-range car/);
    expect(mine.alternatives.map((a) => a.id)).toEqual(expect.arrayContaining(['undo', 'car:none', 'car:cheap', 'car:nice']));
    expect(changedPolicyLog(cfg, decided.state.policyLog, mine.id, 'car:none').log[0]!.action).toEqual({ type: 'set_car', owned: false, valueBand: 'none' });
    // Hypotheticals: a car-less life can try owning one from the start; a financed life cannot try going without.
    expect(decisions.find((d) => d.id === 'hyp:car')!.alternatives.map((a) => a.id)).toEqual(['car:cheap', 'car:mid', 'car:nice']);
    const pro = listDecisions(archetypeConfig('professional', 1), []).find((d) => d.id === 'hyp:car')!;
    expect(pro.alternatives.map((a) => a.id)).toEqual(['car:cheap', 'car:nice']);
  });
});

describe('car ownership: saves and scenarios', () => {
  it('migrates saves from before car ownership: car inferred from the auto loan, stray auto plans dropped', () => {
    const cfg = archetypeConfig('entry_worker', 11, { durationMonths: 12 });
    const played = play(applyAction(createGame(cfg), { type: 'resume' }).state, 2);
    const raw = JSON.parse(serializeSave(cfg, played)) as { config: { initialState: { car?: unknown } }; state: { car?: unknown; insurance: { auto: string | null }; debts: unknown[] } };
    delete raw.config.initialState.car; delete raw.state.car;
    const parsed = parseSave(JSON.stringify(raw));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.save.state.car).toEqual({ owned: true, valueBand: 'cheap' });
    expect(parsed.save.config.initialState.car).toEqual({ owned: true, valueBand: 'cheap' });
    expect(advanceMonth(parsed.save.state).ledger.some((e) => e.category === 'car_costs')).toBe(true);
    // A car-less old save that somehow held an auto plan loses it on load.
    const scfg = archetypeConfig('college_student', 11, { durationMonths: 12 });
    const student = play(applyAction(createGame(scfg), { type: 'resume' }).state, 1);
    const sraw = JSON.parse(serializeSave(scfg, student)) as { config: { initialState: { car?: unknown } }; state: { car?: unknown; insurance: { auto: string | null }; policy: { insurancePlanIds: { auto: string | null } } } };
    delete sraw.config.initialState.car; delete sraw.state.car; sraw.state.insurance.auto = 'auto_full'; sraw.state.policy.insurancePlanIds.auto = 'auto_full';
    const sparsed = parseSave(JSON.stringify(sraw));
    expect(sparsed.ok).toBe(true);
    if (sparsed.ok) { expect(sparsed.save.state.car).toEqual({ owned: false, valueBand: 'none' }); expect(sparsed.save.state.insurance.auto).toBeNull(); }
    expect(parseSave(JSON.stringify({ ...raw, state: { ...raw.state, car: 'yes' } })).ok).toBe(false);
  });
  it('scenario proposals carry a car: owned flag with band or monthly cost, validated by the gateway schema and mapped to config', () => {
    const base = { baseArchetype: 'college_student' as const, title: 'Commuter student', description: 'Drives to campus.', narrativeFocus: ['budgeting'], defaultsApplied: [] };
    expect(ScenarioProposalSchema.safeParse({ ...base, overrides: { car: { owned: true, monthlyCost: 250 } } }).success).toBe(true);
    expect(ScenarioProposalSchema.safeParse({ ...base, overrides: { car: { owned: true, valueBand: 'none' } } }).success).toBe(false);
    expect(PersonalizedInputSchema.safeParse({ freeText: 'x', car: { owned: false } }).success).toBe(true);
    const byCost = scenarioToConfig({ ...base, overrides: { car: { owned: true, monthlyCost: 250 } } }, 1, 'ai');
    expect(byCost.initialState.car).toEqual({ owned: true, valueBand: 'mid' });
    const byBand = scenarioToConfig({ ...base, overrides: { car: { owned: true, valueBand: 'nice' } } }, 1, 'ai');
    expect(byBand.initialState.car).toEqual({ owned: true, valueBand: 'nice' });
    const bare = scenarioToConfig({ ...base, overrides: { car: { owned: true } } }, 1, 'ai');
    expect(bare.initialState.car).toEqual({ owned: true, valueBand: 'cheap' });
    // Saying "no car" on a car-owning archetype removes the car and its auto plan.
    const noCar = scenarioToConfig({ ...base, baseArchetype: 'professional', overrides: { car: { owned: false }, debts: [] } }, 1, 'ai');
    expect(noCar.initialState.car).toEqual({ owned: false, valueBand: 'none' });
    expect(noCar.initialState.insurance.auto).toBeNull();
    expect(createGame(noCar).status).toBe('setup');
    // An auto loan in the debts wins over "no car".
    const financed = scenarioToConfig({ ...base, overrides: { car: { owned: false }, debts: [{ name: 'Car', kind: 'auto_loan', balance: 14000, apr: 0.07, minimumPayment: 300 }] } }, 1, 'ai');
    expect(financed.initialState.car?.owned).toBe(true);
  });
  it('offline mapping reads the car from the numbers or infers it from the letter', () => {
    expect(fallbackScenario({ freeText: 'I drive to work and rent a flat' }).overrides.car).toEqual({ owned: true });
    expect(fallbackScenario({ freeText: 'I take the bus everywhere' }).overrides.car).toEqual({ owned: false });
    const quiet = fallbackScenario({ freeText: 'I want to save more' });
    expect(quiet.overrides.car).toBeUndefined(); expect(quiet.defaultsApplied).toContain('car');
    expect(fallbackScenario({ freeText: 'I take the bus', car: { owned: true, monthlyCost: 400 } }).overrides.car).toEqual({ owned: true, monthlyCost: 400 });
  });
  it('drops a fallback opportunity that offers auto cover to a life without a car', () => {
    const student = start('college_student');
    const offer = { title: 'Auto insurance quote', body: 'x', buildingTarget: 'hospital' as const, learningNote: 'n', expiresInMonths: 2, options: [{ label: 'Add', description: '', effect: { template: 'change_insurance' as const, line: 'auto' as const, planId: 'auto_liability' } }, { label: 'No', description: '', effect: { template: 'none' as const } }] };
    expect(proposalToEvent(offer, student, 'fallback')).toBeNull();
    expect(proposalToEvent(offer, start('entry_worker'), 'fallback')).not.toBeNull();
  });
});
