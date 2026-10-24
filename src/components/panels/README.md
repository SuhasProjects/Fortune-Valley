# Financial panels — current team integration

Based this pass on shared main 81d020c, then reapplied the approved centered parchment/help design. Agent 1's canonical engine supplies every preview/pay/claim number; no financial math, tax logic, Monte Carlo implementation, or AI code is added in the panels.

## What now works

- Live 12-month illustration through previewHorizon: savings and investment policy drafts, Home discretionary-budget overrides, and actual Insurance overrides. A compact cash/borrowing result appears while editing; ? opens the current-versus-draft table. Both paths use the same simulated luck and are explicitly illustrative.
- One-time debt payment preview through applyAction and previewMonth. It shows cash/debt after payment and an optional next-month illustration without changing the real state or calling store dispatch.
- Office uses selectPaySummary for monthly gross, withholding, income/payroll breakdown, and take-home. Last actual pay remains separate from the estimate.
- Insurance compares the engine's settleClaim result for an illustrative $5,000 medical bill under the two catalog choices.
- The shared app's event cards remain reachable. Styling accounts for those cards without changing App or the flow components.

Canonical API: BuildingPanel { building, state, dispatch }. The registry remains bank / market / hospital / home / office. The slim store connector, explicit Save actions, collapsed history, and corner help behavior are unchanged.

## Preview and stress route

```powershell
npm.cmd exec vite -- --config src/components/panels/vite.config.ts --host 127.0.0.1 --port 5174
```

Open http://127.0.0.1:5174/ for the current town or /dev/stress-states for all 40 panel/state combinations. The default root dev server also runs the integrated app; only the special stress route needs the owned config.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:browser
npm.cmd exec playwright -- test --config src/components/panels/playwright.config.ts
npm.cmd run build
```

113 tests, six root desktop/mobile checks, four panel desktop/mobile checks, typecheck and build pass. Current screenshots are in screenshots/ and the root suite's docs/screenshots/. Preview tests compare the displayed values to engine outputs and verify that original state is untouched. No credentials were added.

## Remaining coordination

A shared React pixel component kit still has not landed; the scoped parchment skin remains the latest user-approved design. Engine contracts previously listed as missing are now resolved. See MISSING.md for that remaining kit note. Production deployment is owned by the team/Vercel project; pushing this branch does not itself deploy it.
