# Agent 2: town and app shell

## Integration points

- `TownScene({ onBuildingClick, eventBuilding? })` uses the canonical `BuildingTarget`: `bank`, `office`, `home`, `hospital`, `market`. Its five native buttons carry both sprite and label; the hotspot cannot drift away from its art. Percentage positions live in `components/town/buildings.ts`.
- `PanelHost({ building?, title?, onClose, children })` is a native modal dialog. Escape, close button, and clicks outside the dialog close it. Native modal behavior contains keyboard focus; unmount returns focus to the opener. Body scrolling is locked while mounted. Desktop width is 500px including borders, inner padding 24px; mobile has 8px viewport margins and 18px inner padding. Contents scroll within the dialog. Do not use fixed child widths.
- `GameShell({ children, topBar?, toasts? })` provides the responsive container and persistent simulation disclaimer. Notifications are in document flow below map and time controls, never covering hotspots. Agent 4's `NotificationStack` limits visibility to three; history now has an accessible host.
- `App({ panels?, renderReveal? })`: Agent 3 can supply a partial `Record<BuildingTarget, ReactNode>` of controlled panels. Use a wrapper subscribed to the store so props remain current. Agent 5 supplies `renderReveal(FinishPayload)`; the default shows actual observed net worth and explicitly states that Monte Carlo has not run. No fabricated chart is presented.

## State boundaries

All launch/time/pause/event/finish controls call Agent 4's store. HUD uses its canonical net-worth selector. No simulation math is introduced here. Money uses the existing USD formatter; the debt HUD aggregates debt balances only. Finishing at the duration limit exposes a review button to request the store's finish payload.

The checked-in runtime is Agent 4's temporary offline adapter. Detailed panel modules, the authoritative full financial engine, live AI, and computed reveal are not part of this change. Their absence is labeled in the UI. Personalized input uses the existing local fallback. No external assets, font requests, credentials, or AI calls were added.

## Design system

Original SVG art uses crisp edges and a fixed pixel grid. All panels, HUD, controls, notifications and graph defaults share a dark forest / warm parchment palette, square corners, hard shadows, monospace text, and `--pixel: 4px`. No font download is needed. Graph colors: `--chart-grid`, `--chart-observed`, `--chart-positive`, `--chart-negative`. Future Recharts surfaces inherit crisp edges and monospace text; Agent 5 should disable chart animation for reduced motion and avoid smoothing pixel-styled lines.

Map is 380–620px high on desktop, 430px on narrow phones; the page scrolls vertically when required. All interactive controls retain visible focus. Motion is subtle and disabled by `prefers-reduced-motion`.

## Local commands

`npm install`, `npm run dev`, `npm run typecheck`, `npm test`, `npm run build`.

On PowerShell with script execution disabled, use `npm.cmd` instead of `npm`.

Browser QA: `npx playwright install chromium`, then `npm run test:browser`. The Playwright config starts Vite automatically. Tests cover 1366×768 desktop and 390×844 phone layouts, five keyboard-activated buildings, dialog Tab containment / Escape / focus return / backdrop close, HUD ticks, pause/resume, decision badges, notification history, finish/reset, overflow, and runtime errors. Screenshots from both viewports are in `docs/screenshots/`.

Validation: TypeScript, production build, 13 Vitest tests, and both Chromium browser projects pass. Other browser engines have not been checked.
