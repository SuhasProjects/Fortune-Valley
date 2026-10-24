import { useState } from 'react';
import type { BuildingId, GameState } from '../../../types/domain';
import { applyAction } from '../../../engine';
import { BuildingPanel } from '../panelRegistry';
import type { PanelDispatch } from '../panelTypes';
import { stressFixtures } from './stressFixtures';

const buildings: BuildingId[] = ['bank', 'market', 'hospital', 'home', 'office'];
function StressCase({ title, initialState }: { title: string; initialState: GameState }) {
  const [state, setState] = useState(() => structuredClone(initialState));
  const dispatch: PanelDispatch = action => {
    const result = applyAction(state, action);
    if (result.ok) setState(result.state);
    return result;
  };
  return <section aria-label={title}><h2>{title}</h2>{buildings.map(building => <BuildingPanel key={building} building={building} state={state} dispatch={dispatch} />)}</section>;
}
export function StressStatesPage() {
  const [fixtures] = useState(stressFixtures);
  return <main><h1>Financial panels · stress states</h1>
    <p>Fixture sandbox · Changes stay on this page.</p>
    {fixtures.map(fixture => <StressCase key={fixture.id} title={fixture.title} initialState={fixture.state} />)}
  </main>;
}
