import type { GameState, Policy } from '../../types/domain';

/** TODO(Agent 1): call previewPolicy(state, draftPolicy) once its canonical
 * selector and return type exist. Do not derive or simulate a forecast here. */
export function PolicyPreview({ state, draftPolicy }: { state: GameState; draftPolicy: Policy }) {
  void state; void draftPolicy;
  return <aside aria-label="12-month policy preview">Preview unavailable · 12 months</aside>;
}
