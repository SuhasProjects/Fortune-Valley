# Integration update — Agent 3

The original branch notes below describe f69c091. The integrated panel branch now uses canonical BuildingId, the real engine/store, connected panels, and a computed plain-text Monte Carlo reveal. App retains panels/renderReveal extension points. Typecheck/build, 61 unit tests, and 4 desktop/mobile browser checks pass. See ../src/components/panels/README.md and VERIFICATION.md for current contracts.

# Agent 2: town and app shell

## Integration points

- `TownScene({ onBuildingClick, eventBuildings?, eventBuilding? })` uses the canonical `BuildingId`: `bank`, `office`, `home`, `hospital`, `market`. `eventBuildings` supports multiple active events; the singular prop remains supported for existing callers. Its five native buttons carry both sprite and label; the hotspot cannot drift away from its art. Percentage positions live in `components/town/buildings.ts`.
- `PanelHost({ building?, title?, onClose, children })` is a native modal dialog. Escape, close button, and clicks outside the dialog close it. Native modal behavior contains keyboard focus; unmount returns focus to the opener. Body scrolling is locked while mounted. Desktop width is 500px including borders, inner padding 24px; mobile has 8px viewport margins and 18px inner padding. Contents scroll within the dialog. Do not use fixed child widths.
- `GameShell({ children, topBar?, toasts? })` provides the responsive container and persistent simulation disclaimer. Notifications are in document flow below map and time controls, never covering hotspots. Agent 4's `NotificationStack` limits visibility to three; history now has an accessible host.
- `App({ panels?, renderReveal? })`: Agent 3 can supply a partial `Record<BuildingId, ReactNode>` of controlled panels. Use a wrapper subscribed to the store so props remain current. Agent 5 supplies `renderReveal(FinishPayload)` using the type exported by `stores/useGameStore.ts`; the default shows actual observed net worth and computed Monte Carlo summary, quantiles, risks, and assumptions. Percentiles appear only when the engine supplies them for matching horizons. The chart remains Agent 5's integration slot. `?dev=engine` preserves main's engine harness.

## State boundaries

All launch/time/pause/event/finish controls call Agent 4's store backed by Agent 1's canonical engine. HUD uses its net-worth and debt selectors. No simulation math is introduced here. Money uses the existing USD formatter. Finishing at the duration limit exposes a review button to request the store's finish payload. Events come from `activeEvents`; option IDs dispatch `apply_event_option`. Store validation errors are surfaced.

The integration retains main's full financial engine, server-side AI gateway, Vite development middleware, environment template, fixtures and engine/API tests. Personalized prompts use the gateway when available and its local fallback otherwise; the UI describes this data flow. Detailed panel modules remain labeled integration slots. No external art, font requests, or client-side credentials were added.

## Design system

Original SVG art uses crisp edges and a fixed pixel grid. The cozy valley theme in `styles/valley.css` gives all panels, HUD, controls, notifications and graph defaults warm parchment surfaces, wooden borders, square corners, hard shadows, monospace text, and `--pixel: 4px`. Buildings have roof shingles, wall texture and flower boxes; the map includes layered foliage, fences, flower beds, benches and patterned water. No font download is needed. Graph colors: `--chart-grid`, `--chart-observed`, `--chart-positive`, `--chart-negative`. Future Recharts surfaces inherit crisp edges and monospace text; Agent 5 should disable chart animation for reduced motion and avoid smoothing pixel-styled lines.

Map is 380–620px high on desktop, 430px on narrow phones; the page scrolls vertically when required. All interactive controls retain visible focus. Motion is subtle and disabled by `prefers-reduced-motion`.

## Local commands

`npm install`, `npm run dev`, `npm run typecheck`, `npm test`, `npm run build`.

On PowerShell with script execution disabled, use `npm.cmd` instead of `npm`.

Browser QA: `npx playwright install chromium`, then `npm run test:browser`. The Playwright config starts Vite automatically. Tests cover 1366×768 desktop and 390×844 phone layouts, five keyboard-activated buildings, dialog Tab containment / Escape / focus return / backdrop close, HUD ticks, pause/resume, decision badges, notification history, finish/reset, overflow, and runtime errors. Screenshots from both viewports are in `docs/screenshots/`.

Validation after merging main: TypeScript (client and server), production build, 40 Vitest tests, and both Chromium browser projects pass. Browser tests stub the AI gateway as unavailable to verify the offline fallback. Other browser engines have not been checked. The merged dependency versions retain npm audit advisories (Anthropic SDK memory helpers and Vitest tooling); this merge does not introduce unrelated dependency major-version upgrades.
