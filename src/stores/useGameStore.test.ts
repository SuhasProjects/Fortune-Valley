import { beforeEach, describe, expect, it } from 'vitest';
import { scenarios } from '../data/scenarios';
import { fixtureEventB } from '../fixtures';
import { useGameStore } from './useGameStore';

beforeEach(() => useGameStore.getState().resetGame());

describe('game store', () => {
  it.each(scenarios)('advances $scenarioId for 12 months', (scenario) => {
    useGameStore.getState().startGame(scenario);
    for (let i = 0; i < 12; i++) useGameStore.getState().advanceOneMonth();
    expect(useGameStore.getState().game?.monthIndex).toBe(12);
  });
  it('pause prevents month advancement', () => {
    useGameStore.getState().startGame(scenarios[0]!);
    useGameStore.getState().setPaused(true);
    useGameStore.getState().advanceOneMonth();
    expect(useGameStore.getState().game?.monthIndex).toBe(0);
  });
  it('records and persists policy changes at exact month', () => {
    useGameStore.getState().startGame(scenarios[1]!);
    useGameStore.getState().advanceOneMonth();
    useGameStore.getState().dispatchAction({ type: 'set_contributions', savingsContributionPerMonth: 333, investmentContributionPerMonth: 222 });
    const game = useGameStore.getState().game!;
    expect(game.policy.savingsContributionPerMonth).toBe(333);
    expect(game.policyLog[0]?.monthIndex).toBe(1);
    for (let i = 0; i < 3; i++) useGameStore.getState().advanceOneMonth();
    expect(useGameStore.getState().game!.policy.savingsContributionPerMonth).toBe(333);
  });
  it('posts one unique notification set for a month without duplicates', () => {
    useGameStore.getState().startGame(scenarios[0]!);
    const initialCount = useGameStore.getState().game!.notifications.length;
    useGameStore.getState().advanceOneMonth();
    const notifications = useGameStore.getState().game!.notifications;
    const newlyPosted = notifications.slice(initialCount);
    expect(notifications.length).toBeGreaterThan(0);
    expect(new Set(notifications.map((item) => item.id)).size).toBe(notifications.length);
    expect(newlyPosted.length).toBeGreaterThan(0);
    expect(newlyPosted.every((item) => item.monthIndex === useGameStore.getState().game!.monthIndex - 1)).toBe(true);
  });
  it('routes a Type B event to its building and cannot resolve it twice', () => {
    useGameStore.getState().startGame(scenarios[1]!);
    const enqueue = useGameStore.getState().dispatchAction({ type: 'enqueue_event', event: fixtureEventB });
    expect(enqueue?.ok).toBe(true);
    expect(useGameStore.getState().game!.activeEvents[0]?.buildingTarget).toBe(fixtureEventB.buildingTarget);
    const action = { type: 'apply_event_option' as const, eventId: fixtureEventB.id, optionId: fixtureEventB.options[0]!.id };
    expect(useGameStore.getState().dispatchAction(action)?.ok).toBe(true);
    const after = useGameStore.getState().game;
    const duplicate = useGameStore.getState().dispatchAction(action);
    expect(duplicate?.ok).toBe(false);
    expect(duplicate && !duplicate.ok ? duplicate.code : null).toBe('unknown_event');
    expect(useGameStore.getState().game).toBe(after);
  });
  it('invalidates pending request versions when a newer game starts', () => {
    const before = useGameStore.getState().requestVersion;
    useGameStore.getState().startGame(scenarios[0]!);
    const first = useGameStore.getState().requestVersion;
    useGameStore.getState().startGame(scenarios[1]!);
    expect(first).toBe(before + 1);
    expect(useGameStore.getState().requestVersion).toBe(first + 1);
  });
  it('rejects an invalid allocation without mutating state', () => {
    useGameStore.getState().startGame(scenarios[1]!);
    const before = useGameStore.getState().game!;
    const r = useGameStore.getState().dispatchAction({ type: 'set_allocation', allocation: { stock: 0.7, bond: 0.7, etf: 0 } });
    expect(r?.ok).toBe(false);
    expect(useGameStore.getState().game).toBe(before);
    expect(useGameStore.getState().lastActionError).toMatch(/sum to 1/);
  });
  it('produces a finish payload with a computed Monte Carlo result', () => {
    useGameStore.getState().startGame(scenarios[2]!);
    useGameStore.getState().dispatchAction({ type: 'set_allocation', allocation: { stock: 0.1, bond: 0.3, etf: 0.6 } });
    for (let i = 0; i < 6; i++) useGameStore.getState().advanceOneMonth();
    useGameStore.getState().finishGame();
    const s = useGameStore.getState();
    expect(s.finishPayload?.policyLog).toHaveLength(1);
    expect(s.finishPayload?.finalState.status).toBe('finished');
    expect(s.finishPayload?.monteCarlo.pathsCompleted).toBe(1000);
    expect(s.finishPayload?.monteCarlo.observedNetWorth).toBeCloseTo(s.finishPayload!.monteCarlo.observedNetWorth);
  });
  it('does not retain personalized free text in game state', async () => {
    const privateText = 'my private details about a student loan';
    const result = await useGameStore.getState().generatePersonalized(privateText);
    expect(result.fallback).toBe(true);
    useGameStore.getState().startGame(result.config);
    expect(JSON.stringify(useGameStore.getState().game)).not.toContain('private details');
  });
});
