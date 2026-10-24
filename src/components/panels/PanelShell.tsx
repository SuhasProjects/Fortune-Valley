import type { ReactNode } from 'react';

/** TODO(shared-ui-kit): wrap these semantic slots in the owner's PixelPanel.
 * No local palette, control skin, CSS, or substitute pixel kit is defined here.
 */
export function PanelShell({ title, status, decision, consequence, details }: {
  title: string;
  status: ReactNode;
  decision: ReactNode;
  consequence: ReactNode;
  details?: ReactNode;
}) {
  return <section aria-label={title}>
    <h2>{title}</h2>
    <section aria-label="Current status"><h3>Current status</h3>{status}</section>
    <section aria-label="Decision"><h3>Your decision</h3>{decision}</section>
    <section aria-label="Projected consequence"><h3>Projected consequence</h3>{consequence}</section>
    {details && <details><summary>History & details</summary>{details}</details>}
    <footer>Fictional educational simulation; assumptions are illustrative. All amounts in USD.</footer>
  </section>;
}
