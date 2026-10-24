import type { ReactNode } from 'react'
export function GameShell({ children, topBar, toasts }: { children: ReactNode; topBar?: ReactNode; toasts?: ReactNode }) {
  return <main className="financial-town"><a className="skip-link" href="#town-main">Skip to town</a>{topBar}<div id="town-main" tabIndex={-1}>{children}</div>{toasts}<footer className="simulation-footer"><span>Fictional educational simulation · Assumptions are illustrative</span><span>USD · A little town. A bigger perspective.</span></footer></main>
}
