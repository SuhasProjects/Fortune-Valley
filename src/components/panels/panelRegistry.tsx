import type { BuildingPanelProps } from './contracts';
import { BankPanel } from './BankPanel';
import { MarketPanel } from './MarketPanel';
import { OfficePanel } from './OfficePanel';
import { HomePanel } from './HomePanel';
import { InsurancePanel } from './InsurancePanel';
import './panels.css';
export const panelRegistry = { bank: BankPanel, market: MarketPanel, office: OfficePanel, home: HomePanel, insurance: InsurancePanel };
/** Content only. Town's PanelHost owns dialog semantics, Escape, close, and focus restoration.
 * Keying by building prevents pending feedback/drafts leaking between buildings.
 */
export function BuildingPanel({ building, ...props }: BuildingPanelProps) {
  const Panel = panelRegistry[building];
  return <div>{props.model.integrationNotes?.length ? <aside className="ft-panel" aria-label="Prototype limitations">{props.model.integrationNotes.map(note => <p key={note}>{note}</p>)}</aside> : null}<Panel key={building} {...props} /></div>;
}
