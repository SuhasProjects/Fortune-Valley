import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import './scroll-panel.css';

/** Financial-panel presentation only. The host still owns modal lifecycle. */
export function PanelShell({ title, status, decision, consequence, details, help }: {
  title: string;
  status: ReactNode;
  decision: ReactNode;
  consequence: ReactNode;
  details?: ReactNode;
  help?: ReactNode;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = useId(); const helpArea = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null); const closeHelp = useRef<HTMLButtonElement>(null);
  function dismissHelp() { setHelpOpen(false); trigger.current?.focus(); }
  useEffect(() => {
    if (!helpOpen) return;
    closeHelp.current?.focus();
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !helpArea.current?.contains(event.target)) setHelpOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [helpOpen]);
  return <section className="ft-sheet" aria-label={title}>
    <header className="ft-sheet__header"><h2>{title}</h2>
      <div className="ft-sheet__help" ref={helpArea} onKeyDown={event => { if (helpOpen && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismissHelp(); } }}>
        <button ref={trigger} className="ft-sheet__help-toggle" type="button" aria-label={`Help for ${title}`} aria-expanded={helpOpen} aria-controls={helpId} onClick={() => setHelpOpen(value => !value)}>?</button>
        {helpOpen && <div id={helpId} className="ft-sheet__popover" role="dialog" aria-label={`${title} help`}>
          <div className="ft-sheet__help-heading"><strong>Quick guide</strong><button ref={closeHelp} type="button" aria-label="Close help" onClick={dismissHelp}>×</button></div>
          {help ?? consequence}
        </div>}
      </div>
    </header>
    <div className="ft-sheet__body">
      <section className="ft-sheet__status" aria-label="Current status"><h3 className="ft-sheet__sr-only">Current status</h3>{status}</section>
      <section className="ft-sheet__decision" aria-label="Decision"><h3 className="ft-sheet__sr-only">Your decision</h3>{decision}</section>
      <section className="ft-sheet__consequence" aria-label="Projected consequence"><h3 className="ft-sheet__sr-only">Projected consequence</h3>{consequence}</section>
      {details && <details className="ft-sheet__history"><summary>History & details</summary>{details}</details>}
    </div>
    <footer>Fictional simulation · Illustrative assumptions · USD</footer>
  </section>;
}
