import type { BuildingId } from '../../types/domain';
import { useGameStore } from '../../stores/useGameStore';
import { useReducedMotion } from '../../ui';

export const KEEPER_LINES: Record<BuildingId, readonly string[]> = {
  bank: ['A little set aside each month becomes a cushion.', 'Welcome back. A steady habit can start small.'],
  office: ['Pull up a chair. Let\'s see what\'s on the noticeboard.', 'Every new chapter starts somewhere.'],
  hospital: ['Welcome in. Take your time comparing the plans.', 'A little preparation can bring some peace of mind.'],
  home: ['The kettle\'s on, and the cat saved you a seat.', 'Make a little room for the things you enjoy.'],
  market: ['Welcome to the hall. Have a look around.', 'There\'s more than one basket on these shelves.'],
};
export function KeeperGreeting({ building }: { building: BuildingId }) {
  const month = useGameStore(store => store.game?.monthIndex ?? 0);
  const reduced = useReducedMotion();
  const lines = KEEPER_LINES[building];
  return <div className="ft-keeper" data-reduce-motion={reduced || undefined}>
    <span className={`ft-keeper__portrait ft-keeper__portrait--${building}`} role="img" aria-label={building === 'home' ? 'You and your cat' : `${building === 'hospital' ? 'Nurse' : building === 'bank' ? 'Banker' : building === 'office' ? 'Town clerk' : 'Market keeper'} portrait`}/>
    <p>{lines[month % lines.length]}</p>
  </div>;
}
