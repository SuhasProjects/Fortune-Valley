import { describe, expect, it } from 'vitest';
import { archetypeConfig } from '@/config/archetypes';
import { applyAction, createGame } from '@/engine';
import type { GameEvent } from '@/types/domain';
const event = (): GameEvent => ({ id: 'review', type: 'B', title: 'Budget review', body: 'Optional review', buildingTarget: 'home', source: 'fallback', createdAtMonth: 0, expiresAtMonth: 1, options: [{ id: 'keep', label: 'Keep current policy', description: '', effect: { template: 'none' } }] });
const state = () => createGame(archetypeConfig('entry_worker', 42));
describe('narrative decision boundaries', () => {
  it('rejects invalid metadata and ambiguous option identifiers without mutating state', () => {
    const invalid = [
      { ...event(), buildingTarget: 'invalid' as never },
      { ...event(), type: 'A' as const, source: 'engine' as const },
      { ...event(), options: [] },
      { ...event(), options: [...event().options, ...event().options] },
      { ...event(), expiresAtMonth: -1 },
    ];
    for (const ev of invalid) {
      const original = state(), result = applyAction(original, { type: 'enqueue_event', event: ev });
      expect(result.ok).toBe(false);
      expect(result.state).toBe(original);
    }
  });
  it('preserves a structured choice when the player keeps the current policy', () => {
    const ev = event(), queued = applyAction(state(), { type: 'enqueue_event', event: ev });
    expect(queued.ok).toBe(true);
    const action = { type: 'apply_event_option' as const, eventId: ev.id, optionId: 'keep' };
    const result = applyAction(queued.state, action);
    expect(result.ok).toBe(true);
    expect(result.state.policyLog[0]).toMatchObject({ action, resolvedEffect: { template: 'none' } });
    expect(result.state.timeline.at(-1)?.action).toEqual(action);
  });
  it('copies an enqueued event so later caller edits cannot alter an available choice', () => {
    const ev = event(), result = applyAction(state(), { type: 'enqueue_event', event: ev });
    ev.options[0]!.label = 'Mutated outside engine';
    expect(result.state.activeEvents[0]?.options[0]?.label).toBe('Keep current policy');
  });
});
