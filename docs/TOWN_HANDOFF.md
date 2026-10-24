# Town and interface handoff

## Whole-site design

`src/styles/world.css` is the active interface stylesheet, imported by `src/styles/index.css` after Tailwind, the locally bundled Pixelify Sans / VT323 fonts, and shared `pixel-tokens.css`. It replaces the earlier layered town/valley/illustrated stylesheets. No font network requests are made at runtime.

The visual language is inspired by cozy pixel-art games, with an original layout: an ambient pixel landscape, hanging wooden title sign, character save slots, a two-page question journal, inventory-style HUD, framed game buttons, centered wooden dialog headers, ruled financial journals, activity notes, and matching results presentation. All text, controls and menus remain accessible HTML. The style reference is inspiration, not a requirement to reproduce another game's composition.

`components/layout/PixelArt.tsx` supplies original code-native character portraits, context icons, and the ambient landscape. `BuildingOverview.tsx` shows read-only canonical store values when a controlled building panel has not been supplied. It contains no simulation math.

## Integration contracts

- `TownScene({ onBuildingClick, eventBuildings?, eventBuilding? })` uses canonical `BuildingId` values (`bank`, `office`, `home`, `hospital`, `market`). The five native buttons carry accessible labels and visible focus. Multiple event markers are supported.
- `PanelHost({ building?, title?, onClose, children })` uses a native modal dialog with Tab containment, Escape, outside-click and close-button handling. Unmount restores opener focus; body scroll is locked. The dialog is centered, up to 620px wide including borders, with 25px content padding. Mobile uses 12px viewport margins and 18px content padding. Content scrolls within its viewport limit; children must not impose fixed widths.
- `GameShell({ children, topBar?, toasts? })` owns the ambient world, responsive container, skip link and persistent disclaimer. Notifications remain below the controls without covering the map.
- `App({ panels?, renderReveal? })` accepts a partial `Record<BuildingId, ReactNode>` for Agent 3's controlled panels. Use a store-subscribed wrapper to keep props current. Agent 5 mounts via `renderReveal(FinishPayload)`; the payload type comes from `stores/useGameStore.ts`. Default results show the actual computed Monte Carlo summary, assumptions and risks. Percentiles only appear when supplied by the engine for matching horizons. `?dev=engine` preserves the engine harness.

## State and artwork

All scenario, time, event, pause and finish controls call the existing store. HUD values use canonical debt/net-worth selectors. Building summaries read canonical state. The AI gateway and local fallback remain unchanged. No client-side credentials are introduced.

The functional town uses `public/assets/town-valley-v1.png`, an original imagegen backdrop. Its full generation prompt is saved beside it. The user's reference screenshot is not redistributed. The image keeps its 3:2 ratio; percentage hit areas in `buildings.ts` follow the inspected art on both phone and desktop. The landing page uses the original pixel landscape and portraits rather than embedding a town image as its design.

Shared `--ft-*` palette/chart tokens remain available. Active graphs inherit the same pixel typography and crisp edges. Agent 5 should respect reduced motion and keep assumptions legible.

## Verification

Commands: `npm install`, `npm run dev`, `npm run typecheck`, `npm test`, `npm run build`.

PowerShell may require `npm.cmd`. Browser QA: `npx playwright install chromium`, then `npm run test:browser`. Tests start a fresh Vite server on port 5175 to avoid silently reusing stale preview styles. Normal user preview uses port 5173.

Typecheck, all 40 Vitest tests, build, and desktop/mobile Chromium smoke tests pass. Browser checks cover fonts/styles being loaded, all five pointer/keyboard targets, focus containment/return, Escape/backdrop close, HUD month ticks, pause/resume, activity history, offline opportunities, computed results, reset, overflow and runtime errors. Updated landing/town/panel/results screenshots are in `docs/screenshots/` at 1366x768 and 390x844. Other browser engines have not been checked.
