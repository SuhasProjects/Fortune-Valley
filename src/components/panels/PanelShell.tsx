import { useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button, Inset } from '../../ui';
import { WindowHelpContext } from './WindowHelpContext';
import './windows.css';

/** Financial-panel presentation only. The host still owns modal lifecycle. */
export function PanelShell({ title, status, decision, consequence, details, help }: {
  title: string;
  status: ReactNode;
  decision: ReactNode;
  consequence: ReactNode;
  details?: ReactNode;
  help?: ReactNode;
}) {
  const helpTarget = useContext(WindowHelpContext);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = useId(); const helpArea = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null); const closeHelp = useRef<HTMLButtonElement>(null);
  function dismissHelp() { setHelpOpen(false); trigger.current?.focus(); }
  useEffect(() => {
    if (!helpOpen) return;
    closeHelp.current?.focus();
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !helpArea.current?.contains(event.target)) dismissHelp(); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [helpOpen]);
  const helpControl = <div className="ft-sheet__help" ref={helpArea} onKeyDown={event => { if (helpOpen && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismissHelp(); } }}>
    <Button ref={trigger} size="sm" aria-label={`Help for ${title}`} aria-expanded={helpOpen} aria-controls={helpId} onClick={() => setHelpOpen(value => !value)}>?</Button>
    {helpOpen && <div id={helpId} className="ft-sheet__popover" role="dialog" aria-label={`${title} help`}>
      <Inset><div className="ft-sheet__help-heading"><strong>Quick guide</strong><Button ref={closeHelp} size="sm" aria-label="Close help" onClick={dismissHelp}>×</Button></div>{help ?? consequence}</Inset>
    </div>}
  </div>;
  return <section className="ft-sheet" aria-label={title}>
    {helpTarget ? createPortal(helpControl, helpTarget) : <header className="ft-sheet__header"><h2>{title}</h2>{helpControl}</header>}
    <div className="ft-sheet__body">
      <section className="ft-sheet__status" aria-label="Current status"><Inset title="Now"><h3 className="fv-sr-only">Current status</h3>{status}</Inset></section>
      <section className="ft-sheet__decision" aria-label="Decision"><Inset title="Your decision">{decision}</Inset></section>
      <section className="ft-sheet__consequence" aria-label="Projected consequence"><Inset title="What happens next"><h3 className="fv-sr-only">Projected consequence</h3>{consequence ?? <p>Your next chapter starts with a choice.</p>}</Inset></section>
      {details && <details className="ft-sheet__history"><summary>History & details</summary>{details}</details>}
    </div>
    <footer>Fictional simulation · Illustrative assumptions · USD</footer>
  </section>;
}
