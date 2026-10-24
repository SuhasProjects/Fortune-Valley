import { useGameStore } from '../../stores/useGameStore';
import type { BuildingId } from '../../types/domain';
import { EventCard } from '../flow/EventCard';
import { PanelHost } from '../town/PanelHost';
import { ConnectedBuildingPanel } from './ConnectedBuildingPanel';

/** Public window contract. Agent 4 mounts this instead of composing events in App. */
export function BuildingWindow({ building, onClose }: { building: BuildingId; onClose: () => void }) {
  const game = useGameStore(store => store.game);
  const dispatch = useGameStore(store => store.dispatchAction);
  if (!game) return null;

  // OfficePanel owns job offers; preserve the existing App exclusion until integration.
  const events = game.activeEvents.filter(event => event.buildingTarget === building
    && !(building === 'office' && event.type === 'B'));
  return <PanelHost building={building} onClose={onClose}>
    {events.map(event => <EventCard key={event.id} event={event}
      onChoose={optionId => dispatch({ type: 'apply_event_option', eventId: event.id, optionId })} />)}
    <ConnectedBuildingPanel building={building} />
  </PanelHost>;
}
