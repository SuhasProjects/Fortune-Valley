import type { ActionResult, BuildingId, GameAction, GameState } from '../../types/domain';

export type PanelDispatch = (action: GameAction) => ActionResult | null | Promise<ActionResult | null>;
export interface PanelProps { state: GameState; dispatch: PanelDispatch }
export interface BuildingPanelProps extends PanelProps { building: BuildingId }
