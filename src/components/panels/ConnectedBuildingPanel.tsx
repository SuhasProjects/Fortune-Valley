import { useGameStore } from '../../stores/useGameStore';
import type { BuildingId } from '../../types/domain';
import { BuildingPanel } from './panelRegistry';

/** Store integration only; no alternate model/action contracts or calculations. */
export function ConnectedBuildingPanel({ building }: { building: BuildingId }) {
  const state = useGameStore(store => store.game);
  const dispatch = useGameStore(store => store.dispatchAction);
  if (!state) return null;
  return <BuildingPanel building={building} state={state} dispatch={dispatch} />;
}
