# Financial Town panels — integrated handoff

The panel branch combines latest shared integration 8fbcb06 from upstream/main, including valley theme dd020ef, hardened Agent 4 flow, and the canonical engine/AI gateway. All five buildings mount real store-controlled panels through ConnectedBuildingPanel in App.tsx. Agent 2's native PanelHost owns focus containment, Escape/backdrop close, initial focus, and restoration.

## Run from repository root

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd exec playwright -- install chromium --only-shell
npm.cmd run test:browser
```

The production app uses the root dependency installation. The isolated fixture workshop remains available with `npm.cmd exec vite -- src/components/panels --host 127.0.0.1 --port 5174`. That workshop is explicitly UI-only and rejects simulated transactions/events rather than faking an engine.

## Exports and integration

- index.ts: BuildingPanel, panelRegistry, BankPanel, MarketPanel, OfficePanel, HomePanel, InsurancePanel, and presentation types.
- ConnectedBuildingPanel.tsx: ConnectedBuildingPanel, selectPanelModel, planPanelCommand, dispatchPanelCommand.
- Canonical BuildingId uses hospital; the presentation adapter maps it to insurance.
- Canonical GameState, GameAction, InsuranceLine, and LedgerCategory are imported from src/types/domain.ts. PanelModel is display-only, not an alternate game schema.
- The registry imports scoped panels.css; import it explicitly when using individual named panels.
- App preserves Agent 2's optional panels override and renderReveal hook for teammates. The default reveal reports the actual computed Monte Carlo payload; Agent 5 can replace it with charts.

## Canonical action mapping

| UI command | Engine action |
| --- | --- |
| save_savings | set_contributions, preserving investments |
| save_investments | set_allocation plus set_contributions, preserving savings |
| pay_debt | make_extra_payment, one-time cash debit |
| save_budget | set_budget, discretionary monthly spending |
| choose_insurance | set_insurance with health/auto/renters and plan ID or null |
| choose_event | apply_event_option with event ID and option ID |

Every action batch is preflighted through applyAction before any store dispatch; rejected batches leave policies untouched. Dispatch uses the current store state and handles its ActionResult. Saved values only change when the host supplies updated props. Async pure-panel callbacks show pending/rejection feedback.

## Display and financial boundaries

The engine owns all balance changes, affordability, claims, returns, taxes, bounds, and policy replay. Office uses annualWithholding and selectMonthlyTakeHome; the UI aggregates the two engine-provided annual tax components before passing them into the pay selector. Its displayed withholding is explicitly the latest posted paycheck amount, not a forward withholding estimate. Paycheck history can include unemployment benefits, separate from the salary estimate.

Insurance reads the actual assumptions catalog. Null coverage caps mean no payout cap, not zero coverage. No-coverage options map to canonical null. Plan descriptions explain per-claim deductible, coinsurance, out-of-pocket maximum, and payout cap. A payout cap can leave additional costs to the player. Separate home insurance is not modeled by this schema; property shocks use renters coverage. Claims show actual realized gross cost, insurer payment, and signed out-of-pocket cost.

Market displays all three positions and annual asset assumptions, and accepts only draft weights totaling 100%. Savings/investment settings are recurring policies; debt extra payments are explicitly one-time. History retains account names and signed amounts from the real ledger. Every active event for the selected building is displayed, with IDs passed to the canonical engine.

No schema or financial engine implementation was changed during this integration. No AI key or credential was added. Personalized UI copy now accurately describes the existing optional AI gateway and fallback rather than falsely claiming all input stays local.

## Validation

See VERIFICATION.md. Typecheck/build, 61 unit/integration tests, and 4 desktop/mobile browser checks pass. Updated screenshots are in docs/screenshots/. Browser coverage includes real policy persistence, responsive overflow, keyboard navigation, focus, notifications, timeline/finish, and runtime errors. Other browser engines and live AI credentials were not tested.
