import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { BuildingId } from '../../types/domain';
import { Modal } from '../../ui';
import { BuildingPortrait } from '../../game/art/Sprite';
import { useStageScale } from '../../game/stage/GameStage';
import { sfx } from '../../game/audio/sfx';
import { buildings } from './buildings';
import { KeeperGreeting } from '../panels/KeeperGreeting';
import { WindowHelpContext } from '../panels/WindowHelpContext';
import '../panels/windows.css';

export interface PanelHostProps { building?: BuildingId; title?: string; onClose: () => void; children: ReactNode }
/** Compatibility host for existing callers; all dialog behavior belongs to the kit. */
export function PanelHost({ building, title, onClose, children }: PanelHostProps) {
  const { px } = useStageScale();
  const [helpTarget, setHelpTarget] = useState<HTMLSpanElement | null>(null);
  useEffect(() => { sfx('open'); }, [building]);
  function close() { sfx('close'); onClose(); }
  return <Modal title={title ?? (building ? buildings[building].title : 'Your story')} onClose={close} width={building ? 'lg' : 'md'}
    plaque={building && <span className="ft-building-portrait" data-building={building} style={{ '--portrait-px': `${Math.max(1, Math.floor(px / 4))}px` } as CSSProperties}><BuildingPortrait building={building}/></span>}
    headerExtra={building && <><span className="ft-window-hint">{buildings[building].hint}</span><span className="ft-window-help-slot" ref={setHelpTarget}/></>}>
    <WindowHelpContext.Provider value={helpTarget}>
      {building && <KeeperGreeting building={building}/> }
      {children}
    </WindowHelpContext.Provider>
  </Modal>;
}
