import { useMemo } from 'react';
import type { GameState } from '../../types/domain';
import { applyAction, previewMonth } from '../../engine';
import { money } from './canonical/shared';

export function PaymentPreview({ state, debtId, amount }: { state: GameState; debtId: string; amount: number }) {
  const result = useMemo(() => {
    const action = applyAction(state, { type: 'make_extra_payment', debtId, amount });
    return action.ok ? { state: action.state, next: previewMonth(action.state, {}) } : null;
  }, [state, debtId, amount]);
  if (!result) return null;
  const debt = result.state.debts.find(value => value.id === debtId);
  return <aside className="ft-preview" aria-label="One-time payment preview">
    <p>After payment · cash {money(result.state.cash)} · debt {money(debt?.balance ?? 0)}</p>
    <details><summary>Next month</summary><p>Cash · {money(result.next.withChange.cash)}</p><small>Illustrative · same simulated luck</small></details>
  </aside>;
}
