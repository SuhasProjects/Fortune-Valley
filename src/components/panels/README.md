# Agent 3 — reduced canonical panels

All changes in this pass are confined to src/components/panels/. No domain, engine, store, AI, root app, or root test source is changed.

## Public contract

```tsx
import { BuildingPanel } from './components/panels';
<BuildingPanel building={buildingTarget} state={gameState} dispatch={dispatchAction} />
```

BuildingPanelProps uses canonical BuildingId, GameState, GameAction, and ActionResult from src/types/domain.ts. The registry keys are bank, market, hospital, home, and office. Named panel exports remain available. ConnectedBuildingPanel subscribes to Agent 4's store and passes the canonical state and dispatch directly; there is no alternate PanelModel, PanelCommand, or financial calculation adapter.

PanelShell has exactly three zones: current status, decision control, projected consequence. History/details are collapsed. Changes only apply on explicit Save through engine actions. Engine errors are shown verbatim. No projection is calculated in the UI.

## Reduced features

- Bank: balances/net worth, debt balance/APR/minimum, monthly savings contribution, and a collapsible one-time extra debt payment. Payment input is bounded by both debt and available cash. Transfers, recurring extra debt payments, and cash-buffer editors from the previous scope are removed.
- Market: three actual positions/returns, 100% allocation validation, monthly investment contribution, and labeled annual assumptions. Allocation and contribution are separate canonical actions and separate Save controls, preventing partially accepted combined changes.
- Insurance: exactly two health choices, comparing low premium/high deductible with high premium/low deductible. Mini-table shows actual catalog premiums, deductibles, medical coverage, coinsurance and caps. No other editable insurance decisions.
- Home: one budget slider using BOUNDS.monthlySpendMax; rent and essentials are read-only.
- Office: read-only employment and gross/recorded pay details. Job offers use apply_event_option with canonical eventId and optionId for Accept/Decline. Missing net estimate is explicitly marked TODO instead of computed in UI.

## Missing owner dependencies

See MISSING.md. The shared React pixel kit does not exist on any published team branch checked. These panels deliberately add no styling or substitute pixel kit: semantic HTML is a clearly marked unskinned integration scaffold until the owner supplies PixelPanel/Button/Input/Slider/Bar/Toast. The old custom panel CSS is removed. Pixel-kit visual acceptance is not complete.

previewPolicy(state, draftPolicy) and its canonical result type are missing. The 12-month preview says unavailable; it does not manufacture a runway/cash-buffer number. Office also awaits a complete engine monthly pay summary. Policy has no budget/one-time-action fields; those are not invented for preview purposes.

## Stress route

From the repository root:

```powershell
npm.cmd exec vite -- --config src/components/panels/vite.config.ts --host 127.0.0.1 --port 5174
```

Open http://127.0.0.1:5174/dev/stress-states. The folder-owned Vite config adds that exact dev route without modifying root files. The app owner may alternatively mount StressStatesPage from dev/StressStatesPage.tsx in the default app route.

The page renders every panel for no cash, high debt, no insurance, unemployed, and all four starting profiles: 40 panels total. Fixtures use the canonical sample and engine createGame/applyAction; no financial engine is implemented in the harness. Accepted edits remain local to each fixture sandbox.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd exec playwright -- test --config src/components/panels/playwright.config.ts
```

Typecheck/build, 59 tests, and both desktop/mobile stress-route browser projects pass. Current screenshots are screenshots/desktop-stress-bank.png and screenshots/mobile-stress-bank.png; they document the unskinned scaffold, not a completed pixel-kit design. The old root browser selectors require an owner update for the reduced forms, as recorded in MISSING.md.
