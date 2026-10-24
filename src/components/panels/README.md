# Financial panels — centered parchment update

The latest user request authorizes the scoped parchment presentation in scroll-panel.css. All source changes remain in src/components/panels/; the root app, host, engine, store, and AI code are unchanged.

## Current behavior

- Financial dialogs are centered and up to 860px wide. Other dialog types keep their existing layout. The host override is scoped with :has(.ft-sheet).
- A warm yellow parchment frame uses a stepped clip-path for lightly torn edges, with no image downloads or soft-shadow/gradient dependency.
- Main views show balances, required inputs, Save buttons, and short monthly/one-time amounts. History stays collapsed.
- The corner ? opens a short guide. Escape or its close button restores focus to ?. A second Escape closes the host modal. Clicking elsewhere dismisses help.
- All amounts and actions still use canonical state/engine contracts. No financial or tax calculations were added.

The public API remains BuildingPanel { building, state, dispatch }. The registry uses canonical bank/market/hospital/home/office IDs; ConnectedBuildingPanel still delegates to Agent 4's store.

## Development and checks

```powershell
npm.cmd exec vite -- --config src/components/panels/vite.config.ts --host 127.0.0.1 --port 5174
```

Open http://127.0.0.1:5174/ for the real town, or /dev/stress-states for all 40 panel/state combinations.

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd exec playwright -- test --config src/components/panels/playwright.config.ts
```

Current checks: 61 tests, typecheck, build, and four desktop/mobile browser checks pass. Screenshots are in screenshots/, including desktop-centered-bank.png, mobile-centered-bank.png and the matching bank-help images.

## Existing limitations

The shared React pixel kit was not found in the published branches. The current scoped styling follows the user's explicit parchment request; it is not claimed to be that missing kit.

The 12-month preview and complete take-home estimate remain unavailable. They are kept concise and explained in help, not calculated in the UI. See MISSING.md. No credentials were added to source or the repository.
