import type { ComponentType } from 'react';
import type { BuildingId } from '../../types/domain';
import type { BuildingPanelProps, PanelProps } from './panelTypes';
import { BankPanel } from './canonical/BankPanel';
import { MarketPanel } from './canonical/MarketPanel';
import { InsurancePanel } from './canonical/InsurancePanel';
import { HomePanel } from './canonical/HomePanel';
import { OfficePanel } from './canonical/OfficePanel';

export const panelRegistry: Record<BuildingId, ComponentType<PanelProps>> = {
  bank: BankPanel, market: MarketPanel, hospital: InsurancePanel, home: HomePanel, office: OfficePanel
};
export function BuildingPanel({ building, state, dispatch }: BuildingPanelProps) {
  const Panel = panelRegistry[building];
  return <Panel key={building} state={state} dispatch={dispatch} />;
}
